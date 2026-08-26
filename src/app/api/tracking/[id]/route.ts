import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const order = await prisma.order.findFirst({
    where: {
      trackingToken: params.id,
    },
    include: {
      establishment: {
        select: { name: true, phone: true, logo: true },
      },
    },
  })

  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
  }

  return NextResponse.json({
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    orderType: order.orderType,
    paymentLink: order.paymentLink,
    items: JSON.parse(order.items),
    total: order.total,
    deliveryFee: order.deliveryFee,
    customerName: order.customerName,
    customerAddress: order.customerAddress,
    notes: order.notes,
    deliveryPerson: order.deliveryPerson,
    deliveryCode: order.deliveryCode,
    method: order.method,
    createdAt: order.createdAt,
    deliveredAt: order.deliveredAt,
    establishment: order.establishment,
  })
}
