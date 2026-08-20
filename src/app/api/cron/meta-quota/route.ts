import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { refreshQuotaFromMeta } from "@/lib/meta-quota"

// GET /api/cron/meta-quota — called by Vercel Cron every hour
// Also callable manually for testing
export async function GET(req: NextRequest) {
  // Verify cron secret or allow manual trigger
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Find all Meta-connected establishments
  const establishments = await prisma.establishment.findMany({
    where: {
      whatsappProvider: "meta",
      metaBusinessAccountId: { not: null },
      metaAccessToken: { not: null },
    },
    select: {
      id: true,
      name: true,
      metaBusinessAccountId: true,
      lastQuotaCheck: true,
    },
  })

  console.log(`[Meta Quota Cron] Checking ${establishments.length} establishments`)

  const results: { id: string; name: string; status: string; usage?: number; limit?: number }[] = []

  for (const est of establishments) {
    // Skip if checked in the last 50 minutes (avoid double-checking)
    if (est.lastQuotaCheck) {
      const minutesSinceCheck = (Date.now() - est.lastQuotaCheck.getTime()) / 60000
      if (minutesSinceCheck < 50) {
        results.push({ id: est.id, name: est.name || "unknown", status: "skipped" })
        continue
      }
    }

    try {
      const quota = await refreshQuotaFromMeta(est.id)
      if (quota) {
        results.push({
          id: est.id,
          name: est.name || "unknown",
          status: quota.isBlocked ? "blocked" : quota.needsVerification ? "warning" : "ok",
          usage: quota.currentUsage,
          limit: quota.messagingLimit,
        })
      } else {
        results.push({ id: est.id, name: est.name || "unknown", status: "error" })
      }
    } catch (err: any) {
      console.error(`[Meta Quota Cron] Error for ${est.id}:`, err.message)
      results.push({ id: est.id, name: est.name || "unknown", status: "error" })
    }
  }

  return NextResponse.json({
    checked: establishments.length,
    results,
  })
}
