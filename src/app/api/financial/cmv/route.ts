import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const revalidate = 30

export async function GET(req: NextRequest) {
  const establishmentId = req.nextUrl.searchParams.get("establishmentId")
  const from = req.nextUrl.searchParams.get("from")
  const to = req.nextUrl.searchParams.get("to")

  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId required" }, { status: 400 })
  }

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

  // Busca pedidos não cancelados no período
  const orders = await prisma.order.findMany({
    where: orderWhere,
    select: {
      id: true,
      total: true,
      createdAt: true,
      itemCosts: { select: { totalCostCents: true } },
    },
  })

  // Totais gerais
  let revenueCents = 0
  let costCents = 0
  let ordersWithRecipe = 0
  let ordersWithoutRecipe = 0

  // Por dia
  const dayMap = new Map<string, { revenueCents: number; costCents: number; orderCount: number }>()

  // Por produto (top que mais gerou custo)
  const productMap = new Map<string, { productId: string | null; productName: string; quantity: number; totalCostCents: number }>()

  // Detalhe de itens
  const itemCosts = await prisma.orderItemCost.findMany({
    where: {
      order: { establishmentId, ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}), status: { not: "cancelled" } },
    },
    select: {
      productId: true,
      productName: true,
      quantity: true,
      unitCostCents: true,
      totalCostCents: true,
      orderId: true,
    },
  })

  for (const order of orders) {
    revenueCents += Math.round(order.total * 100)
    const orderCost = order.itemCosts.reduce((s, c) => s + c.totalCostCents, 0)
    costCents += orderCost
    if (order.itemCosts.length > 0) ordersWithRecipe++
    else ordersWithoutRecipe++

    const day = order.createdAt.toISOString().split("T")[0]
    if (!dayMap.has(day)) dayMap.set(day, { revenueCents: 0, costCents: 0, orderCount: 0 })
    const d = dayMap.get(day)!
    d.revenueCents += Math.round(order.total * 100)
    d.costCents += orderCost
    d.orderCount++
  }

  for (const ic of itemCosts) {
    const key = ic.productId || ic.productName
    if (!productMap.has(key)) {
      productMap.set(key, { productId: ic.productId, productName: ic.productName, quantity: 0, totalCostCents: 0 })
    }
    const p = productMap.get(key)!
    p.quantity += ic.quantity
    p.totalCostCents += ic.totalCostCents
  }

  const byDay = Array.from(dayMap.entries())
    .map(([day, v]) => ({
      day,
      revenueCents: v.revenueCents,
      costCents: v.costCents,
      marginCents: v.revenueCents - v.costCents,
      marginPercent: v.revenueCents > 0 ? ((v.revenueCents - v.costCents) / v.revenueCents) * 100 : 0,
      orderCount: v.orderCount,
    }))
    .sort((a, b) => a.day.localeCompare(b.day))

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.totalCostCents - a.totalCostCents)
    .slice(0, 20)
    .map((p) => ({
      productId: p.productId,
      productName: p.productName,
      quantity: p.quantity,
      totalCostCents: p.totalCostCents,
    }))

  const marginCents = revenueCents - costCents
  const marginPercent = revenueCents > 0 ? (marginCents / revenueCents) * 100 : 0

  return NextResponse.json({
    summary: {
      revenueCents,
      costCents,
      marginCents,
      marginPercent,
      ordersWithRecipe,
      ordersWithoutRecipe,
      totalOrders: orders.length,
    },
    byDay,
    topProducts,
  })
}
