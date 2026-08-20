import { NextRequest, NextResponse } from "next/server"
import { getQuotaInfo, refreshQuotaFromMeta, getMetaManagerUrl } from "@/lib/meta-quota"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // If data is fresh (< 50 min), return cached
    const est = await prisma.establishment.findUnique({
      where: { id },
      select: { lastQuotaCheck: true, metaBusinessAccountId: true },
    })

    if (est?.lastQuotaCheck && est.metaBusinessAccountId) {
      const minutesSince = (Date.now() - est.lastQuotaCheck.getTime()) / 60000
      if (minutesSince < 50) {
        const quota = await getQuotaInfo(id)
        if (quota) {
          return NextResponse.json({
            quota: { ...quota, metaManagerUrl: getMetaManagerUrl(est.metaBusinessAccountId) },
          })
        }
      }
    }

    // Refresh from Meta
    const quota = await refreshQuotaFromMeta(id)
    if (!quota) {
      return NextResponse.json({ quota: null })
    }

    return NextResponse.json({
      quota: { ...quota, metaManagerUrl: getMetaManagerUrl(est?.metaBusinessAccountId || "") },
    })
  } catch (error: any) {
    console.error("[Meta Quota GET]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const quota = await refreshQuotaFromMeta(id)

    const est = await prisma.establishment.findUnique({
      where: { id },
      select: { metaBusinessAccountId: true },
    })

    return NextResponse.json({
      quota: quota ? { ...quota, metaManagerUrl: getMetaManagerUrl(est?.metaBusinessAccountId || "") } : null,
    })
  } catch (error: any) {
    console.error("[Meta Quota POST]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
