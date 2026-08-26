import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { handshakeCode, deliveryPersonToken } = body

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

    // Auth: dashboard session OR motoboy token
    if (deliveryPersonToken) {
      const person = await prisma.deliveryPerson.findUnique({
        where: { token: deliveryPersonToken },
      })
      if (!person || person.id !== order.deliveryPersonId) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      }
    } else {
      const auth = verifyAuth(req)
      if (!auth) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      }
      if (order.establishmentId !== auth.establishmentId) {
        return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
      }
    }

    // Validate preconditions
    if (!["out_for_delivery", "dispatched"].includes(order.status)) {
      return NextResponse.json(
        { error: "Pedido precisa estar em rota de entrega para confirmar" },
        { status: 400 }
      )
    }

    if (!order.deliveryCode) {
      return NextResponse.json(
        { error: "Este pedido não possui código de entrega" },
        { status: 400 }
      )
    }

    // Verify code locally
    if (handshakeCode !== order.deliveryCode) {
      return NextResponse.json(
        { error: "Código de confirmação incorreto. Verifique com o cliente e tente novamente." },
        { status: 400 }
      )
    }

    // Code correct — mark as delivered
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "delivered", deliveredAt: new Date() },
    })

    return NextResponse.json({ success: true, message: "Entrega confirmada com sucesso" })
  } catch (err: any) {
    console.error("[delivery handshake] error:", err.message)
    return NextResponse.json(
      { error: "Erro interno ao processar confirmação" },
      { status: 500 }
    )
  }
}
