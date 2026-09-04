import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createPagarmeCustomer, createCardTransaction } from "@/lib/integrations/pagarme"
import { getPagarmeConfig } from "@/lib/pagarme-config"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orderId, installments, establishmentId, creditCard, creditCardHolderInfo } = body

    if (!orderId || !establishmentId) {
      return NextResponse.json({ error: "orderId e establishmentId obrigatórios" }, { status: 400 })
    }

    if (!creditCard?.number || !creditCard?.expiry || !creditCard?.cvv) {
      return NextResponse.json({ error: "Dados do cartão obrigatórios" }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        establishment: { select: { id: true, name: true, pagarmeSplitReceiverId: true } },
        customer: { select: { id: true, name: true, phone: true, cpf: true, email: true } },
      },
    })

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    if (order.establishmentId !== establishmentId) {
      return NextResponse.json({ error: "Pedido não pertence a este estabelecimento" }, { status: 403 })
    }

    const { apiKey } = await getPagarmeConfig()
    if (!apiKey) {
      return NextResponse.json({ error: "Pagar.me não configurado no servidor" }, { status: 500 })
    }

    // Create Pagar.me customer
    const customer = await createPagarmeCustomer({
      apiKey,
      name: creditCardHolderInfo?.name || order.customerName || order.customer?.name || "",
      email: creditCardHolderInfo?.email || order.customer?.email || `${(order.customerPhone || "").replace(/\D/g, "")}@pedidoflow.com`,
      phone: creditCardHolderInfo?.phone || order.customerPhone || order.customer?.phone || "",
      document: creditCardHolderInfo?.cpf || order.customer?.cpf || "",
    })

    // Build split rules
    const configData = await getPagarmeConfig()
    const saasRecipientId = configData.saasRecipientId
    const totalCommission = Math.round((configData.feePercentage || 1.09) + (configData.saasProfitPercentage || 0.41))
    const establishmentPercentage = 100 - totalCommission

    const splitRules = (order.establishment.pagarmeSplitReceiverId && saasRecipientId)
      ? [
          {
            recipientId: saasRecipientId,
            type: "percentage" as const,
            amount: totalCommission,
            options: { chargeProcessingFee: false, chargeRemainderFee: false, liable: true },
          },
          {
            recipientId: order.establishment.pagarmeSplitReceiverId,
            type: "percentage" as const,
            amount: establishmentPercentage,
            options: { chargeProcessingFee: true, chargeRemainderFee: true, liable: false },
          },
        ]
      : []

    const transaction = await createCardTransaction({
      apiKey,
      customerId: customer.id,
      amount: order.total,
      description: `Pedido #${order.orderNumber} - ${order.establishment.name}`,
      orderId: order.id,
      creditCard,
      creditCardHolderInfo,
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
