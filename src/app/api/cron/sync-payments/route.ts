import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const ASAAS_API_URL =
  process.env.ASAAS_ENVIRONMENT === "sandbox"
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3"

const PAYMENT_STATUS_MAP: Record<string, string> = {
  AWAITING_RISK_ANALYSIS: "pending",
  PENDING: "pending",
  EXECUTE_SCHEDULED: "pending",
  RECEIVED: "paid",
  RECEIVED_IN_CASH: "paid",
  CONFIRMED: "paid",
  OVERDUE: "overdue",
  REFUNDED: "refunded",
  REFUND_REQUESTED: "refund_requested",
  SETTLED: "paid",
}

const ORDER_STATUS_MAP: Record<string, string> = {
  RECEIVED: "confirmed",
  RECEIVED_IN_CASH: "confirmed",
  CONFIRMED: "confirmed",
  SETTLED: "confirmed",
  OVERDUE: "cancelled",
}

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[Cron Sync] Starting payment sync...")

    const fifteenMinAgo = new Date()
    fifteenMinAgo.setMinutes(fifteenMinAgo.getMinutes() - 15)

    const ordersToSync = await prisma.order.findMany({
      where: {
        paymentId: { not: null },
        paymentStatus: { notIn: ["paid", "refunded"] },
        createdAt: { gte: fifteenMinAgo },
      },
      include: { establishment: { select: { asaasApiKey: true, id: true } } },
    })

    console.log(`[Cron Sync] Found ${ordersToSync.length} orders to sync`)

    if (!ordersToSync.length) {
      return NextResponse.json({ synced: 0, message: "Nothing to sync" })
    }

    // Group by establishment to reuse API key
    const byEstablishment = new Map<string, typeof ordersToSync>()
    for (const order of ordersToSync) {
      const key = order.establishmentId
      if (!byEstablishment.has(key)) byEstablishment.set(key, [])
      byEstablishment.get(key)!.push(order)
    }

    let synced = 0
    let errors = 0

    for (const [estId, orders] of byEstablishment) {
      const apiKey = orders[0].establishment.asaasApiKey
      if (!apiKey) continue

      for (const order of orders) {
        try {
          const res = await fetch(`${ASAAS_API_URL}/payments/${order.paymentId}`, {
            headers: { access_token: apiKey },
          })

          if (!res.ok) {
            errors++
            continue
          }

          const payment = await res.json()
          const newPaymentStatus = PAYMENT_STATUS_MAP[payment.status] || "pending"
          const newOrderStatus = ORDER_STATUS_MAP[payment.status]

          const updateData: Record<string, unknown> = {}
          if (order.paymentStatus !== newPaymentStatus) updateData.paymentStatus = newPaymentStatus
          if (newOrderStatus && order.status !== newOrderStatus) updateData.status = newOrderStatus

          if (Object.keys(updateData).length > 0) {
            await prisma.order.update({
              where: { id: order.id },
              data: updateData,
            })
            synced++
            console.log(`[Cron Sync] Order #${order.orderNumber}: ${order.paymentStatus} -> ${newPaymentStatus}`)
          }
        } catch {
          errors++
        }
      }
    }

    console.log(`[Cron Sync] Done. Synced: ${synced}, Errors: ${errors}`)

    return NextResponse.json({ synced, errors, total: ordersToSync.length })
  } catch (error: any) {
    console.error("[Cron Sync] Error:", error.message)
    return NextResponse.json({ error: "Sync failed" }, { status: 500 })
  }
}
