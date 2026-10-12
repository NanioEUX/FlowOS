import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireEstablishment } from "@/lib/require-auth"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const establishmentIdParam = searchParams.get("establishmentId")
  const tableNumber = searchParams.get("tableNumber")

  const { user, error } = requireEstablishment(req, establishmentIdParam)
  if (error) return error

  const where: any = { establishmentId: user.establishmentId }
  if (tableNumber) where.tableNumber = parseInt(tableNumber)

  const payments = await prisma.partialPayment.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(payments)
}

export async function POST(req: NextRequest) {
  try {
    const { establishmentId, tableNumber, amount, paymentMethod } = await req.json()

    if (!establishmentId || !tableNumber || !amount || amount <= 0) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

    const { user, error } = requireEstablishment(req, establishmentId)
    if (error) return error

    const payment = await prisma.partialPayment.create({
      data: {
        establishmentId: user.establishmentId,
        tableNumber: parseInt(tableNumber),
        amount: parseFloat(amount),
        paymentMethod: paymentMethod || "pix",
      },
    })

    return NextResponse.json({ success: true, payment })
  } catch (error) {
    console.error("Erro ao registrar pagamento parcial:", error)
    return NextResponse.json({ error: "Erro ao registrar pagamento" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const establishmentIdParam = searchParams.get("establishmentId")
    const tableNumber = searchParams.get("tableNumber")

    if (!establishmentIdParam || !tableNumber) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

    const { user, error } = requireEstablishment(req, establishmentIdParam)
    if (error) return error

    await prisma.partialPayment.deleteMany({
      where: {
        establishmentId: user.establishmentId,
        tableNumber: parseInt(tableNumber),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao deletar pagamentos parciais:", error)
    return NextResponse.json({ error: "Erro ao deletar" }, { status: 500 })
  }
}
