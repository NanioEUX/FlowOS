import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const establishmentId = req.nextUrl.searchParams.get("establishmentId")
  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId required" }, { status: 400 })
  }

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const productSelect = { id: true, name: true, price: true, image: true, badge: true, description: true, onSale: true, promoPrice: true }

  // 1. Mais Vendidos - top 10 products by order count (last 30 days)
  const orders = await prisma.order.findMany({
    where: {
      establishmentId,
      createdAt: { gte: thirtyDaysAgo },
      status: { notIn: ["cancelled"] },
    },
    select: { items: true },
  })

  const productSales: Record<string, { name: string; quantity: number; productId: string }> = {}
  for (const order of orders) {
    try {
      const items = typeof order.items === "string" ? JSON.parse(order.items) : order.items
      for (const item of items) {
        if (item.productId) {
          if (!productSales[item.productId]) {
            productSales[item.productId] = { name: item.name, quantity: 0, productId: item.productId }
          }
          productSales[item.productId].quantity += item.quantity || 1
        }
      }
    } catch {}
  }

  const topSellingIds = Object.values(productSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10)
    .map((p) => p.productId)

  const maisVendidos = topSellingIds.length > 0
    ? await prisma.product.findMany({
        where: { id: { in: topSellingIds }, isAvailable: true },
        select: productSelect,
      })
    : []

  // 2. Lançamentos - products created in last 7 days
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const lancamentos = await prisma.product.findMany({
    where: {
      establishmentId,
      isAvailable: true,
      createdAt: { gte: sevenDaysAgo },
    },
    select: productSelect,
    orderBy: { createdAt: "desc" },
    take: 10,
  })

  // 3. Promoções - products with onSale = true
  const promocoes = await prisma.product.findMany({
    where: {
      establishmentId,
      isAvailable: true,
      onSale: true,
    },
    select: productSelect,
    take: 10,
  })

  // 4. Combos do Dia - manual configuration
  const combos = await prisma.dailyCombo.findMany({
    where: { establishmentId, active: true },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, price: true, image: true, onSale: true, promoPrice: true } } },
      },
    },
    take: 5,
  })

  return NextResponse.json({
    maisVendidos: maisVendidos.sort((a, b) => {
      const aIdx = topSellingIds.indexOf(a.id)
      const bIdx = topSellingIds.indexOf(b.id)
      return aIdx - bIdx
    }),
    combos,
    lancamentos,
    promocoes,
  })
}
