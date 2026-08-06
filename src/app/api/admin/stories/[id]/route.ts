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

    if (body.name !== undefined) data.name = body.name
    if (body.emoji !== undefined) data.emoji = body.emoji
    if (body.gradientFrom !== undefined) data.gradientFrom = body.gradientFrom
    if (body.gradientTo !== undefined) data.gradientTo = body.gradientTo
    if (body.type !== undefined) data.type = body.type
    if (body.autoType !== undefined) data.autoType = body.autoType || null
    if (body.order !== undefined) data.order = body.order
    if (body.active !== undefined) data.active = body.active

    const story = await prisma.story.update({
      where: { id: params.id },
      data,
    })

    return NextResponse.json(story)
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

    await prisma.storyItem.deleteMany({ where: { storyId: params.id } })
    await prisma.story.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
