import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get("token")
  const all = searchParams.get("all") === "true"
  if (!token) {
    return NextResponse.json({ error: "token necessário" }, { status: 400 })
  }

  const person = await prisma.deliveryPerson.findUnique({
    where: { token },
    include: {
      establishment: { select: { name: true, phone: true, slug: true, logo: true } },
      user: { select: { id: true, mustChangePassword: true } },
    },
  })
  if (!person) {
    return NextResponse.json({ error: "Entregador não encontrado" }, { status: 404 })
  }

  const orders = await prisma.order.findMany({
    where: {
      deliveryPersonId: person.id,
      orderType: "delivery",
      status: all ? { not: "cancelled" } : { in: ["ready", "out_for_delivery"] },
    },
    orderBy: { createdAt: "desc" },
  })

  const personData = {
    ...person,
    userId: person.user?.id || null,
    mustChangePassword: person.user?.mustChangePassword || false,
    user: undefined,
  }

  return NextResponse.json({ person: personData, orders })
}

export async function PATCH(req: NextRequest) {
  try {
    const { orderId, status, token, toggleActive } = await req.json()

    if (toggleActive) {
      const person = await prisma.deliveryPerson.findUnique({ where: { token } })
      if (!person) {
        return NextResponse.json({ error: "Entregador não encontrado" }, { status: 404 })
      }
      const updated = await prisma.deliveryPerson.update({
        where: { id: person.id },
        data: { isActive: !person.isActive },
      })
      return NextResponse.json(updated)
    }

    if (!orderId || !status || !token) {
      return NextResponse.json({ error: "orderId, status e token obrigatórios" }, { status: 400 })
    }

    const person = await prisma.deliveryPerson.findUnique({ where: { token } })
    if (!person) {
      return NextResponse.json({ error: "Entregador não encontrado" }, { status: 404 })
    }

    if (!person.isActive) {
      return NextResponse.json({ error: "Você está offline. Ative seu status para receber entregas." }, { status: 400 })
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, deliveryPersonId: person.id },
    })
    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado ou não atribuído a você" }, { status: 404 })
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        deliveryPerson: person.name,
        ...(status === "delivered" && { deliveredAt: new Date() }),
      },
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 })
  }
}
