import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Stock: 10s cache
export const revalidate = 10

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const establishmentId = searchParams.get("establishmentId")
  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId necessário" }, { status: 400 })
  }

  const [categories, items, movements] = await Promise.all([
    prisma.stockCategory.findMany({
      where: { establishmentId },
      orderBy: { order: "asc" },
    }),
    prisma.stockItem.findMany({
      where: { establishmentId },
      include: {
        category: { select: { name: true } },
        productLinks: { include: { product: { select: { name: true } } } },
        products: { select: { id: true, name: true } },
        supplierRef: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.stockMovement.findMany({
      where: { item: { establishmentId } },
      include: { item: { select: { name: true, unit: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ])

  return NextResponse.json({ categories, items, movements })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, establishmentId } = body

    if (type === "category") {
      const cat = await prisma.stockCategory.create({
        data: { name: body.name, establishmentId },
      })
      return NextResponse.json(cat)
    }

    if (type === "item") {
      const item = await prisma.stockItem.create({
        data: {
          name: body.name,
          unit: body.unit || "un",
          quantity: body.quantity || 0,
          minQuantity: body.minQuantity || 0,
          unitCost: body.unitCost || 0,
          supplier: body.supplier,
          supplierId: body.supplierId || null,
          categoryId: body.categoryId,
          establishmentId,
        },
      })
      return NextResponse.json(item)
    }

    if (type === "movement") {
      const item = await prisma.stockItem.findUnique({ where: { id: body.itemId } })
      if (!item) {
        return NextResponse.json({ error: "Item não encontrado" }, { status: 404 })
      }

      const newQty = body.movementType === "entry"
        ? item.quantity + body.quantity
        : item.quantity - body.quantity

      if (newQty < 0) {
        return NextResponse.json({ error: "Estoque insuficiente" }, { status: 400 })
      }

      let updateData: any = { quantity: newQty }
      let costAlert = null

      if (body.movementType === "entry" && body.unitCost > 0) {
        const oldCost = item.unitCost
        const newCost = body.unitCost
        const costChanged = Math.abs(newCost - oldCost) > 0.01

        if (costChanged) {
          const diff = ((newCost - oldCost) / oldCost * 100).toFixed(1)
          const isHigher = newCost > oldCost

          if (body.costMethod === "average" && item.quantity > 0) {
            const totalOldValue = item.quantity * oldCost
            const totalNewValue = body.quantity * newCost
            const avgCost = (totalOldValue + totalNewValue) / (item.quantity + body.quantity)
            updateData.unitCost = Math.round(avgCost * 100) / 100
            updateData.previousUnitCost = oldCost
            costAlert = `Custo médio atualizado: R$ ${oldCost.toFixed(2)} → R$ ${updateData.unitCost.toFixed(2)} (${isHigher ? "+" : ""}${diff}%)`
          } else {
            updateData.unitCost = newCost
            updateData.previousUnitCost = oldCost
            costAlert = `Custo atualizado: R$ ${oldCost.toFixed(2)} → R$ ${newCost.toFixed(2)} (${isHigher ? "+" : ""}${diff}%)`
          }
        }
      }

      await prisma.stockItem.update({
        where: { id: body.itemId },
        data: updateData,
      })

      const movement = await prisma.stockMovement.create({
        data: {
          type: body.movementType,
          quantity: body.quantity,
          unitCost: body.unitCost,
          notes: body.notes,
          itemId: body.itemId,
        },
      })
      return NextResponse.json({ ...movement, costAlert })
    }

    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 })
  }
}
