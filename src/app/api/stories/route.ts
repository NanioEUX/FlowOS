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

  // Fetch configured stories from DB
  const dbStories = await prisma.story.findMany({
    where: { establishmentId, active: true },
    include: {
      items: {
        include: { product: { select: productSelect } },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { order: "asc" },
  })

  // Resolve auto stories
  const result: any[] = []

  for (const story of dbStories) {
    if (story.type === "auto" && story.autoType) {
      let products: any[] = []

      if (story.autoType === "maisVendidos") {
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
        if (topIds.length > 0) {
          products = await prisma.product.findMany({ where: { id: { in: topIds }, isAvailable: true }, select: productSelect })
          products.sort((a, b) => topIds.indexOf(a.id) - topIds.indexOf(b.id))
        }
      } else if (story.autoType === "lancamentos") {
        products = await prisma.product.findMany({
          where: { establishmentId, isAvailable: true, createdAt: { gte: sevenDaysAgo } },
          select: productSelect, orderBy: { createdAt: "desc" }, take: 10,
        })
      } else if (story.autoType === "promocoes") {
        products = await prisma.product.findMany({
          where: { establishmentId, isAvailable: true, onSale: true },
          select: productSelect, take: 10,
        })
      }

      result.push({
        id: story.id,
        name: story.name,
        emoji: story.emoji,
        gradientFrom: story.gradientFrom,
        gradientTo: story.gradientTo,
        type: story.type,
        autoType: story.autoType,
        products,
      })
    } else {
      // Manual story — use items from DB
      result.push({
        id: story.id,
        name: story.name,
        emoji: story.emoji,
        gradientFrom: story.gradientFrom,
        gradientTo: story.gradientTo,
        type: story.type,
        autoType: null,
        products: story.items.map((item) => item.product),
      })
    }
  }

  // Backward compat: also return combos
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
