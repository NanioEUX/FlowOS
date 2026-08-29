import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const url = new URL(req.url)
    const ext = url.searchParams.get('externalId')
    const method = url.searchParams.get('method') || 'ifood'

    const where: any = { method, establishmentId: authUser.establishmentId }
    if (ext) where.externalId = ext

    const orders = await prisma.order.findMany({
      where,
      select: { id: true, externalId: true, status: true, createdAt: true, customerName: true },
      take: 10,
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json({ orders })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}
