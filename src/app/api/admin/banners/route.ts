import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireEstablishment } from "@/lib/require-auth"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const establishmentId = req.nextUrl.searchParams.get("establishmentId")
    if (!establishmentId) return NextResponse.json({ error: "establishmentId required" }, { status: 400 })

    // F1B/F2-001: escopo de tenant (o front sempre envia o próprio id)
    const { error } = requireEstablishment(req, establishmentId)
    if (error) return error

    const banners = await prisma.banner.findMany({
      where: { establishmentId },
      orderBy: { order: "asc" },
    })

    return NextResponse.json(banners)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, subtitle, ctaText, ctaType, ctaTarget, gradientFrom, gradientTo, image, establishmentId } = body

    if (!title || !establishmentId) {
      return NextResponse.json({ error: "Título e establishmentId obrigatórios" }, { status: 400 })
    }

    // F1B/F2-001: establishmentId do body precisa bater com o do JWT
    // (antes um token criava banner em qualquer loja)
    const { error } = requireEstablishment(req, establishmentId)
    if (error) return error

    const maxOrder = await prisma.banner.findFirst({
      where: { establishmentId },
      orderBy: { order: "desc" },
      select: { order: true },
    })

    const banner = await prisma.banner.create({
      data: {
        title,
        subtitle: subtitle || null,
        ctaText: ctaText || "Ver mais",
        ctaType: ctaType || "scroll",
        ctaTarget: ctaTarget || null,
        gradientFrom: gradientFrom || "from-blue-500",
        gradientTo: gradientTo || "to-purple-500",
        image: image || null,
        order: (maxOrder?.order ?? -1) + 1,
        establishmentId,
      },
    })

    return NextResponse.json(banner)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
