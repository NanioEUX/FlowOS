import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getIfoodAuth, getIfoodOrder, mapIfoodOrderToFlow } from "@/lib/integrations/ifood"
import { upsertIfoodCustomer } from "@/lib/integrations/ifood-customer"
import { deductOrderStock, restoreOrderStock } from "@/lib/stock"
import { verifyHmacSha256 } from "@/lib/webhook-signature"
import { getRequestId, logger } from "@/lib/logger"

function calcCashbackEarned(total: number, establishment: any): number {
  try {
    const parsedLoyalty = establishment.loyaltyConfig ? JSON.parse(establishment.loyaltyConfig) : null
    if (!parsedLoyalty?.enabled) return 0
    const percent = parsedLoyalty.cashbackPercent || parsedLoyalty.pointsPerReal || 0
    if (!percent) return 0
    return Math.floor(total * percent / 100)
  } catch { return 0 }
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text()
    logger.info("webhook-ifood", "webhook recebido", { requestId: getRequestId(req), bodyLength: raw.length })

    // iFood NÃO envia header de assinatura na prática (aceitamos sem assinatura
    // desde sempre). Só valida se um header estiver presente — exigir a assinatura
    // quebrava todos os pedidos (regressão do 84e69ae).
    const signature = req.headers.get("x-ifood-signature") || ""
    const secret = process.env.IFOOD_WEBHOOK_SECRET || process.env.IFOOD_CLIENT_SECRET || ""

    if (signature && secret) {
      if (!verifyHmacSha256(raw, signature, secret)) {
        logger.warn("webhook-ifood", "assinatura inválida — rejeitando", { requestId: getRequestId(req) })
        return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 })
      }
    } else {
      logger.warn("webhook-ifood", "sem header de assinatura — aceitando webhook sem assinatura (o iFood não assina)", { requestId: getRequestId(req) })
    }

    const payload = JSON.parse(raw)
    let events: any[] = []
    if (Array.isArray(payload)) {
      events = payload
    } else if (payload.orderId || payload.code) {
      events = [payload]
    } else if (payload.events && Array.isArray(payload.events)) {
      events = payload.events
    } else {
      events = []
    }

    if (events.length === 0) {
      return NextResponse.json({ ok: true, msg: "noop" })
    }

    logger.info("webhook-ifood", "eventos recebidos", { requestId: getRequestId(req), count: events.length, events: events.map((e: any) => ({ code: e.code || e.fullCode, orderId: (e.orderId || e.id || "").slice(0, 8) })).slice(0, 5) })

    const establishments = await prisma.establishment.findMany({
      where: { ifoodEnabled: true, ifoodMerchantId: { not: null } },
    })

    if (establishments.length === 0) {
      return NextResponse.json({ ok: true, msg: "no establishment enabled" })
    }

    // Helper: find the correct establishment for an event
    // First try matching via existing order, then fallback to first enabled
    async function findEstablishment(orderId: string) {
      // Try to find via existing order
      const existingOrder = await prisma.order.findFirst({
        where: { externalId: orderId },
        select: { establishmentId: true },
      })
      if (existingOrder) {
        const match = establishments.find(e => e.id === existingOrder.establishmentId)
        if (match) return match
        // F4B-002: o pedido existe numa loja que não está na lista (iFood
        // desativado). Cair no primeiro tenant criaria pedido duplicado na
        // loja errada — melhor não tocar em nada.
        logger.warn("webhook-ifood", "pedido de loja sem iFood habilitado — ignorando", {
          requestId: getRequestId(req),
          orderId: orderId?.slice(0, 8),
          establishmentId: existingOrder.establishmentId,
        })
        return null
      }
      return establishments[0]
    }

    let created = 0
    let updated = 0
    const results: any[] = []

    for (const event of events) {
      const code = event.code || event.fullCode
      const orderId = event.orderId || event.id

      logger.info("webhook-ifood", "processando evento", { requestId: getRequestId(req), code, orderId: orderId?.slice(0, 8) })

      if (!orderId) {
        logger.info("webhook-ifood", "evento sem orderId — ignorado", { requestId: getRequestId(req), code })
        continue
      }

      // iFood sends KEEPALIVE events to verify the webhook is alive.
      // We acknowledge them with 200 OK but do nothing.
      if (code === "KEEPALIVE") {
        logger.info("webhook-ifood", "keepalive recebido", { requestId: getRequestId(req) })
        continue
      }

      const est = await findEstablishment(orderId)
      if (!est) {
        // F4B-002: condição permanente (loja sem iFood) — não conta como falha
        // transitória para não gerar retry infinito do iFood.
        results.push({ orderId, action: 'unknown_establishment' })
        continue
      }

      if (["PLACED", "CFM", "CONFIRMED"].includes(code)) {
        const existing = await prisma.order.findFirst({
          where: { establishmentId: est.id, externalId: orderId },
        })

        if (!existing && event.fullOrder) {
          try {
            const mapped = mapIfoodOrderToFlow(event.fullOrder, est.id, code)
            const createdOrder = await prisma.order.create({ data: { ...mapped, externalId: orderId, cashbackEarned: calcCashbackEarned(mapped.total || 0, est) } })
            // Deduct stock for iFood order items
            try {
              const items = JSON.parse(mapped.items || "[]")
              await prisma.$transaction(async (tx) => {
                await deductOrderStock(tx, items, createdOrder.id, est.id, true)
              })
            } catch (stockErr: any) {
              logger.error("webhook-ifood", "falha ao debitar estoque do pedido criado", {
                requestId: getRequestId(req),
                orderId: orderId?.slice(0, 8),
                error: stockErr.message,
              })
            }
            created++
            results.push({ orderId, action: 'created' })
          } catch (e: any) {
            // F4B-002: corrida entre duas entregas do mesmo evento — o
            // unique de externalId barrou a segunda. Não é erro: o pedido já
            // existe (a dedup foi criada junto).
            if (e?.code === "P2002") {
              logger.warn("webhook-ifood", "externalId duplicado — pedido já criado", {
                requestId: getRequestId(req),
                orderId: orderId?.slice(0, 8),
              })
              results.push({ orderId, action: 'already_exists' })
            } else {
              results.push({ orderId, action: 'create_error', error: e.message })
            }
          }
        } else if (!existing) {
          try {
            const auth = await getIfoodAuth(
              process.env.IFOOD_CLIENT_ID!,
              process.env.IFOOD_CLIENT_SECRET!
            )
            if (!auth?.accessToken) {
              results.push({ orderId, action: 'auth_error' })
              continue
            }
            const order = await getIfoodOrder(auth.accessToken, est.ifoodMerchantId!, orderId)
            // F4A-014: o payload do iFood traz nome/telefone do cliente — fora do log.
            logger.info("webhook-ifood", "pedido do iFood buscado", { requestId: getRequestId(req), orderId: orderId?.slice(0, 8), items: order?.items?.length || 0, hasCustomer: !!order?.customer, orderType: order?.orderType })
            if (order && order.items && order.items.length > 0) {
              const mapped = mapIfoodOrderToFlow(order, est.id, code)
              try {
                const customer = await upsertIfoodCustomer(est.id, order.customer)
                const createdOrder = await prisma.order.create({
                  data: { ...mapped, externalId: orderId, customerId: customer?.id, cashbackEarned: calcCashbackEarned(mapped.total || 0, est) }
                })
                // Deduct stock for iFood order items
                try {
                  const items = JSON.parse(mapped.items || "[]")
                  await prisma.$transaction(async (tx) => {
                    await deductOrderStock(tx, items, createdOrder.id, est.id, true)
                  })
                } catch (stockErr: any) {
                  logger.error("webhook-ifood", "falha ao debitar estoque do pedido placeholder", {
                    requestId: getRequestId(req),
                    orderId: orderId?.slice(0, 8),
                    error: stockErr.message,
                  })
                }
                created++
                results.push({ orderId, action: 'created' })
                logger.info("webhook-ifood", "pedido salvo", { requestId: getRequestId(req), orderId: orderId?.slice(0, 8), establishmentId: mapped.establishmentId })
              } catch (createErr: any) {
                // F4B-002: corrida de dedup — tratar como "já existe"
                if (createErr?.code === "P2002") {
                  logger.warn("webhook-ifood", "externalId duplicado — pedido já criado", { requestId: getRequestId(req), orderId: orderId?.slice(0, 8) })
                  results.push({ orderId, action: 'already_exists' })
                } else {
                  logger.error("webhook-ifood", "falha ao criar o pedido", {
                    requestId: getRequestId(req),
                    orderId: orderId?.slice(0, 8),
                    error: createErr.message,
                  })
                  results.push({ orderId, action: 'create_error', error: createErr.message })
                }
              }
            } else {
              // PLC pode vir com items vazios. Salva o pedido com dados básicos
              // e depois atualiza quando chegar CFM com items completos.
              logger.info("webhook-ifood", "PLC sem itens — salvando com placeholders", { requestId: getRequestId(req), orderId: orderId?.slice(0, 8) })
              try {
                const placeholder = {
                  establishmentId: est.id,
                  customerName: "Aguardando iFood",
                  customerPhone: "",
                  total: 0,
                  items: JSON.stringify([]),
                  method: "ifood",
                  status: "pending",
                  paymentStatus: "pending",
                  orderType: "delivery",
                  paymentMethod: "online",
                }
                await prisma.order.create({ data: { ...placeholder, externalId: orderId } })
                created++
                results.push({ orderId, action: 'created_placeholder' })
                logger.info("webhook-ifood", "pedido placeholder salvo", { requestId: getRequestId(req), orderId: orderId?.slice(0, 8) })
              } catch (createErr: any) {
                if (createErr?.code === "P2002") {
                  logger.warn("webhook-ifood", "externalId duplicado — pedido já criado", { requestId: getRequestId(req), orderId: orderId?.slice(0, 8) })
                  results.push({ orderId, action: 'already_exists' })
                } else {
                  logger.error("webhook-ifood", "falha ao criar o pedido placeholder", {
                    requestId: getRequestId(req),
                    orderId: orderId?.slice(0, 8),
                    error: createErr.message,
                  })
                  results.push({ orderId, action: 'create_placeholder_error', error: createErr.message })
                }
              }
            }
          } catch (e: any) {
            results.push({ orderId, action: 'fetch_error', error: e.message })
          }
        } else {
          results.push({ orderId, action: 'already_exists' })
        }
      } else if (["CAN", "CANCELLED", "CANCELLATION_REQUESTED"].includes(code)) {
        const existing = await prisma.order.findFirst({
          where: { establishmentId: est.id, externalId: orderId },
        })
        if (existing) {
          if (existing.status === "cancelled") {
            results.push({ orderId, action: 'already_cancelled' })
          } else {
          const reason =
            (event as any).reason ||
            (event as any).metadata?.reason ||
            (event as any).cancellation?.reason ||
            null
          const cancelledBy =
            (event as any).cancelledBy ||
            (event as any).metadata?.cancelledBy ||
            "system"
          await prisma.$transaction(async (tx) => {
            await tx.cancellationLog.create({
              data: {
                establishmentId: existing.establishmentId,
                orderId: existing.id,
                source: "ifood",
                cancelledBy,
                reason: typeof reason === "string" ? reason : null,
                orderNumber: existing.orderNumber,
                customerName: existing.customerName,
                customerPhone: existing.customerPhone,
                total: existing.total,
                paymentMethod: existing.paymentMethod,
                paymentStatus: existing.paymentStatus,
                externalId: existing.externalId,
              },
            })
            // Restore stock for cancelled iFood order (guard evita estorno em
            // dobro — F5A-011) e mantém o registro cancelado (sem hard delete:
            // o evento reentregue recriava o pedido e debitava de novo).
            await restoreOrderStock(tx, existing.items, existing.id, existing.establishmentId)
            await tx.order.update({
              where: { id: existing.id },
              data: {
                status: "cancelled",
                paymentStatus: existing.paymentStatus === "paid" ? "refunded" : "cancelled",
                cancellationReason: typeof reason === "string" ? reason : null,
                cancellationDate: new Date(),
                cancelledBy,
              },
            })
          })
          updated++
          results.push({ orderId, action: 'cancelled_ifood', reason })
          }
        } else {
          results.push({ orderId, action: 'not_found_for_cancel' })
        }
      } else if (["DSP", "DISPATCHED", "CON", "CONCLUDED", "PREPARATION_STARTED", "READY_TO_PICKUP"].includes(code)) {
        const existing = await prisma.order.findFirst({
          where: { establishmentId: est.id, externalId: orderId },
        })
        if (existing) {
          const newStatus = code === 'CON' || code === 'CONCLUDED' ? 'delivered'
            : code === 'DISPATCHED' || code === 'DSP' ? 'out_for_delivery'
            : code === 'PREPARATION_STARTED' ? 'preparing'
            : code === 'READY_TO_PICKUP' ? 'ready'
            : 'dispatched'

          // Don't downgrade a manually-completed order. Once the operator
          // marks "delivered" the iFood event may arrive late.
          if (existing.status === "delivered" && newStatus !== "delivered") {
            results.push({ orderId, action: 'skipped_manual_done' })
            continue
          }

          // Use the merchant timestamp (iFood event) compared to the order's
          // updatedAt to avoid resetting forward progress.
          const eventTime = event.createdAt ? new Date(event.createdAt) : null
          if (
            eventTime && existing.updatedAt &&
            eventTime < existing.updatedAt
          ) {
            results.push({ orderId, action: 'skipped_old_event' })
            continue
          }

          await prisma.order.update({
            where: { id: existing.id },
            data: { status: newStatus },
          })
          updated++
          results.push({ orderId, action: 'updated', status: newStatus })
        } else {
          results.push({ orderId, action: 'not_found_for_update' })
        }
      }
    }

    // F4A-001: responder 200 com tudo falhando fazia o iFood considerar o
    // evento entregue e nunca reenviar (pedido/placar perdido em silêncio).
    // Agora falhas transitórias devolvem 500 → o iFood reenvia.
    const failed = results.filter((r: any) =>
      ["create_error", "create_placeholder_error", "fetch_error", "auth_error"].includes(r.action)
    )
    if (failed.length > 0) {
      logger.error("webhook-ifood", "eventos com falha — devolvendo 500 para o iFood reenviar", {
        requestId: getRequestId(req),
        failed,
      })
      return NextResponse.json(
        { ok: false, created, updated, failed: failed.length, results },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, created, updated, results })
  } catch (err: any) {
    logger.error("webhook-ifood", "falha ao processar o webhook", {
      requestId: getRequestId(req),
      error: err.message,
    })
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
