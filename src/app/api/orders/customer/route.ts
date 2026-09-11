import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const phone = searchParams.get("phone")
  const establishmentId = searchParams.get("establishmentId")

  if (!phone || !establishmentId) {
    return NextResponse.json({ error: "phone e establishmentId são obrigatórios" }, { status: 400 })
  }

  // Fetch establishment config for abandoned order timeout
  const establishment = await prisma.establishment.findUnique({
    where: { id: establishmentId },
    select: { abandonedOrderMinutes: true },
  })
  const abandonedMinutes = establishment?.abandonedOrderMinutes ?? 15

  const now = new Date()
  const expiryThreshold = new Date(now.getTime() - abandonedMinutes * 60 * 1000)

  // Mark old pending orders as abandoned if not accepted within the configured time
  await prisma.order.updateMany({
    where: {
      customerPhone: phone,
      establishmentId,
      status: { in: ["pending", "new"] },
      createdAt: { lt: expiryThreshold },
    },
    data: {
      status: "abandoned",
    },
  })

  // Then fetch orders for the customer's "Meus Pedidos" tab:
  // - Online payments (Pix/Card): visible while paid, pending or expired, so a
  //   customer can recover an unpaid Pix/Card payment and see expired ones.
  // - Pay-on-delivery: visible from creation through delivery, including
  //   "pending" (awaiting establishment acceptance). Excludes "cancelled"
  //   (the customer can re-order anytime anyway).
  const orders = await prisma.order.findMany({
    where: {
      customerPhone: phone,
      establishmentId,
      status: { not: "cancelled" },
      OR: [
        {
          paymentMethod: { in: ["cash", "delivery", "pickup", "card_delivery", "card_pickup"] },
        },
        { paymentStatus: { in: ["paid", "pending", "expired"] } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      items: true,
      total: true,
      status: true,
      createdAt: true,
      orderType: true,
      paymentMethod: true,
      paymentStatus: true,
      paymentLink: true,
      pixPayload: true,
      paymentId: true,
      trackingToken: true,
      deliveryFee: true,
      deliveryCode: true,
      updatedAt: true,
    },
  })

  return NextResponse.json(orders)
}
