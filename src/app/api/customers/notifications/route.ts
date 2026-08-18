import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get("phone")?.replace(/\D/g, "")
  const establishmentId = req.nextUrl.searchParams.get("establishmentId")
  if (!phone || !establishmentId) {
    return NextResponse.json({ notifications: [] })
  }

  try {
    const customer = await prisma.customer.findFirst({
      where: { phone, establishmentId },
      select: { id: true },
    })
    if (!customer) return NextResponse.json({ notifications: [] })

    const notifications = await prisma.customerNotification.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        read: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ notifications })
  } catch {
    return NextResponse.json({ notifications: [] })
  }
}
