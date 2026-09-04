import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createPagarmeCustomer, createCardTransaction } from "@/lib/integrations/pagarme"
import { getPagarmeConfig } from "@/lib/pagarme-config"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orderId, installments, establishmentId, creditCard, creditCardHolderInfo, cardToken } = body

    if (!orderId || !establishmentId) {
      return NextResponse.json({ error: "orderId e establishmentId obrigatórios" }, { status: 400 })
    }

    // Pagar.me V5 exige card_token (PCI-DSS) ou cartão raw (rejeitado por padrão).
    // Aceitamos apenas o caminho tokenizado do front.
    if (!cardToken) {
      return NextResponse.json(
        { error: "Token do cartão não enviado. Use o SDK Pagar.me no frontend (PagarMe.encryptCard)." },
        { status: 400 }
      )
    }

    // Captura IP real do cliente (Vercel/Cloudflare passam via X-Forwarded-For).
    // Sem isso o antifraude vê o IP do seu servidor e barra tudo.
    const forwarded = req.headers.get("x-forwarded-for") || ""
    const realIp = req.headers.get("x-real-ip") || ""
    const cfIp = req.headers.get("cf-connecting-ip") || ""
    const clientIp = (forwarded.split(",")[0] || "").trim() || realIp.trim() || cfIp.trim() || ""

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

    // Get establishment address as fallback for shipping only
    const estab = await prisma.establishment.findUnique({
      where: { id: establishmentId },
      select: { address: true },
    })

    // IMPORTANTE: billing_address é o endereço de COBRANÇA do cartão
    // (cadastro do cartão), NÃO o endereço de entrega.
    // shipping_address é o endereço de ENTREGA do pedido.
    // Se o front não enviar billing próprio, mandamos um placeholder —
    // nunca o endereço de entrega, para não confundir o antifraude.
    const billingCep = (creditCardHolderInfo?.cep || "").replace(/\D/g, "") || "00000000"
    const shippingAddressString = order.customerAddress || estab?.address || "Não informado"
    const shippingCep = (order.customer?.cep || "").replace(/\D/g, "") || billingCep

    const billingInfo = {
      ...creditCardHolderInfo,
      // billing (vem do front ou fica como "Não informado" se vazio)
      street: (creditCardHolderInfo as any)?.street || creditCardHolderInfo?.address || "Não informado",
      number: creditCardHolderInfo?.number || "s/n",
      neighborhood: (creditCardHolderInfo as any)?.neighborhood || "Não informado",
      city: (creditCardHolderInfo as any)?.city || "Não informado",
      state: (creditCardHolderInfo as any)?.state || "SP",
      cep: billingCep,
      // shipping (endereço de entrega do pedido, separado do billing)
      shippingStreet: shippingAddressString,
      shippingNumber: "s/n",
      shippingNeighborhood: "Não informado",
      shippingCity: "Não informado",
      shippingState: "SP",
      shippingCep: shippingCep,
      shippingRecipientName: order.customerName || "",
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
      cardToken,
      creditCardHolderInfo: billingInfo,
      installments,
      splitRules,
      clientIp,
    })

    await prisma.order.update({
      where: { id: order.id },
      data: {
        // Em Pagar.me V5 o webhook do cartão traz o id da charge (ch_...).
        // Gravamos a charge id no paymentId para que tanto o webhook
        // quanto o polling em /payment-status encontrem a order.
        paymentId: String(transaction.charges?.[0]?.id || transaction.id),
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
