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

    // Manual stories from DB
    const manualStories = await prisma.story.findMany({
      where: { establishmentId, type: "manual" },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, price: true, image: true, onSale: true, promoPrice: true } } },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { order: "asc" },
    })

    // Auto stories - always include them, check if any DB record exists for active state
    const autoTypes = ["maisVendidos", "lancamentos", "promocoes"]
    const autoLabels: Record<string, string> = {
      maisVendidos: "Mais Vendidos",
      lancamentos: "Lançamentos",
      promocoes: "Promoções",
    }
    const autoEmojis: Record<string, string> = {
      maisVendidos: "🔥",
      lancamentos: "✨",
      promocoes: "💰",
    }
    const autoGradients: Record<string, { from: string; to: string }> = {
      maisVendidos: { from: "from-red-500", to: "to-orange-500" },
      lancamentos: { from: "from-blue-500", to: "to-purple-500" },
      promocoes: { from: "from-green-500", to: "to-emerald-500" },
    }

    // Check which auto stories have DB records
    const existingAuto = await prisma.story.findMany({
      where: { establishmentId, type: "auto" },
      select: { id: true, autoType: true, active: true, order: true },
    })
    const existingAutoMap = new Map(existingAuto.map((s) => [s.autoType, s]))

    const autoStories = autoTypes.map((autoType, idx) => {
      const existing = existingAutoMap.get(autoType)
      return {
        id: existing?.id || `auto_${autoType}`,
        name: autoLabels[autoType],
        emoji: autoEmojis[autoType],
        gradientFrom: autoGradients[autoType].from,
        gradientTo: autoGradients[autoType].to,
        type: "auto",
        autoType,
        order: existing?.order ?? idx,
        active: existing?.active ?? true,
        items: [],
      }
    })

    // Sort all stories: auto first by order, then manual
    const allStories = [...autoStories, ...manualStories].sort((a, b) => a.order - b.order)

    return NextResponse.json(allStories)
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
