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

  const orderWhere: any = {
    establishmentId,
    status: { not: "cancelled" },
  }
  if (Object.keys(dateFilter).length > 0) {
    orderWhere.createdAt = dateFilter
  }

  const orders = await prisma.order.findMany({
    where: orderWhere,
    select: {
      id: true,
      total: true,
      paymentMethod: true,
      orderType: true,
      status: true,
      tableNumber: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  })

  // Group by day
  const dayMap = new Map<string, {
    total: number
    orders: typeof orders
    count: number
    byPayment: { money: number; card: number; pix: number; online: number }
  }>()

  for (const order of orders) {
    const day = order.createdAt.toISOString().split("T")[0]
    if (!dayMap.has(day)) {
      dayMap.set(day, { total: 0, orders: [], count: 0, byPayment: { money: 0, card: 0, pix: 0, online: 0 } })
    }
    const dayData = dayMap.get(day)!
    dayData.total += order.total
    dayData.count += 1
    dayData.orders.push(order)
    const method = order.paymentMethod as "money" | "card" | "pix" | "online"
    if (method in dayData.byPayment) {
      dayData.byPayment[method] += order.total
    }
  }

  // Convert to array sorted by date desc
  const days = Array.from(dayMap.entries())
    .map(([date, data]) => ({
      date,
      total: data.total,
      count: data.count,
      avgTicket: data.total / data.count,
      byPayment: data.byPayment,
      orders: data.orders,
    }))
    .sort((a, b) => b.date.localeCompare(a.date))

  const totalReceita = orders.reduce((sum, o) => sum + o.total, 0)
  const totalPedidos = orders.length
  const ticketMedio = totalPedidos > 0 ? totalReceita / totalPedidos : 0

  return NextResponse.json({
    summary: { totalReceita, totalPedidos, ticketMedio, diasComVenda: days.length },
    days,
  })
}