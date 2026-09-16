import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { map99FoodOrderToFlow } from "@/lib/integrations/nine-food"
import { upsert99FoodCustomer } from "@/lib/integrations/nine-food-customer"

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text()
    console.log("[99food webhook] HIT", new Date().toISOString(), "body-len=", raw.length)

    const payload = JSON.parse(raw)
    console.log("[99food webhook] payload:", JSON.stringify(payload).slice(0, 500))

    // Parse events - handle both single event and array formats
    let events: any[] = []
    if (Array.isArray(payload)) {
      events = payload
    } else if (payload.orderId || payload.id || payload.code) {
      events = [payload]
    } else if (payload.events && Array.isArray(payload.events)) {
      events = payload.events
    } else {
      events = [payload]
    }

    if (events.length === 0) {
      return NextResponse.json({ ok: true, msg: "noop" })
    }

    console.log("[99food webhook] received", events.length, "events")

    // Find establishments with 99Food enabled
    const establishments = await prisma.establishment.findMany({
      where: { nineFoodEnabled: true, nineFoodMerchantId: { not: null } },
    })

    if (establishments.length === 0) {
      return NextResponse.json({ ok: true, msg: "no establishment enabled" })
    }

    // Helper: find the correct establishment for an event
    async function findEstablishment(orderId: string) {
      const existingOrder = await prisma.order.findFirst({
        where: { externalId: orderId },
        select: { establishmentId: true },
      })
      if (existingOrder) {
        return establishments.find((e) => e.id === existingOrder.establishmentId) || establishments[0]
      }
      return establishments[0]
    }

    let created = 0
    let updated = 0
    const results: any[] = []

    for (const event of events) {
      const code = event.code || event.fullCode || event.event || event.status || ""
      const orderId = event.orderId || event.id || event.order?.id || ""

      console.log("[99food webhook] processing event", { code, orderId: orderId?.slice(0, 8) })

      if (!orderId) {
        console.log("[99food webhook] no orderId, skipping")
        continue
      }

      const est = await findEstablishment(orderId)

      // Handle new orders (PLACED, NEW, etc.)
      if (["PLACED", "NEW", "placed", "new", "CREATED", "created"].includes(code)) {
        const existing = await prisma.order.findFirst({
          where: { establishmentId: est.id, externalId: orderId },
        })

        if (!existing) {
          try {
            // Try to get order data from event payload
            const orderData = event.fullOrder || event.order || event

            // Check if we have enough data to create the order
            const hasItems = Array.isArray(orderData.items) ||
                            Array.isArray(orderData.orderItems) ||
                            Array.isArray(orderData.products)

            if (hasItems) {
              const mapped = map99FoodOrderToFlow(orderData, est.id, code)
              const customer = await upsert99FoodCustomer(est.id, orderData.customer || orderData)

              await prisma.order.create({
                data: {
                  ...mapped,
                  externalId: orderId,
                  ...(customer?.id && { customerId: customer.id }),
                },
              })
              created++
              results.push({ orderId, action: "created" })
              console.log("[99food webhook] SAVED order", orderId)
            } else {
              // No items in event, save placeholder
              console.log("[99food webhook] event without items, saving placeholder", orderId)
              const placeholder = {
                establishmentId: est.id,
                customerName: "Aguardando 99Food",
                customerPhone: "",
                total: 0,
                items: JSON.stringify([]),
                method: "99food" as const,
                status: "pending" as const,
                paymentStatus: "pending" as const,
                orderType: "delivery" as const,
                paymentMethod: "online" as const,
              }
              await prisma.order.create({
                data: { ...placeholder, externalId: orderId },
              })
              created++
              results.push({ orderId, action: "created_placeholder" })
              console.log("[99food webhook] SAVED placeholder order", orderId)
            }
          } catch (e: any) {
            console.error("[99food webhook] CREATE ERROR", orderId, e.message)
            results.push({ orderId, action: "create_error", error: e.message })
          }
        } else {
          results.push({ orderId, action: "already_exists" })
        }
      }
      // Handle cancellations
      else if (["CANCELLED", "cancelled", "CANCELED", "canceled", "CANCEL"].includes(code)) {
        const existing = await prisma.order.findFirst({
          where: { establishmentId: est.id, externalId: orderId },
        })
        if (existing) {
          const reason = event.reason || event.metadata?.reason || null
          const cancelledBy = event.cancelledBy || event.metadata?.cancelledBy || "system"

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
          results.push({ orderId, action: "cancelled", reason })
        } else {
          results.push({ orderId, action: "not_found_for_cancel" })
        }
      }
      // Handle status updates
      else if (["CONFIRMED", "confirmed", "PREPARING", "preparing", "READY", "ready",
               "DISPATCHED", "dispatched", "DELIVERED", "delivered"].includes(code)) {
        const existing = await prisma.order.findFirst({
          where: { establishmentId: est.id, externalId: orderId },
        })
        if (existing) {
          const newStatus = code === "DELIVERED" || code === "delivered" ? "delivered"
            : code === "DISPATCHED" || code === "dispatched" ? "out_for_delivery"
            : code === "READY" || code === "ready" ? "ready"
            : code === "PREPARING" || code === "preparing" ? "preparing"
            : code === "CONFIRMED" || code === "confirmed" ? "confirmed"
            : "preparing"

          // Don't downgrade a manually-completed order
          if (existing.status === "delivered" && newStatus !== "delivered") {
            results.push({ orderId, action: "skipped_manual_done" })
            continue
          }

          await prisma.order.update({
            where: { id: existing.id },
            data: { status: newStatus },
          })
          updated++
          results.push({ orderId, action: "updated", status: newStatus })
        } else {
          results.push({ orderId, action: "not_found_for_update" })
        }
      }
    }

    return NextResponse.json({ ok: true, created, updated, results })
  } catch (err: any) {
    console.error("[99food webhook] error:", err.message)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
