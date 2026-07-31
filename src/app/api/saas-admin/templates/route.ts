import { prisma } from "@/lib/prisma"
import { requireSaasAdmin } from "@/lib/saas-admin-auth"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    await requireSaasAdmin()
    const body = await req.json()
    const { slug, name, icon, description, tone, promptBase, defaultAgentName, defaultMenuJson, order, enabled } = body

    if (!slug || !name || !promptBase) {
      return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 })
    }

    const template = await prisma.categoryTemplate.create({
      data: {
        slug,
        name,
        icon,
        description,
        tone: tone || "casual",
        promptBase,
        defaultAgentName: defaultAgentName || "Atendente",
        defaultMenuJson,
        order: order || 0,
        enabled: enabled !== false,
      },
    })

    return NextResponse.json({ success: true, template })
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Slug já existe" }, { status: 409 })
    }
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
