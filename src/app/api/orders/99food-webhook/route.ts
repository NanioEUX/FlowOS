import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { map99FoodOrderToFlow } from "@/lib/integrations/nine-food"
import { upsert99FoodCustomer } from "@/lib/integrations/nine-food-customer"
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

/**
 * 99Food Webhook Handler
 *
 * Payload format (Open Delivery Abrasel):
 * {
 *   "eventId": "evt_99f_771a2b3c4d",
 *   "eventType": "ORDER_CREATED",
 *   "orderId": "99F-8829103-XYZ",
 *   "shopId": "shop_99_001234",
 *   "createdAt": "2026-09-16T20:30:00Z",
 *   "order": { ... }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.text()
    logger.info("webhook-99food", "webhook recebido", { requestId: getRequestId(req), bodyLength: raw.length })

    // --- HMAC-SHA256 signature validation (Open Delivery: X-App-Signature) ---
    const signature =
      req.headers.get("x-app-signature") ||
      req.headers.get("x-99food-signature") ||
      req.headers.get("x-webhook-signature") ||
      ""

    // Validate against every enabled 99Food establishment key (multi-tenant safe)
    const sigEstablishments = await prisma.establishment.findMany({
      where: { nineFoodEnabled: true, nineFoodApiKey: { not: null } },
      select: { nineFoodApiKey: true },
    })
    const secrets = sigEstablishments.map((e) => e.nineFoodApiKey).filter(Boolean) as string[]

    // Só valida se um header de assinatura estiver presente — exigir a assinatura
    // quebrava pedidos de provedores que não assinam (regressão do 84e69ae).
    if (signature && secrets.length > 0) {
      const valid = secrets.some((s) => verifyHmacSha256(raw, signature, s))
      if (!valid) {
        logger.warn("webhook-99food", "assinatura inválida — rejeitando", { requestId: getRequestId(req) })
        return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 })
      }
    } else {
      logger.warn("webhook-99food", "sem header de assinatura — aceitando webhook sem assinatura", { requestId: getRequestId(req) })
    }
    // --- End HMAC validation ---

    const payload = JSON.parse(raw)
    // F4A-014: o payload do 99Food traz dados do cliente — fora do log.
    logger.info("webhook-99food", "payload recebido", { requestId: getRequestId(req), keys: Object.keys(payload || {}) })

    const eventType = payload.eventType || payload.event || ""
    const orderId = payload.orderId || payload.id || ""
    const shopId = payload.shopId || ""
    const eventDate = payload.createdAt || ""

    logger.info("webhook-99food", "evento recebido", { requestId: getRequestId(req), eventType, orderId, shopId })

    // Acknowledge non-order events
    if (!eventType || !orderId) {
      return NextResponse.json({ ok: true, msg: "noop" })
    }

    // Find establishments with 99Food enabled
    const establishments = await prisma.establishment.findMany({
      where: { nineFoodEnabled: true, nineFoodMerchantId: { not: null } },
    })

    if (establishments.length === 0) {
      return NextResponse.json({ ok: true, msg: "no establishment enabled" })
    }

    // Find the correct establishment for this order
    async function findEstablishment(extOrderId: string) {
      const existingOrder = await prisma.order.findFirst({
        where: { externalId: extOrderId },
        select: { establishmentId: true },
      })
      if (existingOrder) {
        return establishments.find((e) => e.id === existingOrder.establishmentId) || establishments[0]
      }
      // Try matching by shopId if merchantId matches
      const byShop = establishments.find((e) => e.nineFoodMerchantId === shopId)
      return byShop || establishments[0]
    }

    const est = await findEstablishment(orderId)
    let created = 0
    let updated = 0
    const results: any[] = []

    // === ORDER_CREATED ===
    if (eventType === "ORDER_CREATED") {
      const existing = await prisma.order.findFirst({
        where: { establishmentId: est.id, externalId: orderId },
      })

      if (existing) {
        return NextResponse.json({ ok: true, msg: "already_exists", orderId })
      }

      const orderData = payload.order
      if (!orderData) {
        logger.warn("webhook-99food", "ORDER_CREATED sem objeto de pedido", { requestId: getRequestId(req) })
        return NextResponse.json({ ok: true, msg: "no_order_data" })
      }

      try {
        const mapped = map99FoodOrderToFlow(orderData, est.id, eventType)
        mapped.externalDisplayId = orderData.displayId || null

        // Customer info from order root level
        const customerData = {
          name: orderData.customerName || orderData.customer?.name || null,
          phone: orderData.customerPhone || orderData.customer?.phone || null,
          email: orderData.customerEmail || orderData.customer?.email || null,
          address: orderData.delivery?.deliveryAddress?.formattedAddress || null,
        }

        const customer = customerData.phone
          ? await upsert99FoodCustomer(est.id, customerData)
          : null

        const createdOrder = await prisma.order.create({
          data: {
            ...mapped,
            externalId: orderId,
            ...(customer?.id && { customerId: customer.id }),
            cashbackEarned: calcCashbackEarned(mapped.total || 0, est),
          },
        })
        // Deduct stock for 99Food order items
        try {
          const items = JSON.parse(mapped.items || "[]")
          await prisma.$transaction(async (tx) => {
            await deductOrderStock(tx, items, createdOrder.id, est.id, true)
          })
        } catch (stockErr: any) {
          logger.error("webhook-99food", "falha ao debitar estoque do pedido", { requestId: getRequestId(req), orderId, error: stockErr?.message })
        }
        created++
        logger.info("webhook-99food", "pedido criado", { requestId: getRequestId(req), orderId })
      } catch (e: any) {
        logger.error("webhook-99food", "falha ao criar o pedido", { requestId: getRequestId(req), orderId, error: e?.message })
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
      }
    }

    // === ORDER_CANCELLED / ORDER_CANCELED ===
    else if (eventType === "ORDER_CANCELLED" || eventType === "ORDER_CANCELED") {
      const existing = await prisma.order.findFirst({
        where: { establishmentId: est.id, externalId: orderId },
      })
      if (existing) {
        if (existing.status === "cancelled") {
          logger.info("webhook-99food", "pedido já cancelado", { requestId: getRequestId(req), orderId })
        } else {
        const reason = payload.reason || payload.cancellationReason || null
        const cancelledBy = payload.cancelledBy || "customer"

        await prisma.$transaction(async (tx) => {
          await tx.cancellationLog.create({
            data: {
              establishmentId: existing.establishmentId,
              orderId: existing.id,
              source: "99food",
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
          // Restore stock (guard contra estorno em dobro) e mantém o registro
          // cancelado em vez de hard delete (F5A-011).
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
        logger.info("webhook-99food", "pedido cancelado", { requestId: getRequestId(req), orderId })
        }
      } else {
        // F4A-008: antes o `if (existing)` não tinha `else` — o evento
        // (ex.: cancelamento que chegou antes do create) era descartado
        // sem nenhum rastro. Agora fica registrado e devolve 500 para a
        // 99Food reenviar depois que o pedido existir.
        logger.warn("webhook-99food", "ORDER_CANCELLED para pedido inexistente", {
          requestId: getRequestId(req),
          orderId,
          eventId: payload?.eventId || payload?.id || null,
        })
        results.push({ orderId, action: 'not_found_for_cancel' })
        return NextResponse.json({ ok: false, error: "pedido não encontrado" }, { status: 500 })
      }
    }

    // === ORDER_STATUS_CHANGED ===
    else if (eventType === "ORDER_STATUS_CHANGED") {
      const existing = await prisma.order.findFirst({
        where: { establishmentId: est.id, externalId: orderId },
      })
      if (existing) {
        const newStatus = payload.status || payload.order?.status || ""
        const statusMap: Record<string, string> = {
          CONFIRMED: "confirmed",
          PREPARING: "preparing",
          READY: "ready",
          DISPATCHED: "out_for_delivery",
          DELIVERED: "delivered",
          CANCELLED: "cancelled",
        }
        // Fora do mapa não grava string arbitrária (mesma regra do webhooks/99)
        const flowStatus = statusMap[newStatus] || null

        if (!flowStatus) {
          logger.info("webhook-99food", "status desconhecido — ignorado", { requestId: getRequestId(req), orderId, newStatus })
          return NextResponse.json({ ok: true, msg: "skipped" })
        }
        if (existing.status === "cancelled") {
          logger.info("webhook-99food", "cancelado é terminal — ignorado", { requestId: getRequestId(req), orderId })
          return NextResponse.json({ ok: true, msg: "skipped" })
        }
        if (existing.status === "delivered" && flowStatus !== "delivered") {
          logger.info("webhook-99food", "downgrade de status ignorado", { requestId: getRequestId(req), orderId })
          return NextResponse.json({ ok: true, msg: "skipped" })
        }

        if (flowStatus === "cancelled") {
          // Cancel via STATUS_CHANGED também estorna (senão o estoque fica
          // debitado — mesma regra do evento ORDER_CANCELLED).
          await prisma.$transaction(async (tx) => {
            await restoreOrderStock(tx, existing.items, existing.id, existing.establishmentId)
            await tx.order.update({
              where: { id: existing.id },
              data: {
                status: "cancelled",
                paymentStatus: existing.paymentStatus === "paid" ? "refunded" : "cancelled",
                cancellationReason: "Cancelado pela 99",
                cancellationDate: new Date(),
                cancelledBy: "system",
              },
            })
          })
        } else {
          await prisma.order.update({
            where: { id: existing.id },
            data: { status: flowStatus },
          })
        }
        updated++
        logger.info("webhook-99food", "status do pedido alterado", { requestId: getRequestId(req), orderId, flowStatus })
      } else {
        // F4A-008: evento de status sem pedido correspondente — sem rastro
        logger.warn("webhook-99food", "ORDER_STATUS_CHANGED para pedido inexistente", {
          requestId: getRequestId(req),
          orderId,
          eventId: payload?.eventId || payload?.id || null,
        })
        results.push({ orderId, action: 'not_found_for_update' })
        return NextResponse.json({ ok: false, error: "pedido não encontrado" }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true, created, updated })
  } catch (err: any) {
    logger.error("webhook-99food", "falha ao processar o evento", {
      requestId: getRequestId(req),
      error: err.message,
    })
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
