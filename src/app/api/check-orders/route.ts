import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const ext = url.searchParams.get('externalId')
    const method = url.searchParams.get('method') || 'ifood'

    const where: any = { method }
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
