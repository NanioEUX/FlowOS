import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createInterPixCharge, getInterPixQrCode, generateInterTxId } from "@/lib/integrations/inter"

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json()

    console.log("[Inter QR Code] Request received:", { orderId })

    if (!orderId) {
      return NextResponse.json({ error: "orderId obrigatório" }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        establishment: {
          select: {
            interClientId: true,
            interClientSecret: true,
            interCertificate: true,
            interPixKey: true,
            name: true,
          },
        },
      },
    })

    if (!order) {
      console.log("[Inter QR Code] Order not found:", orderId)
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    const est = order.establishment
    if (!est.interClientId || !est.interClientSecret || !est.interCertificate || !est.interPixKey) {
      return NextResponse.json({ error: "Integração Inter não configurada" }, { status: 400 })
    }

    const config = {
      clientId: est.interClientId,
      clientSecret: est.interClientSecret,
      certificate: est.interCertificate,
      certificatePassword: est.interCertificatePassword || "",
    }

    const txid = generateInterTxId(order.id, order.orderNumber ?? 0)
    const description = `Pedido #${order.orderNumber} - ${est.name}`

    // Check if charge already exists for this order
    if (order.paymentId && order.paymentId.startsWith("inter_")) {
      const existingTxid = order.paymentId.replace("inter_", "")
      try {
        const qrCode = await getInterPixQrCode(config, existingTxid)
        return NextResponse.json({
          encodedImage: qrCode.image,
          payload: qrCode.payload,
        })
      } catch {
        // Charge might have expired, create new one
      }
    }

    // Create new PIX charge
    const charge = await createInterPixCharge(config, {
      value: order.total,
      txid,
      description,
      pixKey: est.interPixKey,
    })

    // Save paymentId to order
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentId: `inter_${charge.txid}` },
    })

    // Get QR Code
    const qrCode = await getInterPixQrCode(config, charge.txid)

    console.log("[Inter QR Code] Success:", { txid: charge.txid, hasImage: !!qrCode.image })

    return NextResponse.json({
      encodedImage: qrCode.image,
      payload: qrCode.payload,
      expiration: 3600,
    })
  } catch (error: any) {
    console.error("[Inter QR Code] Error:", error.message)
    return NextResponse.json({ error: "Erro ao buscar QR Code", details: error.message }, { status: 500 })
  }
}
