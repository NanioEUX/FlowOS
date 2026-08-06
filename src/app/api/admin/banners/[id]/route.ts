import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const body = await req.json()
    const data: any = {}

    if (body.title !== undefined) data.title = body.title
    if (body.subtitle !== undefined) data.subtitle = body.subtitle || null
    if (body.ctaText !== undefined) data.ctaText = body.ctaText || null
    if (body.ctaType !== undefined) data.ctaType = body.ctaType
    if (body.ctaTarget !== undefined) data.ctaTarget = body.ctaTarget || null
    if (body.gradientFrom !== undefined) data.gradientFrom = body.gradientFrom
    if (body.gradientTo !== undefined) data.gradientTo = body.gradientTo
    if (body.image !== undefined) data.image = body.image || null
    if (body.order !== undefined) data.order = body.order
    if (body.active !== undefined) data.active = body.active

    const banner = await prisma.banner.update({
      where: { id: params.id },
      data,
    })

    return NextResponse.json(banner)
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

    await prisma.banner.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
