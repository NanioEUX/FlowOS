import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const { stockItemId, productId, quantity } = await req.json()
    if (!stockItemId || !productId || !quantity) {
      return NextResponse.json({ error: "stockItemId, productId e quantity obrigatórios" }, { status: 400 })
    }

    const stockItem = await prisma.stockItem.findUnique({ where: { id: stockItemId } })
    if (!stockItem || stockItem.establishmentId !== authUser.establishmentId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
    }

    const link = await prisma.productStockLink.upsert({
      where: { productId_stockItemId: { productId, stockItemId } },
      update: { quantity: parseFloat(quantity) },
      create: { productId, stockItemId, quantity: parseFloat(quantity) },
    })

    return NextResponse.json(link)
  } catch (error) {
    return NextResponse.json({ error: "Erro ao vincular" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const { stockItemId, productId } = await req.json()
    if (!stockItemId || !productId) {
      return NextResponse.json({ error: "stockItemId e productId obrigatórios" }, { status: 400 })
    }

    await prisma.productStockLink.deleteMany({
      where: { stockItemId, productId },
    })

    return NextResponse.json({ deleted: true })
  } catch (error) {
    return NextResponse.json({ error: "Erro ao desvincular" }, { status: 500 })
  }
}
