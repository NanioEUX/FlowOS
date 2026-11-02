import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getStockRestoreFailures } from "@/lib/stock"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/health — health check da aplicação (F4A-020/F4C-034).
 *
 * Antes não existia nenhum endpoint de health: nenhum monitor sintético
 * (UptimeRobot, Vercel, Datadog) podia ser configurado e não havia baseline
 * de "boot ok + banco responde".
 *
 * - `GET`  → 200 com o estado de cada dependência
 * - `?deep=1` → também executa uma query real no banco
 */
export async function GET(req: NextRequest) {
  const deep = req.nextUrl.searchParams.get("deep") === "1"
  const startedAt = Date.now()

  const checks: Record<string, { ok: boolean; ms?: number; detail?: string }> = {}

  // Banco: uma query leve (SELECT 1) — só no deep, para não pesar no monitor
  if (deep) {
    const dbStart = Date.now()
    try {
      await prisma.$queryRaw`SELECT 1`
      checks.database = { ok: true, ms: Date.now() - dbStart }
    } catch (err: any) {
      checks.database = { ok: false, ms: Date.now() - dbStart, detail: err?.message?.slice(0, 200) }
    }
  } else {
    checks.database = { ok: true, detail: "não verificado (use ?deep=1)" }
  }

  // Variáveis de ambiente críticas (sem expor valores)
  const requiredEnv = ["DATABASE_URL", "JWT_SECRET"]
  const missingEnv = requiredEnv.filter((key) => !process.env[key])
  checks.env = missingEnv.length === 0
    ? { ok: true }
    : { ok: false, detail: `faltando: ${missingEnv.join(", ")}` }

  // F4A-026: falhas de estorno de estoque (estoque inconsistente) — alerta
  // visível sem derrubar o status do serviço.
  const stockRestoreFailures = getStockRestoreFailures()

  const ok = Object.values(checks).every((c) => c.ok)

  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      checks,
      alerts: stockRestoreFailures > 0 ? { stockRestoreFailures } : undefined,
      uptimeSeconds: Math.round(process.uptime()),
      durationMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  )
}
