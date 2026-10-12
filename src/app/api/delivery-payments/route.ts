import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireEstablishment } from "@/lib/require-auth"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const establishmentId = searchParams.get("establishmentId")
  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId necessário" }, { status: 400 })
  }

  const auth = requireEstablishment(req, establishmentId)
  if (auth.error) return auth.error

  const payments = await prisma.deliveryPayment.findMany({
    where: { establishmentId },
    include: {
      deliveryPerson: { select: { name: true, phone: true } },
      paidBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(payments)
}

export async function POST(req: NextRequest) {
  try {
    const { deliveryPersonId, amount, period, notes, paidById, establishmentId } = await req.json()
    if (!deliveryPersonId || !amount || !establishmentId) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

    const auth = requireEstablishment(req, establishmentId)
    if (auth.error) return auth.error

    const payment = await prisma.deliveryPayment.create({
      data: {
        deliveryPersonId,
        amount,
        period: period || "manual",
        notes: notes || null,
        paidById: paidById || null,
        establishmentId,
      },
      include: {
        deliveryPerson: { select: { name: true } },
      },
    })

    return NextResponse.json(payment)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao registrar pagamento" }, { status: 500 })
  }
}
