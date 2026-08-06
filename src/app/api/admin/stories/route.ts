import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const establishmentId = req.nextUrl.searchParams.get("establishmentId")
    if (!establishmentId) return NextResponse.json({ error: "establishmentId required" }, { status: 400 })

    const stories = await prisma.story.findMany({
      where: { establishmentId },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, price: true, image: true, onSale: true, promoPrice: true } } },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { order: "asc" },
    })

    return NextResponse.json(stories)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const body = await req.json()
    const { name, emoji, gradientFrom, gradientTo, type, autoType, establishmentId } = body

    if (!name || !establishmentId) {
      return NextResponse.json({ error: "Nome e establishmentId obrigatórios" }, { status: 400 })
    }

    const maxOrder = await prisma.story.findFirst({
      where: { establishmentId },
      orderBy: { order: "desc" },
      select: { order: true },
    })

    const story = await prisma.story.create({
      data: {
        name,
        emoji: emoji || "🔥",
        gradientFrom: gradientFrom || "from-red-500",
        gradientTo: gradientTo || "to-orange-500",
        type: type || "manual",
        autoType: autoType || null,
        order: (maxOrder?.order ?? -1) + 1,
        establishmentId,
      },
    })

    return NextResponse.json(story)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
