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
    let skipped = 0
    let errors = 0
    const details: any[] = []

    for (const est of establishments) {
      const { accessToken } = await getIfoodAuth(
        process.env.IFOOD_CLIENT_ID!,
        process.env.IFOOD_CLIENT_SECRET!
      )

      const events = await getIfoodEvents(accessToken, est.ifoodMerchantId!)

      if (showDetail) {
        details.push({ est: est.name, totalEvents: events.length, codes: events.map((e: any) => e.code) })
      }

      for (const event of events) {
        if (!["PLACED", "PLC", "CFM", "CONFIRMED"].includes(event.code)) {
          skipped++
          continue
        }

        try {
          const existing = await prisma.order.findFirst({
            where: { establishmentId: est.id, externalId: event.orderId },
          })
          if (existing) {
            skipped++
            continue
          }

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

    return NextResponse.json({ ok: true, created, skipped, errors, details: showDetail ? details : undefined, establishmentsCount: establishments.length })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: String(err?.message || err), stack: err?.stack }, { status: 500 })
  }
}
