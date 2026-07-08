import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)

  if (!body?.payment?.id) {
    return NextResponse.json({ received: true })
  }

  // Process in background - return 200 immediately
  processWebhook(body).catch((err) => {
    console.error("[Asaas Webhook] Background error:", err.message)
  })

  return NextResponse.json({ received: true })
}

async function processWebhook(body: { event: string; payment: Record<string, unknown> }) {
  const { payment } = body
  const paymentId = payment.id as string
  const paymentStatus = payment.status as string

  console.log("[Asaas Webhook] Processing:", paymentId, paymentStatus)

  const order = await prisma.order.findFirst({
    where: { paymentId },
  })

  if (!order) {
    console.log("[Asaas Webhook] Order not found for paymentId:", paymentId)
    return
  }

  const paymentStatusMap: Record<string, string> = {
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

  const orderStatusMap: Record<string, string> = {
    RECEIVED: "confirmed",
    RECEIVED_IN_CASH: "confirmed",
    CONFIRMED: "confirmed",
    SETTLED: "confirmed",
    OVERDUE: "cancelled",
  }

  const newPaymentStatus = paymentStatusMap[paymentStatus] || "pending"
  const newOrderStatus = orderStatusMap[paymentStatus]

  const updateData: Record<string, unknown> = {}
  if (order.paymentStatus !== newPaymentStatus) updateData.paymentStatus = newPaymentStatus
  if (newOrderStatus && order.status !== newOrderStatus) updateData.status = newOrderStatus

  if (Object.keys(updateData).length > 0) {
    await prisma.order.update({
      where: { id: order.id },
      data: updateData,
    })
    console.log("[Asaas Webhook] Order #", order.orderNumber, "updated:", updateData)
  }
}
