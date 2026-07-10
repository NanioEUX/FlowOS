import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const ASAAS_API_URL =
  process.env.ASAAS_ENVIRONMENT === "sandbox"
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3"

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json()

    console.log("[QR Code] Request received:", { orderId, environment: process.env.ASAAS_ENVIRONMENT, apiUrl: ASAAS_API_URL })

    if (!orderId) {
      return NextResponse.json({ error: "orderId obrigatório" }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { establishment: { select: { asaasApiKey: true, name: true } } },
    })

    if (!order) {
      console.log("[QR Code] Order not found:", orderId)
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    if (!order.paymentId) {
      console.log("[QR Code] No paymentId for order:", orderId)
      return NextResponse.json({ error: "Pedido não possui cobrança Asaas" }, { status: 400 })
    }

    if (!order.establishment.asaasApiKey) {
      console.log("[QR Code] No API key for establishment:", order.establishment.name)
      return NextResponse.json({ error: "API Key do Asaas não configurada" }, { status: 400 })
    }

    console.log("[QR Code] Fetching for payment:", { paymentId: order.paymentId, establishment: order.establishment.name })

    const res = await fetch(`${ASAAS_API_URL}/payments/${order.paymentId}/pixQrCode`, {
      headers: { access_token: order.establishment.asaasApiKey },
    })

    console.log("[QR Code] Asaas response status:", res.status)

    if (!res.ok) {
      const err = await res.json()
      console.error("[QR Code] Asaas error:", JSON.stringify(err))

      const errorCode = err.errors?.[0]?.code
      const errorDesc = err.errors?.[0]?.description || ""

      if (errorCode === "invalid_action" && errorDesc.includes("não pode mais ser paga")) {
        console.log("[QR Code] Payment already in terminal state, checking status...")

        const statusRes = await fetch(`${ASAAS_API_URL}/payments/${order.paymentId}`, {
          headers: { access_token: order.establishment.asaasApiKey },
        })

        if (statusRes.ok) {
          const paymentData = await statusRes.json()
          console.log("[QR Code] Payment status:", paymentData.status)

          const statusMap: Record<string, string> = {
            CONFIRMED: "paid",
            RECEIVED: "paid",
            AUTHORIZED: "paid",
            REFUNDED: "refunded",
            RECEIVED_IN_CASH: "paid",
          }

          const paymentStatus = statusMap[paymentData.status] || "pending"

          if (paymentStatus === "paid") {
            await prisma.order.update({
              where: { id: order.id },
              data: { paymentStatus: "paid", status: "confirmed" },
            })
            console.log("[QR Code] Order updated to paid via status check")
            return NextResponse.json({ alreadyPaid: true })
          }
        }
      }

      return NextResponse.json({ error: "Erro ao buscar QR Code", details: err }, { status: 502 })
    }

    const data = await res.json()

    console.log("[QR Code] Success:", { hasImage: !!data.encodedImage, hasPayload: !!data.payload })

    return NextResponse.json({
      encodedImage: data.encodedImage,
      payload: data.payload,
      expiration: data.expiration,
    })
  } catch (error: any) {
    console.error("[QR Code] Error:", error.message)
    return NextResponse.json({ error: "Erro ao buscar QR Code", details: error.message }, { status: 500 })
  }
}
