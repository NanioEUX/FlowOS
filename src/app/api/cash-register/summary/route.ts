import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const authUser = await verifyAuth(req)
  if (!authUser) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const establishmentId = authUser.establishmentId
  const start = req.nextUrl.searchParams.get("start")
  const end = req.nextUrl.searchParams.get("end")

  const now = new Date()
  const rangeStart = start ? new Date(start) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const rangeEnd = end ? new Date(end + "T23:59:59.999Z") : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  const registers = await prisma.cashRegister.findMany({
    where: {
      establishmentId,
      createdAt: { gte: rangeStart, lte: rangeEnd },
    },
    include: { movements: true },
  })

  const allMovements = registers.flatMap((r) => r.movements)

  const salesByPayment = { cash: 0, card: 0, pix: 0, online: 0 }
  const expensesByCategory: Record<string, number> = {}
  let totalSales = 0
  let totalExpenses = 0
  let totalInjections = 0
  let totalWithdrawals = 0

  for (const m of allMovements) {
    if (m.type === "sale") {
      totalSales += m.amount
      const pm = (m.paymentMethod || "cash") as keyof typeof salesByPayment
      if (pm in salesByPayment) {
        salesByPayment[pm] += m.amount
      } else {
        salesByPayment.cash += m.amount
      }
    } else if (m.type === "expense") {
      totalExpenses += Math.abs(m.amount)
      const cat = m.description?.split(":")[0]?.trim() || "outro"
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + Math.abs(m.amount)
    } else if (m.type === "injection") {
      totalInjections += m.amount
    } else if (m.type === "withdrawal") {
      totalWithdrawals += Math.abs(m.amount)
    }
  }

  const totalOpening = registers.reduce((s, r) => s + r.openingAmount, 0)
  const totalClosing = registers.reduce((s, r) => s + (r.closingAmount || 0), 0)
  const registerCount = registers.length
  const openRegisters = registers.filter((r) => r.status === "open").length

  return NextResponse.json({
    period: { start: rangeStart, end: rangeEnd },
    registerCount,
    openRegisters,
    totalOpening,
    totalClosing,
    totalSales,
    totalExpenses,
    totalInjections,
    totalWithdrawals,
    salesByPayment,
    expensesByCategory,
    netResult: totalSales - totalExpenses,
  })
}
