import { prisma } from "@/lib/prisma"
import { requireSaasAdmin } from "@/lib/saas-admin-auth"
import { NextResponse } from "next/server"

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    await requireSaasAdmin()
    const rule = await prisma.globalQuickReply.findUnique({ where: { id: params.id } })
    if (!rule) return NextResponse.json({ error: "Não encontrada" }, { status: 404 })
    return NextResponse.json(rule)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSaasAdmin()
    const body = await req.json()
    const { category, label, triggers, response, matchType, order, enabled } = body

    const rule = await prisma.globalQuickReply.update({
      where: { id: params.id },
      data: {
        category,
        label,
        triggers,
        response,
        matchType: matchType || "any",
        order: order ?? 0,
        enabled: enabled !== false,
      },
    })

    return NextResponse.json({ success: true, rule })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await requireSaasAdmin()
    await prisma.globalQuickReply.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
