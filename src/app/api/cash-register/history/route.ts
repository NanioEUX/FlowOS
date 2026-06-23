import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const authUser = await verifyAuth(req)
  if (!authUser) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const establishmentId = authUser.establishmentId
  const page = parseInt(req.nextUrl.searchParams.get("page") || "1")
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20")
  const start = req.nextUrl.searchParams.get("start")
  const end = req.nextUrl.searchParams.get("end")

  const where: any = { establishmentId }
  if (start || end) {
    where.createdAt = {}
    if (start) where.createdAt.gte = new Date(start)
    if (end) where.createdAt.lte = new Date(end + "T23:59:59.999Z")
  }

  const [registers, total] = await Promise.all([
    prisma.cashRegister.findMany({
      where,
      include: {
        movements: { orderBy: { createdAt: "desc" } },
        transfers: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.cashRegister.count({ where }),
  ])

  return NextResponse.json({ registers, total, page, limit })
}
