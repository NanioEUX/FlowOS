import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireEstablishment } from "@/lib/require-auth"

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
      },
    },
    orderBy: { order: "asc" },
  })

  return NextResponse.json(categories)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { establishmentId } = body

    if (!establishmentId) {
      return NextResponse.json({ error: "establishmentId obrigatório" }, { status: 400 })
    }

    const { user, error } = requireEstablishment(req, establishmentId)
    if (error) return error

    if (body.type === "category") {
      const cat = await prisma.category.create({
        data: {
          name: body.name,
          emoji: body.emoji || null,
          order: body.order || 0,
          establishmentId: user.establishmentId,
          targetMarginPercent: body.targetMarginPercent ?? null,
          priceRounding: body.priceRounding || "none",
          syncToIfood: body.syncToIfood ?? true,
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
          availableOnline: body.availableOnline ?? true,
          availablePresencial: body.availablePresencial ?? true,
          availableWhatsapp: body.availableWhatsapp ?? true,
          order: body.order ?? 0,
          stockItemId: body.stockItemId || null,
          categoryId: body.categoryId,
          establishmentId: user.establishmentId,
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
