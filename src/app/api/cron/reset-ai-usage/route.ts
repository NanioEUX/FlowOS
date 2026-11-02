import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getRequestId, logger } from "@/lib/logger"

// F3D-002: o cron do Vercel chama GET — antes o GET só respondia {status:"ok"}
// e o reset mensal do contador de IA (aiMessagesUsed) nunca rodava de verdade
// (nada mais no código zera o contador; sem isso, o limite mensal nunca renovava).
async function runReset(req: NextRequest) {
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

    logger.info("cron-reset-ai-usage", "uso de IA resetado", { requestId: getRequestId(req), count: result.count })

    return NextResponse.json({
      success: true,
      resetCount: result.count,
      resetAt: now.toISOString(),
    })
  } catch (error: any) {
    logger.error("cron-reset-ai-usage", "falha ao resetar o uso de IA", { requestId: getRequestId(req), error: error?.message })
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return runReset(req)
}

export async function GET(req: NextRequest) {
  return runReset(req)
}
