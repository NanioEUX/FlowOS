import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const { orderId, establishmentId } = await req.json()

    if (!orderId || !establishmentId) {
      return NextResponse.json({ error: "orderId e establishmentId obrigatórios" }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { establishment: { select: { id: true, name: true } } },
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

    const { getPagarmeConfig } = await import("@/lib/pagarme-config")
    const { apiKey } = await getPagarmeConfig()
    if (!apiKey) {
      return NextResponse.json({ error: "Pagar.me não configurado no servidor" }, { status: 500 })
    }

    const apiUrl = "https://api.pagar.me/core/v5"
    const authHeader = `Basic ${Buffer.from(apiKey + ":").toString("base64")}`

    const res = await fetch(`${apiUrl}/orders/${order.paymentId}`, {
      headers: { "Authorization": authHeader },
    })

    if (!res.ok) {
      return NextResponse.json({ error: "Erro ao buscar pedido no Pagar.me" }, { status: 502 })
    }

    const data = await res.json()
    const charges = data.charges || []
    const pixCharge = charges.find((c: any) => c.payment_method === "pix")

    if (!pixCharge) {
      return NextResponse.json({ error: "Cobrança PIX não encontrada" }, { status: 404 })
    }

    // Check if already paid
    if (pixCharge.status === "paid" || pixCharge.last_transaction_status === "paid") {
      return NextResponse.json({ paid: true })
    }

    // Try to get QR code URL from multiple possible locations
    const qrCodeUrl = pixCharge.last_transaction?.qr_code_url || pixCharge.qr_code_url || ""

    if (qrCodeUrl) {
      // Fetch the QR code image and convert to base64
      try {
        const qrRes = await fetch(qrCodeUrl)
        if (qrRes.ok) {
          const qrBuffer = await qrRes.arrayBuffer()
          const qrBase64 = Buffer.from(qrBuffer).toString("base64")
          return NextResponse.json({
            encodedImage: qrBase64,
            payload: pixCharge.last_transaction?.qr_code || pixCharge.qr_code || "",
          })
        }
      } catch (e) {
        console.error("[Pagar.me QR] Erro ao baixar imagem:", e)
      }
    }

    // Fallback: check if paymentLink has base64 QR code
    if (order.paymentLink?.startsWith("data:image")) {
      const base64 = order.paymentLink.replace("data:image/png;base64,", "")
      return NextResponse.json({
        encodedImage: base64,
        payload: pixCharge.last_transaction?.qr_code || "",
      })
    }

    return NextResponse.json({ error: "QR Code não disponível ainda. Aguarde alguns segundos." }, { status: 404 })
  } catch (error: any) {
    console.error("[Pagar.me QR Code] Error:", error.message)
    return NextResponse.json({ error: "Erro ao buscar QR Code", details: error.message }, { status: 500 })
  }
}
