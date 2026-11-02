import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getIfoodAuth, getIfoodEvents, getIfoodOrder, mapIfoodOrderToFlow } from "@/lib/integrations/ifood"
import { upsertIfoodCustomer } from "@/lib/integrations/ifood-customer"
import { deductOrderStock, restoreOrderStock } from "@/lib/stock"
import { requireAuth } from "@/lib/require-auth"
import { getRequestId, logger } from "@/lib/logger"

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || ""
    const isCron =
      !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`

    // Aceita cron (todas as lojas) OU usuário logado (só a própria loja) —
    // o dashboard chama este endpoint com o JWT do usuário.
    let userEstablishmentId: string | null = null
    if (!isCron) {
      const { user, error } = requireAuth(req)
      if (error) return error
      userEstablishmentId = user!.establishmentId
    }

    const url = new URL(req.url)
    const showDetail = url.searchParams.has("detail")

    const establishments = await prisma.establishment.findMany({
      where: {
        ifoodEnabled: true,
        ifoodMerchantId: { not: null },
        ...(userEstablishmentId ? { id: userEstablishmentId } : {}),
      },
    })

    let created = 0
    let updated = 0
    let skipped = 0
    let errors = 0
    const details: any[] = []

    for (const est of establishments) {
      const auth = await getIfoodAuth(
        process.env.IFOOD_CLIENT_ID!,
        process.env.IFOOD_CLIENT_SECRET!
      )
      if (!auth?.accessToken) {
        errors++
        if (showDetail) details.push({ error: "ifood auth failed", est: est.name })
        continue
      }
      const accessToken = auth.accessToken

      const rawEvents = await getIfoodEvents(accessToken, est.ifoodMerchantId!)
      const events: any[] = Array.isArray(rawEvents) ? rawEvents : []

      if (showDetail) {
        details.push({ est: est.name, totalEvents: events.length, codes: events.map((e: any) => e?.code) })
      }

      for (const event of events) {
        const isNewOrder = ["PLACED", "PLC", "CFM", "CONFIRMED"].includes(event.code)
        const isUpdate = ["DSP", "DISPATCHED", "CON", "CONCLUDED", "PREPARATION_STARTED", "READY_TO_PICKUP"].includes(event.code)
        const isCancel = ["CAN", "CANCELLED", "CANCELLATION_REQUESTED"].includes(event.code)
        if (!isNewOrder && !isUpdate && !isCancel) {
          skipped++
          continue
        }

        try {
          const existing = await prisma.order.findFirst({
            where: { establishmentId: est.id, externalId: event.orderId },
          })

          // For status updates (DSP/CON), update the existing order in place.
          if (existing && isUpdate) {
            const newStatus = event.code === 'CON' || event.code === 'CONCLUDED' ? 'delivered'
              : event.code === 'DISPATCHED' || event.code === 'DSP' ? 'out_for_delivery'
              : event.code === 'PREPARATION_STARTED' ? 'preparing'
              : event.code === 'READY_TO_PICKUP' ? 'ready'
              : 'dispatched'

            // DISPATCHED (iFood motoboy saiu): só atualiza automaticamente se o
            // status local ainda está em 'preparing'. Se já está em 'ready',
            // significa que operador clicou manualmente — não pular pra
            // 'out_for_delivery' sozinho.
            if (newStatus === 'out_for_delivery' && existing.status === 'ready') {
              skipped++
              continue
            }

            // Pedido cancelado localmente (ou por evento anterior) é terminal:
            // não deixa evento atrasado do iFood ressuscitar (F5A-011).
            if (existing.status === "cancelled") {
              skipped++
              continue
            }

            // Status priority: delivered > out_for_delivery > ready > preparing > accepted
            // Não faz downgrade do status local (ignora eventos antigos do iFood).
            const statusRank: Record<string, number> = {
              pending: 0, new: 0, payment_pending: 0, confirmed: 1, accepted: 2,
              preparing: 3, ready: 4, dispatched: 5, out_for_delivery: 6, delivered: 7,
            }
            const currentRank = statusRank[existing.status] ?? 0
            const newRank = statusRank[newStatus] ?? 0

            if (newRank < currentRank) {
              skipped++
              continue
            }

            // Avoid resetting if iFood re-delivers an old event after we've
            // already moved forward locally (use updatedAt).
            const eventTime = event.createdAt ? new Date(event.createdAt) : null
            if (
              existing.status === "delivered" &&
              eventTime && existing.updatedAt &&
              eventTime < existing.updatedAt
            ) {
              skipped++
              continue
            }

            await prisma.order.update({
              where: { id: existing.id },
              data: { status: newStatus }
            })
            updated++
            continue
          }

          // For cancellation events (CAN): CancellationLog + estorno + status
          // cancelled (F5A-011: antes restaurava em dobro e hard-deletava — o
          // poll recriava o pedido e debitava o estoque de novo).
          if (existing && isCancel) {
            try {
              if (existing.status === "cancelled") {
                skipped++
                continue
              }
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
                // Restore stock for cancelled iFood order
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
            } catch (e: any) {
              errors++
              if (showDetail) details.push({ error: e.message, orderId: event.orderId })
            }
            continue
          }

          if (existing) {
            // Placeholders created from PLC without items should be filled
            // when a later event (CFM) brings the full order.
            const isPlaceholder =
              existing.customerName === "Aguardando iFood" ||
              (existing.items === "[]" && (!existing.total || existing.total === 0))
            if (!isPlaceholder || existing.status === "cancelled") {
              skipped++
              continue
            }
            // Fetch full details and update the placeholder in place.
            try {
              const order = await getIfoodOrder(accessToken, est.ifoodMerchantId!, event.orderId)
              if (order && order.items && order.items.length > 0) {
                const mapped = mapIfoodOrderToFlow(order, est.id, event.code)
                const customer = await upsertIfoodCustomer(est.id, order.customer)
                await prisma.$transaction(async (tx) => {
                  await tx.order.update({
                    where: { id: existing.id },
                    data: { ...mapped, externalId: event.orderId, customerId: customer?.id }
                  })
                  // F5A-013: o placeholder nasceu sem itens e sem baixa de
                  // estoque; ao receber o carrinho real, debita como marketplace.
                  let itemsForStock: any[] = []
                  try {
                    const parsed = typeof mapped.items === "string" ? JSON.parse(mapped.items) : mapped.items
                    if (Array.isArray(parsed)) itemsForStock = parsed
                  } catch {}
                  if (itemsForStock.length > 0) {
                    await deductOrderStock(tx, itemsForStock, existing.id, existing.establishmentId, true)
                  }
                })
                updated++
              } else {
                skipped++
              }
            } catch (e: any) {
              errors++
              if (showDetail) details.push({ error: e.message, orderId: event.orderId })
            }
            continue
          }

          // For new orders, fetch full details from iFood.
          const order = await getIfoodOrder(accessToken, est.ifoodMerchantId!, event.orderId)

          if (order && order.items && order.items.length > 0) {
            const mapped = mapIfoodOrderToFlow(order, est.id, event.code)
            const customer = await upsertIfoodCustomer(est.id, order.customer)
            const createdOrder = await prisma.order.create({
              data: { ...mapped, externalId: event.orderId, customerId: customer?.id }
            })
            // Deduct stock for iFood order items
            try {
              const items = JSON.parse(mapped.items || "[]")
              await prisma.$transaction(async (tx) => {
                await deductOrderStock(tx, items, createdOrder.id, est.id, true)
              })
            } catch (stockErr: any) {
              logger.error("ifood-poll", "falha na baixa de estoque do pedido", { requestId: getRequestId(req), orderId: createdOrder.id, error: stockErr?.message })
            }
            created++
          } else {
            // PLC may not have items yet; save placeholder so the merchant sees it.
            await prisma.order.create({
              data: {
                establishmentId: est.id,
                externalId: event.orderId,
                customerName: "Aguardando iFood",
                customerPhone: "",
                total: 0,
                items: "[]",
                method: "ifood",
                status: "pending",
                paymentStatus: "pending",
                orderType: "delivery",
                paymentMethod: "online",
              }
            })
            created++
          }
        } catch (e: any) {
          errors++
          if (showDetail) details.push({ error: e.message, orderId: event.orderId })
        }
      }
    }

    return NextResponse.json({ ok: true, created, updated, skipped, errors, details: showDetail ? details : undefined, establishmentsCount: establishments.length })
  } catch (err: any) {
    logger.error("ifood-poll", "erro ao sincronizar os pedidos do iFood", { requestId: getRequestId(req), error: err?.message })
    return NextResponse.json({ error: String(err?.message || err), stack: err?.stack }, { status: 500 })
  }
}
