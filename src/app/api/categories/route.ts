import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Categories + products: 30s cache
export const revalidate = 30

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const establishmentId = searchParams.get("establishmentId")

  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId necessário" }, { status: 400 })
  }

  const categories = await prisma.category.findMany({
    where: { establishmentId },
    include: {
      products: {
        orderBy: { order: "asc" },
        include: {
          stockLinks: true,
          stockItem: true,
        },
      },
    },
    orderBy: { order: "asc" },
  })

  return NextResponse.json(categories)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (body.type === "category") {
      const cat = await prisma.category.create({
        data: {
          name: body.name,
          order: body.order || 0,
          establishmentId: body.establishmentId,
        },
      })
      return NextResponse.json(cat)
    }

    if (body.type === "product") {
      const product = await prisma.product.create({
        data: {
          name: body.name,
          description: body.description,
          price: body.price,
          image: body.image,
          badge: body.badge || null,
          sendToPrep: body.sendToPrep || false,
          order: body.order ?? 0,
          stockItemId: body.stockItemId || null,
          categoryId: body.categoryId,
          establishmentId: body.establishmentId,
        },
      })
      return NextResponse.json(product)
    }

    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao criar" }, { status: 500 })
  }
}
