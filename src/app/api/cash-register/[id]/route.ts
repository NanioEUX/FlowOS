import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authUser = await verifyAuth(req)
  if (!authUser) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  const establishmentId = authUser.establishmentId
  const register = await prisma.cashRegister.findUnique({
    where: { id: params.id },
    include: { movements: true },
  })

  if (!register) {
    return NextResponse.json({ error: "Caixa não encontrado" }, { status: 404 })
  }

  if (register.establishmentId !== establishmentId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  }

  const { closingAmount, notes } = await req.json()

  // F5A-015: soma assinada por tipo — despesa/saque/estorno saem do caixa,
  // mesmo para movimentos antigos gravados com sinal positivo.
  const signedAmount = (m: { type: string; amount: number }) =>
    m.type === "expense" || m.type === "withdrawal" || m.type === "refund"
      ? -Math.abs(m.amount)
      : Math.abs(m.amount)
  const totalMovements = register.movements.reduce((sum, m) => sum + signedAmount(m), 0)
  const expected = register.openingAmount + totalMovements

  const updated = await prisma.cashRegister.update({
    where: { id: params.id },
    data: {
      closingAmount: closingAmount ?? expected,
      expectedAmount: expected,
      status: "closed",
      closedAt: new Date(),
      notes: notes || register.notes,
    },
  })

  return NextResponse.json(updated)
}
