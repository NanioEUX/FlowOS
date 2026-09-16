import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { map99FoodOrderToFlow } from "@/lib/integrations/nine-food"
import { upsert99FoodCustomer } from "@/lib/integrations/nine-food-customer"

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
    console.log("[99food webhook] HIT", new Date().toISOString(), "body-len=", raw.length)

    const payload = JSON.parse(raw)
    console.log("[99food webhook] payload:", JSON.stringify(payload).slice(0, 500))

    const eventType = payload.eventType || payload.event || ""
    const orderId = payload.orderId || payload.id || ""
    const shopId = payload.shopId || ""
    const eventDate = payload.createdAt || ""

    console.log("[99food webhook] event:", { eventType, orderId, shopId })

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
        console.warn("[99food webhook] ORDER_CREATED without order object")
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

        await prisma.order.create({
          data: {
            ...mapped,
            externalId: orderId,
            ...(customer?.id && { customerId: customer.id }),
          },
        })
        created++
        console.log("[99food webhook] CREATED order", orderId)
      } catch (e: any) {
        console.error("[99food webhook] CREATE ERROR", orderId, e.message)
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
      }
    }

    // === ORDER_CANCELLED / ORDER_CANCELED ===
    else if (eventType === "ORDER_CANCELLED" || eventType === "ORDER_CANCELED") {
      const existing = await prisma.order.findFirst({
        where: { establishmentId: est.id, externalId: orderId },
      })
      if (existing) {
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
          await tx.order.delete({ where: { id: existing.id } })
        })
        updated++
        console.log("[99food webhook] CANCELLED order", orderId)
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
        const flowStatus = statusMap[newStatus] || newStatus.toLowerCase()

        if (existing.status === "delivered" && flowStatus !== "delivered") {
          console.log("[99food webhook] skipping downgrade", orderId)
          return NextResponse.json({ ok: true, msg: "skipped" })
        }

        await prisma.order.update({
          where: { id: existing.id },
          data: { status: flowStatus },
        })
        updated++
        console.log("[99food webhook] STATUS_CHANGED", orderId, flowStatus)
      }
    }

    return NextResponse.json({ ok: true, created, updated })
  } catch (err: any) {
    console.error("[99food webhook] error:", err.message)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
