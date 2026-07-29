import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const ASAAS_API_URL =
  process.env.ASAAS_ENVIRONMENT === "sandbox"
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3"

const PENDING_EXPIRY_MINUTES = Number(process.env.PENDING_ORDER_EXPIRY_MINUTES) || 5

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const phone = searchParams.get("phone")
  const establishmentId = searchParams.get("establishmentId")

  if (!phone || !establishmentId) {
    return NextResponse.json({ error: "phone e establishmentId são obrigatórios" }, { status: 400 })
  }

  const now = new Date()
  const expiryThreshold = new Date(now.getTime() - PENDING_EXPIRY_MINUTES * 60 * 1000)

  // First, expire old pending orders
  await prisma.order.updateMany({
    where: {
      customerPhone: phone,
      establishmentId,
      paymentStatus: "pending",
      createdAt: { lt: expiryThreshold },
    },
    data: {
      status: "abandoned",
      paymentStatus: "expired",
    },
  })

  // Then fetch orders for the customer's "Meus Pedidos" tab:
  // - Online payments (Pix/Card): only paymentStatus = "paid" (webhook confirmed)
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
        { paymentStatus: "paid" },
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
      paymentId: true,
      trackingToken: true,
      deliveryFee: true,
    },
  })

  return NextResponse.json(orders)
}