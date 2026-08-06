import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const establishmentId = req.nextUrl.searchParams.get("establishmentId")
  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId required" }, { status: 400 })
  }

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const productSelect = { id: true, name: true, price: true, image: true, badge: true, description: true, onSale: true, promoPrice: true }

  const result: any[] = []

  // 1. Always include MAIS VENDIDOS (auto)
  const orders = await prisma.order.findMany({
    where: { establishmentId, createdAt: { gte: thirtyDaysAgo }, status: { notIn: ["cancelled"] } },
    select: { items: true },
  })
  const productSales: Record<string, number> = {}
  for (const order of orders) {
    try {
      const items = typeof order.items === "string" ? JSON.parse(order.items) : order.items
      for (const item of items) {
        if (item.productId) productSales[item.productId] = (productSales[item.productId] || 0) + (item.quantity || 1)
      }
    } catch {}
  }
  const topIds = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id)
  let maisVendidosProducts: any[] = []
  if (topIds.length > 0) {
    maisVendidosProducts = await prisma.product.findMany({ where: { id: { in: topIds }, isAvailable: true }, select: productSelect })
    maisVendidosProducts.sort((a, b) => topIds.indexOf(a.id) - topIds.indexOf(b.id))
  }
  result.push({
    id: "auto_maisVendidos",
    name: "Mais Vendidos",
    emoji: "🔥",
    gradientFrom: "from-red-500",
    gradientTo: "to-orange-500",
    type: "auto",
    autoType: "maisVendidos",
    products: maisVendidosProducts,
  })

  // 2. Always include LANCAMENTOS (auto)
  const lancamentosProducts = await prisma.product.findMany({
    where: { establishmentId, isAvailable: true, createdAt: { gte: sevenDaysAgo } },
    select: productSelect, orderBy: { createdAt: "desc" }, take: 10,
  })
  result.push({
    id: "auto_lancamentos",
    name: "Lançamentos",
    emoji: "✨",
    gradientFrom: "from-blue-500",
    gradientTo: "to-purple-500",
    type: "auto",
    autoType: "lancamentos",
    products: lancamentosProducts,
  })

  // 3. Always include PROMOCOES (auto)
  const promocoesProducts = await prisma.product.findMany({
    where: { establishmentId, isAvailable: true, onSale: true },
    select: productSelect, take: 10,
  })
  result.push({
    id: "auto_promocoes",
    name: "Promoções",
    emoji: "💰",
    gradientFrom: "from-green-500",
    gradientTo: "to-emerald-500",
    type: "auto",
    autoType: "promocoes",
    products: promocoesProducts,
  })

  // 4. Fetch manual stories from DB
  const manualStories = await prisma.story.findMany({
    where: { establishmentId, active: true, type: "manual" },
    include: {
      items: {
        include: { product: { select: productSelect } },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { order: "asc" },
  })

  for (const story of manualStories) {
    result.push({
      id: story.id,
      name: story.name,
      emoji: story.emoji,
      gradientFrom: story.gradientFrom,
      gradientTo: story.gradientTo,
      type: "manual",
      autoType: null,
      products: story.items.map((item) => item.product),
    })
  }

  // Combos (daily combos)
  const combos = await prisma.dailyCombo.findMany({
    where: { establishmentId, active: true },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, price: true, image: true, onSale: true, promoPrice: true } } },
      },
    },
    take: 5,
  })

  return NextResponse.json({ stories: result, combos })
}
