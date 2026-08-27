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

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { phone, establishmentId, markAllRead, deleteByType, deleteId } = body
    if (!phone || !establishmentId) {
      return NextResponse.json({ ok: false })
    }

    const customer = await prisma.customer.findFirst({
      where: { phone: phone.replace(/\D/g, ""), establishmentId },
      select: { id: true },
    })
    if (!customer) return NextResponse.json({ ok: false })

    if (markAllRead) {
      await prisma.customerNotification.updateMany({
        where: { customerId: customer.id, read: false },
        data: { read: true },
      })
    }

    if (deleteByType) {
      await prisma.customerNotification.deleteMany({
        where: { customerId: customer.id, type: deleteByType },
      })
    }

    if (deleteId) {
      await prisma.customerNotification.deleteMany({
        where: { customerId: customer.id, id: deleteId },
      })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
