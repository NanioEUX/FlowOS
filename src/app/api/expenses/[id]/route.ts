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
  const expense = await prisma.expense.findUnique({ where: { id: params.id } })
  if (!expense || expense.establishmentId !== establishmentId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  }

  const body = await req.json()
  const { description, amount, category, date, dueDate, type, paymentMethod, isRecurring, recurrenceFreq, recurrenceStart, recurrenceEnd, receiptUrl } = body

  const updated = await prisma.expense.update({
    where: { id: params.id },
    data: {
      ...(description !== undefined && { description }),
      ...(amount !== undefined && { amount: parseFloat(amount) }),
      ...(category !== undefined && { category }),
      ...(date !== undefined && { date: new Date(date) }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(type !== undefined && { type }),
      ...(paymentMethod !== undefined && { paymentMethod }),
      ...(isRecurring !== undefined && { isRecurring }),
      ...(recurrenceFreq !== undefined && { recurrenceFreq }),
      ...(recurrenceStart !== undefined && { recurrenceStart: recurrenceStart ? new Date(recurrenceStart) : null }),
      ...(recurrenceEnd !== undefined && { recurrenceEnd: recurrenceEnd ? new Date(recurrenceEnd) : null }),
      ...(receiptUrl !== undefined && { receiptUrl }),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authUser = await verifyAuth(_req)
  if (!authUser) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  const establishmentId = authUser.establishmentId
  const expense = await prisma.expense.findUnique({ where: { id: params.id } })
  if (!expense || expense.establishmentId !== establishmentId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  }

  await prisma.expense.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
