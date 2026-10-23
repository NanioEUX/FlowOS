import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyCustomerSession, customerSessionRequired } from "@/lib/customer-auth"

// GET /api/orders/customer — histórico do próprio cliente.
// Exige o cookie de sessão emitido no PUT /api/verification (F7A-004/F7B-003);
// telefone e estabelecimento vêm do token, nunca do request.
export async function GET(req: NextRequest) {
  const session = await verifyCustomerSession(req)
  if (!session) return customerSessionRequired()

  const phone = session.phone
  const establishmentId = session.establishmentId

  // F3A-003: a expiração de abandoned SAIU daqui — era escrita-por-leitura em
  // todo poll do cliente e marcava abandoned SEM restoreOrderStock/reversão de
  // fidelidade, "furtando" o pedido do cron expire-orders (que faz o estorno).
  // O cron */5 min cobre a mesma janela com a regra completa.

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
      deliveredAt: true,
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
      cashbackEarned: true,
      loyaltyPointsUsed: true,
      cancellationReason: true,
    },
  })

  const orderIds = orders.map((o) => o.id)
  const reviews = await prisma.review.findMany({
    where: { orderId: { in: orderIds } },
    select: { orderId: true, rating: true },
  })
  const reviewedSet = new Set(reviews.map((r) => r.orderId))
  const ratingMap = new Map(reviews.map((r) => [r.orderId, r.rating]))

  const ordersWithReview = orders.map((o) => ({
    ...o,
    reviewed: reviewedSet.has(o.id),
    reviewRating: ratingMap.get(o.id) || null,
  }))

  return NextResponse.json(ordersWithReview)
}
