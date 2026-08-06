import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const { productId } = await req.json()
    if (!productId) return NextResponse.json({ error: "productId obrigatório" }, { status: 400 })

    const existing = await prisma.storyItem.findUnique({
      where: { storyId_productId: { storyId: params.id, productId } },
    })
    if (existing) return NextResponse.json({ error: "Produto já está no story" }, { status: 400 })

    const maxOrder = await prisma.storyItem.findFirst({
      where: { storyId: params.id },
      orderBy: { order: "desc" },
      select: { order: true },
    })

    const item = await prisma.storyItem.create({
      data: {
        storyId: params.id,
        productId,
        order: (maxOrder?.order ?? -1) + 1,
      },
      include: { product: { select: { id: true, name: true, price: true, image: true, onSale: true, promoPrice: true } } },
    })

    return NextResponse.json(item)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const productId = searchParams.get("productId")
    if (!productId) return NextResponse.json({ error: "productId obrigatório" }, { status: 400 })

    await prisma.storyItem.deleteMany({
      where: { storyId: params.id, productId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
