import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createCardTransaction } from "@/lib/integrations/pagarme"

export async function POST(req: NextRequest) {
  try {
    const { orderId, cardToken, installments, establishmentId } = await req.json()

    if (!orderId || !cardToken || !establishmentId) {
      return NextResponse.json({ error: "orderId, cardToken e establishmentId obrigatórios" }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { establishment: { select: { id: true, name: true, pagarmeSplitReceiverId: true, saasCommissionPercentage: true } } },
    })

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    if (order.establishmentId !== establishmentId) {
      return NextResponse.json({ error: "Pedido não pertence a este estabelecimento" }, { status: 403 })
    }

    // API Key comes from global config (admin SaaS)
    const { getPagarmeConfig } = await import("@/lib/pagarme-config")
    const { apiKey } = await getPagarmeConfig()
    if (!apiKey) {
      return NextResponse.json({ error: "Pagar.me não configurado no servidor" }, { status: 500 })
    }

    if (!order.paymentId) {
      return NextResponse.json({ error: "Pedido não possui transação Pagar.me" }, { status: 400 })
    }

    // First, try to get or create the customer
    const apiUrl = "https://api.pagar.me/core/v5"
    const authHeader = `Basic ${Buffer.from(apiKey + ":").toString("base64")}`

    // Get the existing order to find customer_id
    const existingOrder = await fetch(`${apiUrl}/orders/${order.paymentId}`, {
      headers: { "Authorization": authHeader },
    })
    const orderDetails = await existingOrder.json()

    if (!orderDetails.customer_id) {
      return NextResponse.json({ error: "Cliente não associado à transação" }, { status: 400 })
    }

    // Build split rules for Pagar.me V5
    const configData = await getPagarmeConfig()
    const saasRecipientId = configData.saasRecipientId
    const totalCommission = (configData.feePercentage || 1.09) + (configData.saasProfitPercentage || 0.41)
    const establishmentPercentage = 100 - totalCommission
    
    const splitRules = (order.establishment.pagarmeSplitReceiverId && saasRecipientId)
      ? [
          {
            recipientId: saasRecipientId,
            type: "percentage" as const,
            amount: totalCommission,
            options: {
              chargeProcessingFee: false,
              chargeRemainderFee: false,
              liable: true,
            },
          },
          {
            recipientId: order.establishment.pagarmeSplitReceiverId,
            type: "percentage" as const,
            amount: establishmentPercentage,
            options: {
              chargeProcessingFee: true,
              chargeRemainderFee: true,
              liable: false,
            },
          },
        ]
      : []

    const transaction = await createCardTransaction({
      apiKey,
      customerId: orderDetails.customer_id,
      amount: order.total,
      description: `Pedido #${order.orderNumber} - ${order.establishment.name}`,
      orderId: order.id,
      cardToken,
      installments,
      splitRules,
    })

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentId: String(transaction.id),
        paymentStatus: "pending",
        status: "payment_pending",
      },
    })

    return NextResponse.json({
      transactionId: transaction.id,
      status: transaction.status,
    })
  } catch (error: any) {
    console.error("[Pagar.me Card] Error:", error.message)
    return NextResponse.json({ error: "Erro ao processar cartão", details: error.message }, { status: 500 })
  }
}
