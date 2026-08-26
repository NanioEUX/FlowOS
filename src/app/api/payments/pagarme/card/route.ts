import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createCardTransaction } from "@/lib/integrations/pagarme"

export async function POST(req: NextRequest) {
  try {
    const { orderId, cardToken, installments } = await req.json()

    if (!orderId || !cardToken) {
      return NextResponse.json({ error: "orderId e cardToken obrigatórios" }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { establishment: { select: { pagarmeApiKey: true, name: true, pagarmeEnvironment: true, pagarmeSplitReceiverId: true } } },
    })

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    if (!order.establishment.pagarmeApiKey) {
      return NextResponse.json({ error: "API Key do Pagar.me não configurada" }, { status: 400 })
    }

    if (!order.paymentId) {
      return NextResponse.json({ error: "Pedido não possui transação Pagar.me" }, { status: 400 })
    }

    // First, try to get or create the customer
    const apiKey = order.establishment.pagarmeApiKey
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

    const splitRules = order.establishment.pagarmeSplitReceiverId
      ? [{
          walletId: order.establishment.pagarmeSplitReceiverId,
          percentual: 100, // O receiver fica com 100% quando configurado (ou poderia ser uma porcentagem)
          description: "Recebedor Stone configurado pelo estabelecimento"
        }]
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
