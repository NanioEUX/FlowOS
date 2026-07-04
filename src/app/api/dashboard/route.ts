import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Dashboard: 10s cache (refreshed frequently but doesn't need real-time)
export const revalidate = 10

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const establishmentId = searchParams.get("establishmentId")

  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId necessário" }, { status: 400 })
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)
  const weekAgoStart = new Date(now.getTime() - 7 * 86400000)

  const [
    todayOrders,
    yesterdayOrders,
    activeOrders,
    totalCustomers,
    newCustomersToday,
    recentOrders,
    weekSales,
    deliveryPeople,
  ] = await Promise.all([
    // Vendas hoje
    prisma.order.findMany({
      where: {
        establishmentId,
        createdAt: { gte: todayStart },
        status: { not: "cancelled" },
      },
      select: { total: true, items: true, status: true, orderType: true },
    }),

    // Vendas ontem (comparação)
    prisma.order.findMany({
      where: {
        establishmentId,
        createdAt: { gte: yesterdayStart, lt: todayStart },
        status: { not: "cancelled" },
      },
      select: { total: true },
    }),

    // Pedidos ativos
    prisma.order.findMany({
      where: {
        establishmentId,
        status: { in: ["preparing", "ready", "out_for_delivery"] },
      },
      select: { status: true, deliveryPersonId: true, orderType: true },
    }),

    // Total de clientes
    prisma.customer.count({ where: { establishmentId } }),

    // Novos clientes hoje
    prisma.customer.count({
      where: {
        establishmentId,
        createdAt: { gte: todayStart },
      },
    }),

    // Últimos 5 pedidos
    prisma.order.findMany({
      where: { establishmentId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        total: true,
        status: true,
        createdAt: true,
        items: true,
      },
    }),

    // Vendas dos últimos 7 dias (agrupado por dia)
    prisma.order.findMany({
      where: {
        establishmentId,
        createdAt: { gte: weekAgoStart },
        status: { not: "cancelled" },
      },
      select: { total: true, createdAt: true },
    }),

    // Motoboys
    prisma.deliveryPerson.count({
      where: { establishmentId, isActive: true },
    }),
  ])

  // Processar dados
  const todayTotal = todayOrders.reduce((sum, o) => sum + o.total, 0)
  const todayCount = todayOrders.length
  const yesterdayTotal = yesterdayOrders.reduce((sum, o) => sum + o.total, 0)
  const yesterdayCount = yesterdayOrders.length
  const ticketMedio = todayCount > 0 ? todayTotal / todayCount : 0

  // Pedidos ativos por status
  const activeByStatus = {
    preparing: activeOrders.filter((o) => o.status === "preparing").length,
    ready: activeOrders.filter((o) => o.status === "ready").length,
    out_for_delivery: activeOrders.filter((o) => o.status === "out_for_delivery").length,
  }

  // Motoboys livres (sem pedido atribuído em ready/out_for_delivery)
  const busyMotoboys = new Set(
    activeOrders
      .filter((o) => o.deliveryPersonId && ["ready", "out_for_delivery"].includes(o.status))
      .map((o) => o.deliveryPersonId)
  )
  const freeMotoboys = deliveryPeople - busyMotoboys.size

  // Top produtos (contar ocorrências nos pedidos de hoje)
  const productCount: Record<string, { name: string; count: number; total: number }> = {}
  for (const order of todayOrders) {
    try {
      const items = typeof order.items === "string" ? JSON.parse(order.items) : order.items
      for (const item of items) {
        if (!productCount[item.name]) {
          productCount[item.name] = { name: item.name, count: 0, total: 0 }
        }
        productCount[item.name].count += item.quantity
        productCount[item.name].total += item.price * item.quantity
      }
    } catch {}
  }
  const topProducts = Object.values(productCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Vendas por dia (últimos 7 dias)
  const salesByDay: Record<string, { date: string; total: number; count: number }> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000)
    const key = d.toISOString().split("T")[0]
    salesByDay[key] = {
      date: key,
      total: 0,
      count: 0,
    }
  }
  for (const order of weekSales) {
    const key = new Date(order.createdAt).toISOString().split("T")[0]
    if (salesByDay[key]) {
      salesByDay[key].total += order.total
      salesByDay[key].count += 1
    }
  }

  return NextResponse.json({
    today: {
      total: todayTotal,
      count: todayCount,
      ticketMedio,
      vsYesterday: {
        total: todayTotal - yesterdayTotal,
        count: todayCount - yesterdayCount,
        percentTotal: yesterdayTotal > 0 ? Math.round(((todayTotal - yesterdayTotal) / yesterdayTotal) * 100) : 0,
      },
    },
    active: {
      total: activeOrders.length,
      byStatus: activeByStatus,
    },
    customers: {
      total: totalCustomers,
      newToday: newCustomersToday,
    },
    motoboys: {
      total: deliveryPeople,
      free: freeMotoboys,
    },
    recentOrders,
    topProducts,
    weekSales: Object.values(salesByDay),
  })
}
