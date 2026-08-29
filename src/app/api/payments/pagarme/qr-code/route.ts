import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const { orderId, establishmentId } = await req.json()

    console.log("[Pagar.me QR Code] Request received:", { orderId, environment: process.env.PAGARME_ENVIRONMENT })

    if (!orderId || !establishmentId) {
      return NextResponse.json({ error: "orderId e establishmentId obrigatórios" }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { establishment: { select: { id: true, pagarmeApiKey: true, name: true, pagarmeEnvironment: true, pagarmeSplitReceiverId: true } } },
    })

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    if (order.establishmentId !== establishmentId) {
      return NextResponse.json({ error: "Pedido não pertence a este estabelecimento" }, { status: 403 })
    }

    if (!order.paymentId) {
      return NextResponse.json({ error: "Pedido não possui transação Pagar.me" }, { status: 400 })
    }

    if (!order.establishment.pagarmeApiKey) {
      return NextResponse.json({ error: "API Key do Pagar.me não configurada" }, { status: 400 })
    }

    const apiKey = order.establishment.pagarmeApiKey
    const apiUrl = order.establishment.pagarmeEnvironment === "sandbox"
      ? "https://api.pagar.me/core/v5"
      : "https://api.pagar.me/core/v5"

    const authHeader = `Basic ${Buffer.from(apiKey + ":").toString("base64")}`

    // Busca a transação para obter os dados do PIX
    const res = await fetch(`${apiUrl}/orders/${order.paymentId}`, {
      headers: { "Authorization": authHeader },
    })

    console.log("[Pagar.me QR Code] Response status:", res.status)

    if (res.ok) {
      const data = await res.json()
      const charges = data.charges || []
      const pixCharge = charges.find((c: any) => c.payment_method === "pix")

      if (pixCharge?.last_transaction_status === "paid") {
        return NextResponse.json({ paid: true })
      }

      if (pixCharge?.pix_qr_code) {
        return NextResponse.json({
          encodedImage: pixCharge.pix_qr_code,
          payload: pixCharge.pix_payload,
          expiration: pixCharge.gateway_response?.qr_code_expiration_at,
        })
      }
    }

    // Fallback: retorna paymentLink se existir
    if (order.paymentLink) {
      return NextResponse.json({ paymentLink: order.paymentLink })
    }

    const err = await res.json().catch(() => ({}))
    console.error("[Pagar.me QR Code] Error:", JSON.stringify(err))
    return NextResponse.json({ error: "Erro ao buscar QR Code", details: err }, { status: 502 })
  } catch (error: any) {
    console.error("[Pagar.me QR Code] Error:", error.message)
    return NextResponse.json({ error: "Erro ao buscar QR Code", details: error.message }, { status: 500 })
  }
}
