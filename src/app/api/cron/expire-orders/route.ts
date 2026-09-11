import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const establishments = await prisma.establishment.findMany({
    where: { status: "active" },
    select: { id: true, abandonedOrderMinutes: true },
  })

  let totalExpired = 0

  for (const est of establishments) {
    const minutes = est.abandonedOrderMinutes ?? 15
    const threshold = new Date(Date.now() - minutes * 60 * 1000)

    const result = await prisma.order.updateMany({
      where: {
        establishmentId: est.id,
        status: { in: ["pending", "new", "payment_pending"] },
        createdAt: { lt: threshold },
      },
      data: { status: "abandoned" },
    })

    totalExpired += result.count
  }

  return NextResponse.json({ expired: totalExpired })
}
