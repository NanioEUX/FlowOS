import { prisma } from "@/lib/prisma"
import { requireSaasAdmin } from "@/lib/saas-admin-auth"
import { NextResponse } from "next/server"

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSaasAdmin()
    const body = await req.json()
    const { botAgentName, botTone, botFAQ, botSystemPrompt, botGreeting } = body

    const establishment = await prisma.establishment.update({
      where: { id: params.id },
      data: {
        botAgentName: botAgentName || null,
        botTone: botTone || null,
        botFAQ: botFAQ || null,
        botSystemPrompt: botSystemPrompt || null,
        botGreeting: botGreeting || null,
      },
      select: {
        id: true,
        name: true,
        botAgentName: true,
        botTone: true,
        botFAQ: true,
        botSystemPrompt: true,
        botGreeting: true,
      },
    })

    return NextResponse.json({ success: true, establishment })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
