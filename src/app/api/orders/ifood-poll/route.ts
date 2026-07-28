import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getIfoodAuth, getIfoodEvents, getIfoodOrder, mapIfoodOrderToFlow } from "@/lib/integrations/ifood"
import { upsertIfoodCustomer } from "@/lib/integrations/ifood-customer"

export async function POST(req: Request) {
  try {
    const url = new URL(req.url)
    const showDetail = url.searchParams.has("detail")

    const establishments = await prisma.establishment.findMany({
      where: { ifoodEnabled: true, ifoodMerchantId: { not: null } },
    })

    let created = 0
    let updated = 0
    let skipped = 0
    let errors = 0
    const details: any[] = []

    for (const est of establishments) {
      const { accessToken } = await getIfoodAuth(
        process.env.IFOOD_CLIENT_ID!,
        process.env.IFOOD_CLIENT_SECRET!
      )

      const rawEvents = await getIfoodEvents(accessToken, est.ifoodMerchantId!)
      const events: any[] = Array.isArray(rawEvents) ? rawEvents : []

      if (showDetail) {
        details.push({ est: est.name, totalEvents: events.length, codes: events.map((e: any) => e?.code) })
      }

      for (const event of events) {
        const isNewOrder = ["PLACED", "PLC", "CFM", "CONFIRMED"].includes(event.code)
        const isUpdate = ["DSP", "DISPATCHED", "CON", "CONCLUDED"].includes(event.code)
        if (!isNewOrder && !isUpdate) {
          skipped++
          continue
        }

        try {
          const existing = await prisma.order.findFirst({
            where: { establishmentId: est.id, externalId: event.orderId },
          })

          // For status updates (DSP/CON), update the existing order in place.
          if (existing && isUpdate) {
            const newStatus = event.code === 'CON' || event.code === 'CONCLUDED' ? 'delivered' : 'out_for_delivery'

            // Don't downgrade a manually-completed order back to a delivery
            // status. Once the operator marks "delivered" the iFood event
            // could still be a few seconds behind.
            if (existing.status === "delivered" && newStatus !== "delivered") {
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

          if (existing) {
            // Placeholders created from PLC without items should be filled
            // when a later event (CFM) brings the full order.
            const isPlaceholder =
              existing.customerName === "Aguardando iFood" ||
              (existing.items === "[]" && (!existing.total || existing.total === 0))
            if (!isPlaceholder) {
              skipped++
              continue
            }
            // Fetch full details and update the placeholder in place.
            try {
              const order = await getIfoodOrder(accessToken, est.ifoodMerchantId!, event.orderId)
              if (order && order.items && order.items.length > 0) {
                const mapped = mapIfoodOrderToFlow(order, est.id, event.code)
                const customer = await upsertIfoodCustomer(est.id, order.customer)
                await prisma.order.update({
                  where: { id: existing.id },
                  data: { ...mapped, externalId: event.orderId, customerId: customer?.id }
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
            await prisma.order.create({
              data: { ...mapped, externalId: event.orderId, customerId: customer?.id }
            })
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
    console.error(err)
    return NextResponse.json({ error: String(err?.message || err), stack: err?.stack }, { status: 500 })
  }
}
