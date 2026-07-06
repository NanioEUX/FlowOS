import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const revalidate = 10

export async function GET(req: NextRequest) {
  const establishmentId = req.nextUrl.searchParams.get("establishmentId")
  const from = req.nextUrl.searchParams.get("from")
  const to = req.nextUrl.searchParams.get("to")

  if (!establishmentId) return NextResponse.json({ error: "establishmentId required" }, { status: 400 })

  const dateFilter: any = {}
  if (from) dateFilter.gte = new Date(from)
  if (to) dateFilter.lte = new Date(to + "T23:59:59")

  const orderWhere: any = { establishmentId, status: { not: "cancelled" } }
  const expenseWhere: any = { establishmentId }
  if (Object.keys(dateFilter).length > 0) {
    orderWhere.createdAt = dateFilter
    expenseWhere.date = dateFilter
  }

  const [orders, expenses] = await Promise.all([
    prisma.order.findMany({ where: orderWhere, select: { total: true, paymentMethod: true, createdAt: true } }),
    prisma.expense.findMany({ where: expenseWhere, select: { amount: true, date: true, createdAt: true } }),
  ])

  // Group by day
  const dayMap = new Map<string, { entradas: number; saidas: number; byPayment: Record<string, number> }>()

  for (const order of orders) {
    const day = order.createdAt.toISOString().split("T")[0]
    if (!dayMap.has(day)) dayMap.set(day, { entradas: 0, saidas: 0, byPayment: {} })
    const d = dayMap.get(day)!
    d.entradas += order.total
    d.byPayment[order.paymentMethod] = (d.byPayment[order.paymentMethod] || 0) + order.total
  }

  for (const expense of expenses) {
    const day = expense.date.toISOString().split("T")[0]
    if (!dayMap.has(day)) dayMap.set(day, { entradas: 0, saidas: 0, byPayment: {} })
    dayMap.get(day)!.saidas += expense.amount
  }

  const days = Array.from(dayMap.entries())
    .map(([date, data]) => ({
      date,
      entradas: data.entradas,
      saidas: data.saidas,
      saldo: data.entradas - data.saidas,
      byPayment: data.byPayment,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const totalEntradas = orders.reduce((sum, o) => sum + o.total, 0)
  const totalSaidas = expenses.reduce((sum, e) => sum + e.amount, 0)

  return NextResponse.json({
    summary: { totalEntradas, totalSaidas, saldo: totalEntradas - totalSaidas, dias: days.length },
    days,
  })
}