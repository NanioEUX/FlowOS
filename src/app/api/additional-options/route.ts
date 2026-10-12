import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireEstablishment } from "@/lib/require-auth"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const productId = searchParams.get("productId")
  const establishmentId = searchParams.get("establishmentId")

  if (!productId && !establishmentId) {
    return NextResponse.json({ error: "productId ou establishmentId necessário" }, { status: 400 })
  }

  const where: any = {}
  if (productId) where.productId = productId
  if (establishmentId) where.establishmentId = establishmentId

  const options = await prisma.additionalOption.findMany({
    where,
    orderBy: { order: "asc" },
  })

  return NextResponse.json(options)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, price, selectionType, inputType, groupName, headerText, maxSelection, minSelection, productId, establishmentId, consumesStock, stockProductId, stockQuantity, stockUnit } = body

    if (!name || !productId || !establishmentId) {
      return NextResponse.json({ error: "name, productId e establishmentId obrigatórios" }, { status: 400 })
    }

    const { user, error } = requireEstablishment(req, establishmentId)
    if (error) return error

    // Verify product belongs to this establishment
    const product = await prisma.product.findFirst({
      where: { id: productId, establishmentId: user.establishmentId },
      select: { id: true },
    })
    if (!product) {
      return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 })
    }

    const maxOrder = await prisma.additionalOption.findFirst({
      where: { productId },
      orderBy: { order: "desc" },
      select: { order: true },
    })

    const maxGroupOrder = await prisma.additionalOption.findFirst({
      where: { productId, groupName: groupName || null },
      orderBy: { groupOrder: "desc" },
      select: { groupOrder: true },
    })

    const option = await prisma.additionalOption.create({
      data: {
        name,
        price: price || 0,
        selectionType: selectionType || "single",
        inputType: inputType || "radio",
        groupName: groupName || null,
        headerText: headerText || null,
        maxSelection: maxSelection || null,
        minSelection: selectionType === "required" ? (minSelection || 1) : null,
        consumesStock: consumesStock || false,
        stockProductId: stockProductId || null,
        stockQuantity: stockQuantity || 1,
        stockUnit: stockUnit || "un",
        order: (maxOrder?.order || 0) + 1,
        groupOrder: (maxGroupOrder?.groupOrder || 0),
        productId,
        establishmentId: user.establishmentId,
      },
    })

    return NextResponse.json(option)
  } catch (error: any) {
    console.error("[ADDITIONAL-OPTION POST]", error)
    return NextResponse.json({ error: error.message || "Erro ao criar opção" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user, error } = requireEstablishment(req)
    if (error) return error

    const body = await req.json()
    const { id, ...data } = body

    if (!id) {
      return NextResponse.json({ error: "id obrigatório" }, { status: 400 })
    }

    // Verify option belongs to this establishment
    const existing = await prisma.additionalOption.findFirst({
      where: { id, establishmentId: user.establishmentId },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: "Opção não encontrada" }, { status: 404 })
    }

    // Prevent client from changing tenant
    delete data.establishmentId

    const option = await prisma.additionalOption.update({
      where: { id },
      data,
    })

    return NextResponse.json(option)
  } catch (error: any) {
    console.error("[ADDITIONAL-OPTION PATCH]", error)
    return NextResponse.json({ error: error.message || "Erro ao atualizar opção" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user, error } = requireEstablishment(req)
    if (error) return error

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "id obrigatório" }, { status: 400 })
    }

    // Verify option belongs to this establishment
    const existing = await prisma.additionalOption.findFirst({
      where: { id, establishmentId: user.establishmentId },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: "Opção não encontrada" }, { status: 404 })
    }

    await prisma.additionalOption.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[ADDITIONAL-OPTION DELETE]", error)
    return NextResponse.json({ error: error.message || "Erro ao deletar opção" }, { status: 500 })
  }
}
