import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getIfoodAuth } from "@/lib/integrations/ifood"
import { ifoodHandshake } from "@/lib/integrations/ifood-status"
import { verifyAuth } from "@/lib/auth"

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = verifyAuth(req)
    if (!auth) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await req.json()
    const { handshakeCode } = body

    if (!handshakeCode || !/^\d{4}$/.test(handshakeCode)) {
      return NextResponse.json(
        { error: "Código deve ter exatamente 4 dígitos" },
        { status: 400 }
      )
    }

    const order = await prisma.order.findUnique({
      where: { id: params.id },
    })

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    if (order.establishmentId !== auth.establishmentId) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    // Validate preconditions
    if (order.method !== "ifood") {
      return NextResponse.json(
        { error: "Handshake só é válido para pedidos iFood" },
        { status: 400 }
      )
    }

    if (order.ifoodDeliveryBy !== "MERCHANT") {
      return NextResponse.json(
        { error: "Handshake só é válido para entrega própria (MERCHANT)" },
        { status: 400 }
      )
    }

    if (!["out_for_delivery", "dispatched"].includes(order.status)) {
      return NextResponse.json(
        { error: "Pedido precisa estar em rota de entrega para confirmar" },
        { status: 400 }
      )
    }

    if (!order.externalId) {
      return NextResponse.json(
        { error: "Pedido não possui ID externo do iFood" },
        { status: 400 }
      )
    }

    // Get iFood auth
    const ifoodAuth = await getIfoodAuth(
      process.env.IFOOD_CLIENT_ID!,
      process.env.IFOOD_CLIENT_SECRET!
    )

    if (!ifoodAuth?.accessToken) {
      return NextResponse.json(
        { error: "Falha na autenticação com iFood" },
        { status: 502 }
      )
    }

    const establishment = await prisma.establishment.findUnique({
      where: { id: order.establishmentId },
    })

    if (!establishment?.ifoodMerchantId) {
      return NextResponse.json(
        { error: "Estabelecimento não possui merchant ID do iFood" },
        { status: 400 }
      )
    }

    // Call iFood handshake
    const result = await ifoodHandshake(
      ifoodAuth.accessToken,
      establishment.ifoodMerchantId,
      order.externalId,
      handshakeCode
    )

    console.log("[ifood handshake]", {
      orderId: order.externalId,
      handshakeCode,
      status: result.status,
      success: result.success,
      body: result.body,
    })

    if (result.success) {
      // Code correct — mark as delivered locally
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "delivered", deliveredAt: new Date() },
      })
      return NextResponse.json({ success: true, message: "Entrega confirmada com sucesso" })
    }

    if (result.status === 400 || result.status === 422) {
      return NextResponse.json(
        { error: "Código de confirmação incorreto. Verifique com o cliente e tente novamente." },
        { status: 400 }
      )
    }

    if (result.status === 409) {
      // Already concluded — update local status too
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "delivered", deliveredAt: new Date() },
      })
      return NextResponse.json({ success: true, message: "Pedido já estava concluído" })
    }

    return NextResponse.json(
      { error: `Erro do iFood (${result.status}): ${result.body}` },
      { status: 502 }
    )
  } catch (err: any) {
    console.error("[ifood handshake] error:", err.message)
    return NextResponse.json(
      { error: "Erro interno ao processar handshake" },
      { status: 500 }
    )
  }
}
