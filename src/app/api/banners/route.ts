import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const establishmentId = req.nextUrl.searchParams.get("establishmentId")
  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId required" }, { status: 400 })
  }

  const banners = await prisma.banner.findMany({
    where: { establishmentId, active: true },
    orderBy: { order: "asc" },
    take: 5,
  })

  return NextResponse.json(banners)
}
