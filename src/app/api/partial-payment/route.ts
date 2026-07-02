import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const establishmentId = searchParams.get("establishmentId")
  const tableNumber = searchParams.get("tableNumber")

  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId obrigatório" }, { status: 400 })
  }

  const where: any = { establishmentId }
  if (tableNumber) where.tableNumber = parseInt(tableNumber)

  const payments = await prisma.partialPayment.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(payments)
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { establishmentId, tableNumber, amount, paymentMethod } = await req.json()

    if (!establishmentId || !tableNumber || !amount || amount <= 0) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

    if (authUser.establishmentId !== establishmentId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
    }

    const payment = await prisma.partialPayment.create({
      data: {
        establishmentId,
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
    const authUser = await verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const establishmentId = searchParams.get("establishmentId")
    const tableNumber = searchParams.get("tableNumber")

    if (!establishmentId || !tableNumber) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

    if (authUser.establishmentId !== establishmentId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
    }

    await prisma.partialPayment.deleteMany({
      where: {
        establishmentId,
        tableNumber: parseInt(tableNumber),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao deletar pagamentos parciais:", error)
    return NextResponse.json({ error: "Erro ao deletar" }, { status: 500 })
  }
}
