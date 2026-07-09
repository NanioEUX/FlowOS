import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const phone = searchParams.get("phone")
  const establishmentId = searchParams.get("establishmentId")

  if (!phone || !establishmentId) {
    return NextResponse.json({ error: "phone e establishmentId são obrigatórios" }, { status: 400 })
  }

  const orders = await prisma.order.findMany({
    where: { customerPhone: phone, establishmentId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      customerName: true,
      items: true,
      total: true,
      status: true,
      createdAt: true,
      orderType: true,
      paymentMethod: true,
      paymentStatus: true,
      paymentLink: true,
      trackingToken: true,
      deliveryFee: true,
    },
  })

  return NextResponse.json(orders)
}
