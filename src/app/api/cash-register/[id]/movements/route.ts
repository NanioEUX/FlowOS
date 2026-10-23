import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authUser = await verifyAuth(req)
  if (!authUser) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  const establishmentId = authUser.establishmentId
  const register = await prisma.cashRegister.findUnique({ where: { id: params.id } })
  if (!register || register.establishmentId !== establishmentId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  }

  const movements = await prisma.cashMovement.findMany({
    where: { cashRegisterId: params.id },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(movements)
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authUser = await verifyAuth(req)
  if (!authUser) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  const establishmentId = authUser.establishmentId
  const register = await prisma.cashRegister.findUnique({ where: { id: params.id } })
  if (!register || register.establishmentId !== establishmentId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  }

  if (register.status !== "open") {
    return NextResponse.json({ error: "Caixa não está aberto" }, { status: 400 })
  }

  const { type, amount, description, paymentMethod, orderId } = await req.json()

  if (!type || amount === undefined) {
    return NextResponse.json({ error: "type and amount required" }, { status: 400 })
  }

  // F5B-028: type restrito ao vocabulário do caixa — string livre poluía a
  // conferência por tipo (e permitia forjar receita esperada).
  const VALID_TYPES = ["sale", "expense", "withdrawal", "injection", "refund"]
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: `type inválido: ${type}` }, { status: 400 })
  }

  const movement = await prisma.cashMovement.create({
    data: {
      type,
      amount: type === "expense" || type === "withdrawal" || type === "refund"
        ? -Math.abs(amount)
        : Math.abs(amount),
      description,
      paymentMethod,
      orderId,
      cashRegisterId: params.id,
    },
  })

  return NextResponse.json(movement)
}
