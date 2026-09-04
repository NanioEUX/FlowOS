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
      select: {
        id: true,
        orderNumber: true,
        total: true,
        customerName: true,
        customerPhone: true,
        customerAddress: true,
        establishmentId: true,
        establishment: { select: { id: true, name: true, pagarmeSplitReceiverId: true } },
        customer: { select: { id: true, name: true, phone: true, cpf: true, email: true, cep: true } },
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

    // Get establishment address as fallback for billing
    const estab = await prisma.establishment.findUnique({
      where: { id: establishmentId },
      select: { address: true },
    })

    // Merge billing info: prefer order customer address, fallback to establishment
    const billingInfo = {
      ...creditCardHolderInfo,
      cep: creditCardHolderInfo?.cep || order.customer?.cep || "",
      address: creditCardHolderInfo?.address || order.customerAddress || estab?.address || "",
      city: creditCardHolderInfo?.city || "",
      state: creditCardHolderInfo?.state || "",
    }

    // Create Pagar.me customer
    const customer = await createPagarmeCustomer({
      apiKey,
      name: creditCardHolderInfo?.name || order.customerName || order.customer?.name || "",
      email: creditCardHolderInfo?.email || order.customer?.email || `${(order.customerPhone || "").replace(/\D/g, "")}@pedidoflow.com`,
      phone: creditCardHolderInfo?.phone || order.customerPhone || order.customer?.phone || "",
      document: creditCardHolderInfo?.cpf || order.customer?.cpf || "",
    })

    // Build split rules (SaaS profit only - Pagar.me fee is automatic)
    const configData = await getPagarmeConfig()
    const saasRecipientId = configData.saasRecipientId
    const saasProfit = configData.saasProfitPercentage || 0

    const splitRules = (order.establishment.pagarmeSplitReceiverId && saasRecipientId && saasProfit > 0)
      ? [
          {
            recipientId: saasRecipientId,
            type: "percentage" as const,
            amount: Math.max(1, Math.round(saasProfit)),
            options: { chargeProcessingFee: true, chargeRemainderFee: true, liable: true },
          },
          {
            recipientId: order.establishment.pagarmeSplitReceiverId,
            type: "percentage" as const,
            amount: 100 - Math.max(1, Math.round(saasProfit)),
            options: { chargeProcessingFee: false, chargeRemainderFee: false, liable: false },
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
      creditCardHolderInfo: billingInfo,
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
    return NextResponse.json({ error: error.message || "Erro ao processar cartão" }, { status: 500 })
  }
}
