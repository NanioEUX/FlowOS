import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { mapPagarmeStatus, verifyPagarmeSignature } from "@/lib/integrations/pagarme"
import { getPagarmeConfig } from "@/lib/pagarme-config"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Get webhook key from config (database or env fallback)
  const config = await getPagarmeConfig()
  const webhookKey = config.webhookKey

  // Verify webhook signature if secret is configured
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
  let totalFee = 0
  let saasAmount = 0
  let establishmentAmount = 0

  if (charges.length > 0) {
    const charge = charges[0]
    if (charge.status === "paid" || charge.last_transaction_status === "paid") {
      eventStatus = "paid"
    } else if (charge.status === "canceled") {
      eventStatus = "canceled"
    }

    // Capture fees from charge
    totalFee = charge.fee || 0
    
    // Capture split amounts
    const split = charge.split || []
    for (const s of split) {
      if (s.recipient_id === process.env.PAGARME_SAAS_RECIPIENT_ID) {
        saasAmount = s.amount || 0
      } else {
        establishmentAmount = s.amount || 0
      }
    }
  }

  const { paymentStatus, orderStatus } = mapPagarmeStatus(eventStatus || eventType)

  // Check if autoAcceptOrders is enabled for this establishment
  let finalOrderStatus = orderStatus
  if (eventStatus === "paid" && orderStatus === "confirmed") {
    const establishment = await prisma.establishment.findUnique({
      where: { id: order.establishmentId },
      select: { autoAcceptOrders: true },
    })
    if (establishment?.autoAcceptOrders) {
      finalOrderStatus = "preparing"
    }
  }

  const updateData: Record<string, unknown> = {}
  if (order.paymentStatus !== paymentStatus) updateData.paymentStatus = paymentStatus
  if (finalOrderStatus && order.status !== finalOrderStatus) updateData.status = finalOrderStatus

  if (Object.keys(updateData).length > 0) {
    await prisma.order.update({
      where: { id: order.id },
      data: updateData,
    })
    console.log("[Pagar.me Webhook] Order #", order.orderNumber, "updated:", updateData)
  }

  // Log financial data for paid transactions
  if (eventStatus === "paid" && totalFee > 0) {
    console.log("[Pagar.me Webhook] Financial log:", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.total,
      totalFee: totalFee / 100,
      saasAmount: saasAmount / 100,
      establishmentAmount: establishmentAmount / 100,
    })
    
    // Save to financial_transactions table
    await prisma.financialTransaction.create({
      data: {
        establishmentId: order.establishmentId,
        orderId: order.id,
        paymentId: String(orderId),
        provider: "pagarme",
        type: "payment",
        status: "paid",
        grossAmount: order.total,
        fee: totalFee,
        netAmount: order.total - totalFee,
        splitSaas: saasAmount,
        splitEstablishment: establishmentAmount,
        metadata: charges[0] || null,
      },
    })
  }
}
