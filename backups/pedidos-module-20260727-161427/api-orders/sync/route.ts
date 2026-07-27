import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { establishmentId, customerName, customerPhone, customerAddress, items, total, notes } = body

    // Find or create customer
    let customerId: string | undefined
    if (customerPhone) {
      let customer = await prisma.customer.findFirst({
        where: { phone: customerPhone, establishmentId },
      })
      if (customer) {
        customerId = customer.id
        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            name: customerName || customer.name,
            totalOrders: { increment: 1 },
            totalSpent: { increment: total || 0 },
          },
        })
      } else {
        customer = await prisma.customer.create({
          data: {
            phone: customerPhone,
            name: customerName || "Cliente WhatsApp",
            establishmentId,
            totalOrders: 1,
            totalSpent: total || 0,
          },
        })
        customerId = customer.id
      }
    }

    const trackingToken = crypto.randomBytes(12).toString("hex")

    const order = await prisma.order.create({
      data: {
        establishmentId,
        customerId,
        customerName: customerName || "Cliente WhatsApp",
        customerPhone,
        customerAddress,
        orderType: "delivery",
        paymentMethod: "delivery",
        items: JSON.stringify(items || []),
        total: total || 0,
        notes,
        method: "whatsapp",
        trackingToken,
        status: "pending",
      },
    })

    return NextResponse.json({ order, trackingUrl: `/pedido/${trackingToken}` })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao criar" }, { status: 500 })
  }
}
