import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { mapPagarmeStatus, verifyPagarmeSignature } from "@/lib/integrations/pagarme"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Verify webhook signature if secret is configured
  const webhookKey = process.env.PAGARME_WEBHOOK_KEY
  if (webhookKey) {
    const signature = req.headers.get("x-hub-signature-256") || req.headers.get("x-pagarme-signature") || ""
    if (!verifyPagarmeSignature(rawBody, signature, webhookKey)) {
      console.warn("[Pagar.me Webhook] Invalid signature")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ received: true })
  }

  console.log("[Pagar.me Webhook] Event:", body?.event || body?.type, "| data:", JSON.stringify(body?.data || body).substring(0, 200))

  // Pagar.me v5 webhook format: { event: "order.paid", data: { ... } }
  const eventType = body?.event || body?.type
  const orderData = body?.data

  if (!eventType || !orderData) {
    return NextResponse.json({ received: true })
  }

  processWebhook(eventType, orderData).catch((err) => {
    console.error("[Pagar.me Webhook] Background error:", err.message)
  })

  return NextResponse.json({ received: true })
}

async function processWebhook(eventType: string, orderData: any) {
  const orderId = orderData?.id as string

  if (!orderId) {
    console.log("[Pagar.me Webhook] No order ID in webhook data")
    return
  }

  console.log("[Pagar.me Webhook] Processing:", orderId, eventType)

  // Find order by paymentId (which stores the Pagar.me order ID)
  const order = await prisma.order.findFirst({
    where: { paymentId: String(orderId) },
  })

  if (!order) {
    console.log("[Pagar.me Webhook] Order not found for paymentId:", orderId)
    return
  }

  // Map event to status
  let eventStatus = ""
  if (eventType.includes("paid") || eventType.includes("captured")) {
    eventStatus = "paid"
  } else if (eventType.includes("canceled") || eventType.includes("refused")) {
    eventStatus = "canceled"
  } else if (eventType.includes("refunded")) {
    eventStatus = "refunded"
  } else if (eventType.includes("pending")) {
    eventStatus = "pending"
  }

  // Also check charge status if available
  const charges = orderData?.charges || []
  if (charges.length > 0) {
    const charge = charges[0]
    if (charge.status === "paid" || charge.last_transaction_status === "paid") {
      eventStatus = "paid"
    } else if (charge.status === "canceled") {
      eventStatus = "canceled"
    }
  }

  const { paymentStatus, orderStatus } = mapPagarmeStatus(eventStatus || eventType)

  const updateData: Record<string, unknown> = {}
  if (order.paymentStatus !== paymentStatus) updateData.paymentStatus = paymentStatus
  if (orderStatus && order.status !== orderStatus) updateData.status = orderStatus

  if (Object.keys(updateData).length > 0) {
    await prisma.order.update({
      where: { id: order.id },
      data: updateData,
    })
    console.log("[Pagar.me Webhook] Order #", order.orderNumber, "updated:", updateData)
  }
}
