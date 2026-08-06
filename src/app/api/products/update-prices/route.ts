import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"
import { convertQuantity } from "@/lib/units"

export const dynamic = "force-dynamic"

function roundPrice(price: number, method: string): number {
  if (method === "integer") {
    return Math.round(price)
  }
  if (method === "point90") {
    const floor = Math.floor(price)
    if (price - floor <= 0.9) {
      return floor + 0.9
    }
    return floor + 1.9
  }
  return Math.round(price * 100) / 100
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { categoryId, stockItemId, rounding } = await req.json()

    let products: any[] = []

    if (categoryId) {
      products = await prisma.product.findMany({
        where: { categoryId },
        include: {
          stockLinks: { include: { stockItem: true } },
          category: true,
        },
      })
    } else if (stockItemId) {
      const links = await prisma.productStockLink.findMany({
        where: { stockItemId },
        include: {
          product: {
            include: {
              stockLinks: { include: { stockItem: true } },
              category: true,
            },
          },
        },
      })
      products = links.map((l) => l.product)
    } else {
      return NextResponse.json({ error: "categoryId ou stockItemId necessário" }, { status: 400 })
    }

    const updates: { productId: string; oldPrice: number; newPrice: number; productName: string }[] = []

    for (const product of products) {
      const category = product.category
      if (!category?.targetMarginPercent) continue

      let cost = 0
      for (const link of product.stockLinks) {
        const item = link.stockItem
        if (!item) continue
        const qty = Number(link.quantity) || 0
        const linkUnit = link.unit || "un"
        const stockUnit = item.unit || "un"
        const converted = convertQuantity(qty, linkUnit, stockUnit)
        if (converted === null) continue
        cost += converted * (item.unitCost || 0)
      }

      if (cost <= 0) continue

      const margin = category.targetMarginPercent / 100
      if (margin >= 1) continue

      const suggested = cost / (1 - margin)
      const rounded = roundPrice(suggested, rounding || category.priceRounding || "none")

      if (Math.abs(rounded - product.price) > 0.01) {
        updates.push({
          productId: product.id,
          oldPrice: product.price,
          newPrice: rounded,
          productName: product.name,
        })
      }
    }

    for (const update of updates) {
      await prisma.product.update({
        where: { id: update.productId },
        data: { price: update.newPrice },
      })
    }

    return NextResponse.json({ updated: updates.length, updates })
  } catch (error: any) {
    console.error("[UPDATE-PRICES]", error)
    return NextResponse.json({ error: error.message || "Erro ao atualizar preços" }, { status: 500 })
  }
}