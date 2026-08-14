import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const establishmentId = url.searchParams.get("establishmentId")
    if (!establishmentId) {
      return NextResponse.json({ error: "establishmentId obrigatório" }, { status: 400 })
    }

    const subs = await prisma.pushSubscription.findMany({
      where: { establishmentId },
      select: { id: true, customerKey: true, endpoint: true, userAgent: true, lastUsedAt: true },
      orderBy: { lastUsedAt: "desc" },
    })

    const seen = new Map<string, string>()
    const toDelete: string[] = []
    for (const s of subs) {
      const agent = (s.userAgent || "unknown").slice(0, 40)
      const key = `${s.customerKey || "anonymous"}::${agent}`
      if (seen.has(key)) {
        toDelete.push(s.id)
      } else {
        seen.set(key, s.id)
      }
    }

    let deleted = 0
    if (toDelete.length > 0) {
      const result = await prisma.pushSubscription.deleteMany({
        where: { id: { in: toDelete } },
      })
      deleted = result.count
    }

    const remaining = await prisma.pushSubscription.count({ where: { establishmentId } })

    return NextResponse.json({
      establishmentId,
      totalBefore: subs.length,
      deleted,
      totalAfter: remaining,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
