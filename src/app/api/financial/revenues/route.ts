import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireEstablishment } from "@/lib/require-auth"
import { dayRangeFilter, dayKeyInTz } from "@/lib/finance-dates"

export async function GET(req: NextRequest) {
  const establishmentIdParam = req.nextUrl.searchParams.get("establishmentId")
  const from = req.nextUrl.searchParams.get("from")
  const to = req.nextUrl.searchParams.get("to")

  const { user, error } = requireEstablishment(req, establishmentIdParam)
  if (error) return error
  const establishmentId = user.establishmentId

  // Limites inclusivos no fuso do negócio (F5A-044)
  const dateFilter: any = dayRangeFilter(from, to)

  const orderWhere: any = {
    establishmentId,
    // F5A-019: sem cancelado/abandonado/pagamento pendente
    status: { notIn: ["cancelled", "abandoned", "payment_pending"] },
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
    byPayment: Record<string, number>
  }>()

  // Normaliza paymentMethod para os buckets reais (F5A-029: "cash" nunca
  // caía em "money" e delivery/pickup eram descartados).
  const paymentBucket = (method: string): string => {
    if (method === "cash" || method === "money") return "money"
    if (method === "card" || method === "card_delivery" || method === "card_pickup") return "card"
    if (method === "pix") return "pix"
    if (method === "online" || method === "asaas" || method === "inter") return "online"
    if (method === "delivery" || method === "pickup") return method
    return "money"
  }

  for (const order of orders) {
    const day = dayKeyInTz(order.createdAt)
    if (!dayMap.has(day)) {
      dayMap.set(day, { total: 0, orders: [], count: 0, byPayment: { money: 0, card: 0, pix: 0, online: 0 } })
    }
    const dayData = dayMap.get(day)!
    dayData.total += order.total
    dayData.count += 1
    dayData.orders.push(order)
    const bucket = paymentBucket(order.paymentMethod || "")
    dayData.byPayment[bucket] = (dayData.byPayment[bucket] || 0) + order.total
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