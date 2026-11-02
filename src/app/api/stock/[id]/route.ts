import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"
import { pickUpdateData } from "@/lib/safe-update"

// F2-001 — mass assignment: whitelist de escalares por modelo. establishmentId
// fica de fora (evita mover registro para outro tenant), id/createdAt também,
// e objetos são descartados (nested write).
const STOCK_FAMILY_FIELDS = ["name", "type", "order"] as const
const STOCK_CATEGORY_FIELDS = ["name", "order", "familyId"] as const
const STOCK_ITEM_FIELDS = [
  "name", "unit", "quantity", "minQuantity", "unitCost", "previousUnitCost",
  "packageQty", "useUnit", "supplier", "supplierId", "categoryId",
] as const

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    const establishmentId = authUser.establishmentId
    const body = await req.json()
    const { type } = body

    if (type === "family") {
      const family = await prisma.stockFamily.findUnique({ where: { id: params.id } })
      if (!family || family.establishmentId !== establishmentId) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
      }
      const updated = await prisma.stockFamily.update({
        where: { id: params.id },
        data: pickUpdateData(body, STOCK_FAMILY_FIELDS),
      })
      return NextResponse.json(updated)
    }

    if (type === "category") {
      const cat = await prisma.stockCategory.findUnique({ where: { id: params.id } })
      if (!cat || cat.establishmentId !== establishmentId) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
      }
      const data = pickUpdateData(body, STOCK_CATEGORY_FIELDS)
      if (data.familyId === "") data.familyId = null
      const updated = await prisma.stockCategory.update({
        where: { id: params.id },
        data,
      })
      return NextResponse.json(updated)
    }

    const item = await prisma.stockItem.findUnique({ where: { id: params.id } })
    if (!item || item.establishmentId !== establishmentId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
    }
    const data = pickUpdateData(body, STOCK_ITEM_FIELDS)
    if (data.supplierId === "") data.supplierId = null
    if (data.supplier === "") data.supplier = null
    // Back-fill: o front envia `familyId` junto do item (StockItem não tem essa
    // coluna — ela fica fora da whitelist); se a categoria escolhida não tiver
    // família, herda a enviada. Lido do body cru, não do data já filtrado.
    const familyId = typeof body.familyId === "string" ? body.familyId : ""
    if (familyId && data.categoryId) {
      const cat = await prisma.stockCategory.findUnique({ where: { id: data.categoryId as string } })
      if (cat && !cat.familyId) {
        await prisma.stockCategory.update({
          where: { id: data.categoryId as string },
          data: { familyId },
        })
      }
    }
    const updated = await prisma.stockItem.update({
      where: { id: params.id },
      data,
    })
    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    const establishmentId = authUser.establishmentId
    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type") || "item"

    if (type === "family") {
      const family = await prisma.stockFamily.findUnique({ where: { id: params.id } })
      if (!family || family.establishmentId !== establishmentId) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
      }
      await prisma.stockFamily.delete({ where: { id: params.id } })
      return NextResponse.json({ deleted: true })
    }

    if (type === "category") {
      const cat = await prisma.stockCategory.findUnique({ where: { id: params.id } })
      if (!cat || cat.establishmentId !== establishmentId) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
      }
      await prisma.stockCategory.delete({ where: { id: params.id } })
      return NextResponse.json({ deleted: true })
    }

    const item = await prisma.stockItem.findUnique({ where: { id: params.id } })
    if (!item || item.establishmentId !== establishmentId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
    }
    await prisma.stockItem.delete({ where: { id: params.id } })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return NextResponse.json({ error: "Erro ao deletar" }, { status: 500 })
  }
}
