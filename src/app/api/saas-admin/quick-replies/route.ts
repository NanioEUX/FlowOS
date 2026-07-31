import { prisma } from "@/lib/prisma"
import { requireSaasAdmin } from "@/lib/saas-admin-auth"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    await requireSaasAdmin()
    const body = await req.json()
    const { category, label, triggers, response, matchType, order, enabled } = body

    if (!category || !label || !triggers || !response) {
      return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 })
    }

    const rule = await prisma.globalQuickReply.create({
      data: {
        category,
        label,
        triggers,
        response,
        matchType: matchType || "any",
        order: order || 0,
        enabled: enabled !== false,
      },
    })

    return NextResponse.json({ success: true, rule })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
