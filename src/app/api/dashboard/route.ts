import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    todayOrders,
    yesterdayOrders,
    activeOrders,
    totalCustomers,
    newCustomersToday,
    recentOrders,
    weekSales,
    deliveryPeople,
    monthOrders,
    expenses,
    cashRegister,
    stockItems,
  ] = await Promise.all([
    prisma.order.findMany({
      where: { establishmentId, createdAt: { gte: todayStart }, status: { not: "cancelled" } },
      select: { total: true, items: true, status: true, orderType: true, paymentMethod: true, deliveryFee: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { establishmentId, createdAt: { gte: yesterdayStart, lt: todayStart }, status: { not: "cancelled" } },
      select: { total: true },
    }),
    prisma.order.findMany({
      where: { establishmentId, status: { in: ["preparing", "ready", "out_for_delivery"] } },
      select: { status: true, deliveryPersonId: true, orderType: true },
    }),
    prisma.customer.count({ where: { establishmentId } }),
    prisma.customer.count({ where: { establishmentId, createdAt: { gte: todayStart } } }),
    prisma.order.findMany({
      where: { establishmentId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, orderNumber: true, customerName: true, total: true, status: true, createdAt: true, items: true, orderType: true },
    }),
    prisma.order.findMany({
      where: { establishmentId, createdAt: { gte: weekAgoStart }, status: { not: "cancelled" } },
      select: { total: true, createdAt: true },
    }),
    prisma.deliveryPerson.count({ where: { establishmentId, isActive: true } }),
    prisma.order.findMany({
      where: { establishmentId, createdAt: { gte: monthStart }, status: { not: "cancelled" } },
      select: { total: true },
    }),
    prisma.expense.findMany({
      where: { establishmentId, date: { gte: todayStart } },
      select: { amount: true, category: true },
    }),
    prisma.cashRegister.findFirst({
      where: { establishmentId, status: "open" },
      select: { id: true, createdAt: true, openingAmount: true },
    }),
    prisma.stockItem.findMany({
      where: { establishmentId, minQuantity: { gt: 0 } },
      select: { id: true, name: true, quantity: true, minQuantity: true },
    }).catch(() => [] as any[]),
  ])

  const todayTotal = todayOrders.reduce((sum, o) => sum + o.total, 0)
  const yesterdayTotal = yesterdayOrders.reduce((sum, o) => sum + o.total, 0)
  const todayCount = todayOrders.length
  const ticketMedio = todayCount > 0 ? todayTotal / todayCount : 0
  const monthTotal = monthOrders.reduce((sum, o) => sum + o.total, 0)
  const todayExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const todayProfit = todayTotal - todayExpenses

  const activeByStatus = {
    preparing: activeOrders.filter((o) => o.status === "preparing").length,
    ready: activeOrders.filter((o) => o.status === "ready").length,
    out_for_delivery: activeOrders.filter((o) => o.status === "out_for_delivery").length,
  }

  const busyMotoboys = new Set(
    activeOrders.filter((o) => o.deliveryPersonId && ["ready", "out_for_delivery"].includes(o.status)).map((o) => o.deliveryPersonId)
  )

  const byType = {
    delivery: todayOrders.filter((o) => o.orderType === "delivery").length,
    pickup: todayOrders.filter((o) => o.orderType === "pickup").length,
    mesa: todayOrders.filter((o) => o.orderType === "presencial" || o.orderType === "mesa").length,
    balcao: todayOrders.filter((o) => !o.orderType || o.orderType === "balcao").length,
  }

  const byPayment = {
    money: todayOrders.filter((o) => o.paymentMethod === "money").reduce((s, o) => s + o.total, 0),
    card: todayOrders.filter((o) => o.paymentMethod === "card").reduce((s, o) => s + o.total, 0),
    pix: todayOrders.filter((o) => o.paymentMethod === "pix").reduce((s, o) => s + o.total, 0),
    online: todayOrders.filter((o) => o.paymentMethod === "online").reduce((s, o) => s + o.total, 0),
  }

  const productCount: Record<string, { name: string; count: number; total: number }> = {}
  for (const order of todayOrders) {
    try {
      const items = typeof order.items === "string" ? JSON.parse(order.items) : order.items
      for (const item of items) {
        if (!productCount[item.name]) productCount[item.name] = { name: item.name, count: 0, total: 0 }
        productCount[item.name].count += item.quantity
        productCount[item.name].total += item.price * item.quantity
      }
    } catch {}
  }
  const topProducts = Object.values(productCount).sort((a, b) => b.count - a.count).slice(0, 5)

  const salesByDay: Record<string, { date: string; total: number; count: number }> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000)
    salesByDay[d.toISOString().split("T")[0]] = { date: d.toISOString().split("T")[0], total: 0, count: 0 }
  }
  for (const order of weekSales) {
    const key = new Date(order.createdAt).toISOString().split("T")[0]
    if (salesByDay[key]) { salesByDay[key].total += order.total; salesByDay[key].count += 1 }
  }

  const lowStockItems = (stockItems as any[]).filter((s) => s.quantity <= s.minQuantity)

  return NextResponse.json({
    today: { total: todayTotal, count: todayCount, ticketMedio, vsYesterday: { total: todayTotal - yesterdayTotal, count: todayCount - yesterdayOrders.length, percentTotal: yesterdayTotal > 0 ? Math.round(((todayTotal - yesterdayTotal) / yesterdayTotal) * 100) : 0 } },
    month: { total: monthTotal },
    profit: { today: todayProfit, expenses: todayExpenses },
    active: { total: activeOrders.length, byStatus: activeByStatus },
    customers: { total: totalCustomers, newToday: newCustomersToday },
    motoboys: { total: deliveryPeople, free: deliveryPeople - busyMotoboys.size, busy: busyMotoboys.size },
    byType,
    byPayment,
    cashRegister: cashRegister ? { isOpen: true, openedAt: cashRegister.createdAt, openingBalance: cashRegister.openingAmount } : { isOpen: false },
    alerts: { lowStock: lowStockItems.length, pendingExpenses: expenses.length },
    recentOrders,
    topProducts,
    weekSales: Object.values(salesByDay),
  })
}