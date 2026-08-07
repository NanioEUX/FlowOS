import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const MAX_PER_SECTION = 6
const DAYS_LOOKBACK = 30

/**
 * GET /api/products/featured?establishmentId=X
 *
 * Retorna 3 seções de carrosséis horizontais:
 *   1. trending (Mais Pedidos) - top por vendas últimos 30 dias + featured=true manual
 *   2. new (Lançamentos) - isNew=true com newUntil > now + order by createdAt
 *   3. promo (Promoções) - onSale=true com promoPrice
 */
export async function GET(req: NextRequest) {
  try {
    const establishmentId = req.nextUrl.searchParams.get("establishmentId")

    if (!establishmentId) {
      return NextResponse.json({ error: "establishmentId é obrigatório" }, { status: 400 })
    }

    const since = new Date()
    since.setDate(since.getDate() - DAYS_LOOKBACK)

    const productSelect = {
      id: true,
      name: true,
      price: true,
      promoPrice: true,
      image: true,
      badge: true,
      onSale: true,
      isNew: true,
      createdAt: true,
      additionalOptions: { select: { id: true }, take: 1 },
    }

    const [manualFeatured, recentOrders, newProducts, promoProducts] = await Promise.all([
      prisma.product.findMany({
        where: { establishmentId, featured: true, isAvailable: true },
        orderBy: [{ featuredOrder: "asc" }, { name: "asc" }],
        take: MAX_PER_SECTION,
        select: productSelect,
      }),
      prisma.order.findMany({
        where: {
          establishmentId,
          createdAt: { gte: since },
          status: { in: ["delivered", "completed", "confirmed", "preparing", "ready", "delivering"] },
        },
        select: { items: true },
        take: 500,
      }),
      prisma.product.findMany({
        where: {
          establishmentId,
          isAvailable: true,
          OR: [
            { isNew: true, newUntil: { gt: new Date() } },
            { isNew: true, newUntil: null },
            { createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: MAX_PER_SECTION,
        select: productSelect,
      }),
      prisma.product.findMany({
        where: { establishmentId, isAvailable: true, onSale: true, promoPrice: { not: null } },
        orderBy: { updatedAt: "desc" },
        take: MAX_PER_SECTION,
        select: productSelect,
      }),
    ])

    // Conta vendas por productId a partir do JSON items
    const salesCount = new Map<string, number>()
    for (const order of recentOrders) {
      try {
        const items = JSON.parse(order.items)
        for (const it of items) {
          if (!it?.id) continue
          salesCount.set(it.id, (salesCount.get(it.id) || 0) + (it.quantity || 1))
        }
      } catch {}
    }

    const topSoldIds = Array.from(salesCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_PER_SECTION)
      .map(([id]) => id)

    const topProducts = topSoldIds.length
      ? await prisma.product.findMany({
          where: { id: { in: topSoldIds }, isAvailable: true, featured: false },
          select: productSelect,
        })
      : []

    const orderMap = new Map(topSoldIds.map((id, i) => [id, i]))
    topProducts.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))

    const seenTrending = new Set(manualFeatured.map((p) => p.id))
    const autoTrending = topProducts.filter((p) => !seenTrending.has(p.id))
    const trending = [...manualFeatured, ...autoTrending].slice(0, MAX_PER_SECTION)

    const mapItems = (ps: typeof trending) =>
      ps.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.promoPrice ?? p.price,
        originalPrice: p.onSale ? p.price : null,
        image: p.image,
        badge: p.badge,
        onSale: p.onSale,
        hasOptions: p.additionalOptions.length > 0,
      }))

    return NextResponse.json({
      success: true,
      sections: {
        trending: mapItems(trending),
        new: mapItems(newProducts),
        promo: mapItems(promoProducts),
      },
    })
  } catch (error: any) {
    console.error("[Featured Products]", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
