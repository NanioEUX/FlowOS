import { prisma } from "@/lib/prisma"
import { requireSaasAdmin } from "@/lib/saas-admin-auth"
import { NextResponse } from "next/server"

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    await requireSaasAdmin()
    const template = await prisma.categoryTemplate.findUnique({ where: { id: params.id } })
    if (!template) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
    return NextResponse.json(template)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSaasAdmin()
    const body = await req.json()
    const { slug, name, icon, description, tone, promptBase, defaultAgentName, defaultMenuJson, order, enabled } = body

    const template = await prisma.categoryTemplate.update({
      where: { id: params.id },
      data: {
        slug,
        name,
        icon,
        description,
        tone: tone || "casual",
        promptBase,
        defaultAgentName: defaultAgentName || "Atendente",
        defaultMenuJson,
        order: order ?? 0,
        enabled: enabled !== false,
      },
    })

    return NextResponse.json({ success: true, template })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await requireSaasAdmin()
    await prisma.categoryTemplate.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
