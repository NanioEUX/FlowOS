import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

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
    const authUser = await verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await req.json()
    const { name, price, selectionType, productId, establishmentId } = body

    if (!name || !productId || !establishmentId) {
      return NextResponse.json({ error: "name, productId e establishmentId obrigatórios" }, { status: 400 })
    }

    const maxOrder = await prisma.additionalOption.findFirst({
      where: { productId },
      orderBy: { order: "desc" },
      select: { order: true },
    })

    const option = await prisma.additionalOption.create({
      data: {
        name,
        price: price || 0,
        selectionType: selectionType || "single",
        order: (maxOrder?.order || 0) + 1,
        productId,
        establishmentId,
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
    const authUser = await verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await req.json()
    const { id, ...data } = body

    if (!id) {
      return NextResponse.json({ error: "id obrigatório" }, { status: 400 })
    }

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
    const authUser = await verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "id obrigatório" }, { status: 400 })
    }

    await prisma.additionalOption.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[ADDITIONAL-OPTION DELETE]", error)
    return NextResponse.json({ error: error.message || "Erro ao deletar opção" }, { status: 500 })
  }
}