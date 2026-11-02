import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { process99Event } from "@/lib/webhook-99"

export const runtime = "nodejs"

/**
 * GET /api/cron/replay-webhooks
 *
 * F4A-009/F4B-006/F4B-021: a tabela `LogWebhook99` guardava o evento, mas
 * **ninguém a relia** — um evento que falhou ficava "erro" para sempre e o
 * pedido travava em `out_for_delivery`. Este cron reprocessa o que ficou
 * "pendente" ou "erro".
 *
 * Só reprocessa eventos com mais de 2 minutos (evita competir com o retry
 * imediato do provedor) e no máximo 50 por execução (janela de 60s).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const since = new Date(Date.now() - 2 * 60 * 1000)

  const pending = await prisma.logWebhook99.findMany({
    where: {
      statusProcessamento: { in: ["pendente", "erro"] },
      createdAt: { lte: since },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  })

  if (pending.length === 0) {
    return NextResponse.json({ checked: 0, replayed: 0, results: [] })
  }

  const results: { id: string; rideId: string | null; status: string; detail?: string }[] = []

  for (const log of pending) {
    const payload = log.payload as any
    try {
      const result = await process99Event(payload)
      if (result.status === "processed") {
        await prisma.logWebhook99.update({
          where: { id: log.id },
          data: { statusProcessamento: "processado" },
        })
      } else {
        results.push({ id: log.id, rideId: log.rideId, status: result.status, detail: result.detail })
      }
    } catch (err: any) {
      console.error(`[Replay Webhooks] Falha ao reprocessar ${log.id}:`, err?.message)
      results.push({ id: log.id, rideId: log.rideId, status: "error", detail: err?.message })
    }
  }

  const replayed = pending.length - results.filter((r) => r.status === "error").length

  console.log(`[Replay Webhooks] ${pending.length} eventos verificados, ${replayed} reprocessados`)

  return NextResponse.json({
    checked: pending.length,
    replayed,
    results,
  })
}
