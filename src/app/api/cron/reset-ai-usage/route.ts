import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET || "dev-secret"

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const result = await prisma.establishment.updateMany({
      where: {
        whatsappAutomationEnabled: true,
        OR: [
          { aiMessagesResetAt: null },
          { aiMessagesResetAt: { lt: startOfMonth } },
        ],
      },
      data: {
        aiMessagesUsed: 0,
        aiMessagesResetAt: now,
      },
    })

    console.log(`[Cron] Reset IA usage para ${result.count} estabelecimentos`)

    return NextResponse.json({
      success: true,
      resetCount: result.count,
      resetAt: now.toISOString(),
    })
  } catch (error: any) {
    console.error("[Cron Reset AI Usage] Erro:", error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "reset-ai-usage" })
}
