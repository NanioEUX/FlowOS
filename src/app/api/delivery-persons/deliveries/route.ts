import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { canTransition, isValidStatus } from "@/lib/order-transitions"
import crypto from "crypto"
import { getRequestId, logger } from "@/lib/logger"

// F5B-019: o token pode vir em header (novo) ou no body/query (legado,
// mantido para não quebrar páginas já abertas).
function tokenFrom(req: NextRequest, fromBody?: string): string | null {
  const auth = req.headers.get("authorization")
  if (auth?.startsWith("Bearer ")) return auth.slice(7)
  if (fromBody) return fromBody
  return new URL(req.url).searchParams.get("token")
}

// F5B-019: só o que a tela do motoboy usa — status livre virava
// "delivered" direto de "preparing" ou qualquer string arbitrária.
const MOTOBOY_TARGETS = ["out_for_delivery", "delivered"]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = tokenFrom(req)
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
    const body = await req.json()
    const { orderId, status, toggleActive } = body
    const token = tokenFrom(req, body?.token)

    if (toggleActive) {
      if (!token) {
        return NextResponse.json({ error: "token obrigatório" }, { status: 400 })
      }
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

    // F5B-019: whitelist de alvos + máquina de estados (igual ao PATCH /api/orders)
    if (!MOTOBOY_TARGETS.includes(status) || !isValidStatus(status)) {
      return NextResponse.json({ error: "Status não permitido" }, { status: 400 })
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

    if (!canTransition(order.status, status)) {
      return NextResponse.json(
        { error: `Transição inválida: ${order.status} → ${status}` },
        { status: 400 }
      )
    }

    const isOutForDelivery = status === "out_for_delivery" && order.status !== "out_for_delivery"
    const isNonIfood = order.method !== "ifood"

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        deliveryPerson: person.name,
        ...(isOutForDelivery && { assignedAt: new Date() }),
        ...(isOutForDelivery && isNonIfood && !order.deliveryCode && { deliveryCode: String(crypto.randomInt(1000, 10000)) }),
        ...(status === "delivered" && { deliveredAt: new Date() }),
      },
    })
    return NextResponse.json(updated)
  } catch (error) {
    logger.error("delivery-persons/deliveries", "falha na operação", { requestId: getRequestId(req), error: (error as any)?.message })
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 })
  }
}
