import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const MAX_PER_SECTION = 6

/**
 * GET /api/products/featured?establishmentId=X
 *
 * Retorna 3 seções de carrosséis horizontais:
 *   1. trending (Destaques) - apenas produtos com featured=true manual
 *   2. new (Lançamentos) - isNew=true ou criados recentemente
 *   3. promo (Promoções) - onSale=true com promoPrice
 */
export async function GET(req: NextRequest) {
  try {
    const establishmentId = req.nextUrl.searchParams.get("establishmentId")

    if (!establishmentId) {
      return NextResponse.json({ error: "establishmentId é obrigatório" }, { status: 400 })
    }

    const productSelect = {
      id: true,
      name: true,
      price: true,
      promoPrice: true,
      featuredDiscountPrice: true,
      image: true,
      badge: true,
      onSale: true,
      featured: true,
      isNew: true,
      zoomEnabled: true,
      createdAt: true,
      additionalOptions: { select: { id: true }, take: 1 },
    }

    const [trending, newProducts, promoProducts] = await Promise.all([
      prisma.product.findMany({
        where: { establishmentId, featured: true, isAvailable: true },
        orderBy: [{ featuredOrder: "asc" }, { name: "asc" }],
        take: MAX_PER_SECTION,
        select: productSelect,
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
        where: { establishmentId, isAvailable: true, onSale: true, promoPrice: { not: null }, featured: false },
        orderBy: { updatedAt: "desc" },
        take: MAX_PER_SECTION,
        select: productSelect,
      }),
    ])

    const mapItems = (ps: typeof trending) =>
      ps.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.promoPrice ?? p.featuredDiscountPrice ?? p.price,
        originalPrice: p.onSale ? p.price : p.featuredDiscountPrice ? p.price : null,
        image: p.image,
        badge: p.badge,
        onSale: p.onSale,
        featured: p.featured,
        featuredDiscountPrice: p.featuredDiscountPrice,
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
