import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const order = await prisma.order.findUnique({ where: { id: params.id } })
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
  }

  // Check auth - establishment or customer with tracking token
  const authUser = verifyAuth(req)
  const { searchParams } = new URL(req.url)
  const trackingToken = searchParams.get("token")

  if (authUser) {
    // Establishment - verify ownership
    if (authUser.establishmentId !== order.establishmentId) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }
  } else if (trackingToken) {
    // Customer - verify tracking token
    if (order.trackingToken !== trackingToken) {
      return NextResponse.json({ error: "Token inválido" }, { status: 403 })
    }
  } else {
    return NextResponse.json({ error: "Autenticação necessária" }, { status: 401 })
  }

  const messages = await prisma.orderMessage.findMany({
    where: { orderId: params.id },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(messages)
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url)
  const trackingToken = searchParams.get("token")
  const body = await req.json()

  if (!body.message?.trim()) {
    return NextResponse.json({ error: "Mensagem é obrigatória" }, { status: 400 })
  }

  if (body.message.length > 500) {
    return NextResponse.json({ error: "Mensagem deve ter no máximo 500 caracteres" }, { status: 400 })
  }

  const order = await prisma.order.findUnique({ where: { id: params.id } })
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
  }

  let sender = "customer"

  if (trackingToken) {
    // Customer via tracking token
    if (order.trackingToken !== trackingToken) {
      return NextResponse.json({ error: "Token inválido" }, { status: 403 })
    }
    sender = "customer"
  } else {
    // Establishment via auth
    const authUser = verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Autenticação necessária" }, { status: 401 })
    }
    if (authUser.establishmentId !== order.establishmentId) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }
    sender = "establishment"
  }

  const message = await prisma.orderMessage.create({
    data: {
      orderId: params.id,
      sender,
      message: body.message.trim().slice(0, 500),
    },
  })

  return NextResponse.json(message)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const order = await prisma.order.findUnique({ where: { id: params.id } })
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
  }

  // Only establishment can mark messages as read
  const authUser = verifyAuth(req)
  if (!authUser) {
    return NextResponse.json({ error: "Autenticação necessária" }, { status: 401 })
  }
  if (authUser.establishmentId !== order.establishmentId) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }

  await prisma.orderMessage.updateMany({
    where: { orderId: params.id, sender: "customer", read: false },
    data: { read: true },
  })

  return NextResponse.json({ ok: true })
}
