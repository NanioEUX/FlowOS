import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getIfoodAuth } from "@/lib/integrations/ifood"
import { createInterruption, deleteInterruption, getInterruptions } from "@/lib/integrations/ifood-catalog-write"

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]

function isOpenNow(businessHours: string | null): boolean {
  if (!businessHours) return false
  try {
    const hours = JSON.parse(businessHours)
    const now = new Date()
    const today = DAY_NAMES[now.getDay()]
    const todayEntry = hours.find((h: any) => h.day.trim() === today)
    if (!todayEntry || !todayEntry.active) return false
    const [oh, om] = todayEntry.open.trim().split(":").map(Number)
    const [ch, cm] = todayEntry.close.trim().split(":").map(Number)
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const openMinutes = oh * 60 + om
    const closeMinutes = ch * 60 + cm
    if (closeMinutes < openMinutes) {
      return currentMinutes >= openMinutes || currentMinutes < closeMinutes
    }
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes
  } catch {
    return false
  }
}

function getNextOpeningTime(businessHours: string | null): Date {
  if (!businessHours) {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d
  }
  try {
    const hours = JSON.parse(businessHours)
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const checkDate = new Date(now); checkDate.setDate(checkDate.getDate() + dayOffset)
      const dayName = DAY_NAMES[checkDate.getDay()]
      const entry = hours.find((h: any) => h.day.trim() === dayName)
      if (!entry || !entry.active) continue
      const [oh, om] = entry.open.trim().split(":").map(Number)
      const openMinutes = oh * 60 + om
      if (dayOffset === 0 && currentMinutes >= openMinutes) continue
      checkDate.setHours(oh, om, 0, 0); return checkDate
    }
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d
  } catch {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d
  }
}

/**
 * GET /api/cron/sync-ifood-status (Bearer CRON_SECRET)
 * Auto open/close iFood based on businessHours.
 * Only affects establishments where ifoodAutoPaused=true (auto-paused by this cron).
 * Manual pauses (ifoodAutoPaused=false) are respected and not overridden.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const establishments = await prisma.establishment.findMany({
    where: { ifoodEnabled: true, ifoodMerchantId: { not: null } },
    select: {
      id: true, name: true, businessHours: true,
      ifoodMerchantId: true, ifoodPaused: true, ifoodAutoPaused: true, ifoodInterruptionId: true,
    },
  })

  if (establishments.length === 0) {
    return NextResponse.json({ success: true, synced: 0 })
  }

  const ifoodAuth = await getIfoodAuth(process.env.IFOOD_CLIENT_ID!, process.env.IFOOD_CLIENT_SECRET!)
  if (!ifoodAuth?.accessToken) {
    return NextResponse.json({ error: "Falha na autenticação com iFood" }, { status: 502 })
  }

  let opened = 0, closed = 0, skipped = 0, errors = 0

  for (const est of establishments) {
    try {
      const shouldBeOpen = isOpenNow(est.businessHours)
      const isPaused = est.ifoodPaused === true
      const isAutoPaused = est.ifoodAutoPaused === true

      if (shouldBeOpen && isPaused && isAutoPaused) {
        // Auto-paused by cron + now should be open → REOPEN
        if (est.ifoodInterruptionId) {
          await deleteInterruption(ifoodAuth.accessToken, est.ifoodMerchantId!, est.ifoodInterruptionId)
        }
        await prisma.establishment.update({
          where: { id: est.id },
          data: { ifoodPaused: false, ifoodAutoPaused: false, ifoodInterruptionId: null },
        })
        opened++
      } else if (!shouldBeOpen && !isPaused) {
        // Should be closed + not paused → AUTO-PAUSE
        const nextOpening = getNextOpeningTime(est.businessHours)
        const now = new Date()
        const startIso = now.toISOString().replace("Z", "+00:00")
        const endIso = nextOpening.toISOString().replace("Z", "+00:00")

        const result = await createInterruption(
          ifoodAuth.accessToken, est.ifoodMerchantId!, startIso, endIso, "Horário de funcionamento encerrado"
        )
        const interruptionId = result?.data?.id || null

        await prisma.establishment.update({
          where: { id: est.id },
          data: { ifoodPaused: true, ifoodAutoPaused: true, ifoodInterruptionId: interruptionId },
        })
        closed++
      } else {
        skipped++
      }
    } catch {
      errors++
    }
  }

  console.log(`[Sync iFood] opened=${opened} closed=${closed} skipped=${skipped} errors=${errors} total=${establishments.length}`)
  return NextResponse.json({ success: true, opened, closed, skipped, errors, total: establishments.length })
}
