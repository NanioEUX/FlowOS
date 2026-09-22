import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getIfoodAuth } from "@/lib/integrations/ifood"
import { getMerchantStatus, getInterruptions } from "@/lib/integrations/ifood-catalog-write"

/**
 * GET /api/cron/sync-ifood-status (Bearer CRON_SECRET)
 * Verifica status real no iFood e sincroniza ifoodPaused no banco.
 * Roda a cada 5 minutos.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const establishments = await prisma.establishment.findMany({
    where: {
      ifoodEnabled: true,
      ifoodMerchantId: { not: null },
    },
    select: {
      id: true,
      name: true,
      ifoodMerchantId: true,
      ifoodPaused: true,
      ifoodInterruptionId: true,
    },
  })

  if (establishments.length === 0) {
    return NextResponse.json({ success: true, synced: 0 })
  }

  const ifoodAuth = await getIfoodAuth(
    process.env.IFOOD_CLIENT_ID!,
    process.env.IFOOD_CLIENT_SECRET!
  )

  if (!ifoodAuth?.accessToken) {
    return NextResponse.json({ error: "Falha na autenticação com iFood" }, { status: 502 })
  }

  let synced = 0
  let errors = 0

  for (const est of establishments) {
    try {
      const statusResult = await getMerchantStatus(ifoodAuth.accessToken, est.ifoodMerchantId!)
      if (!statusResult.success) {
        errors++
        continue
      }

      const status = statusResult.data?.status
      // iFood status: "OPEN" | "CLOSED" | "PENDING_APPROVAL"
      // Also check active interruptions
      const interruptsResult = await getInterruptions(ifoodAuth.accessToken, est.ifoodMerchantId!)
      const activeInterruptions = Array.isArray(interruptsResult.data)
        ? interruptsResult.data.filter((i: any) => {
            if (!i.enabled) return false
            const now = new Date()
            const end = new Date(i.endDateTime)
            return end > now
          })
        : []

      const shouldBePaused = status === "CLOSED" || activeInterruptions.length > 0
      const activeInterruptionId = activeInterruptions[0]?.id || null

      // Only update if changed
      if (est.ifoodPaused !== shouldBePaused || est.ifoodInterruptionId !== activeInterruptionId) {
        await prisma.establishment.update({
          where: { id: est.id },
          data: {
            ifoodPaused: shouldBePaused,
            ifoodInterruptionId: activeInterruptionId,
          },
        })
        synced++
      }
    } catch {
      errors++
    }
  }

  console.log(`[Sync iFood Status] synced=${synced} errors=${errors} total=${establishments.length}`)
  return NextResponse.json({ success: true, synced, errors, total: establishments.length })
}
