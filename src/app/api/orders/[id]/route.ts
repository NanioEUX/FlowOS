import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendPushToDeliveryPerson } from "@/lib/push"
import { verifyAuth } from "@/lib/auth"

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    const establishmentId = authUser.establishmentId
    const { status, deliveryPersonId, deliveryPersonName } = await req.json()

    const currentOrder = await prisma.order.findUnique({ where: { id: params.id } })
    if (!currentOrder || currentOrder.establishmentId !== establishmentId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
    }

    const data: any = {
      ...(status && { status }),
      ...(deliveryPersonId !== undefined && { deliveryPersonId: deliveryPersonId || null }),
      ...(deliveryPersonName !== undefined && { deliveryPerson: deliveryPersonName }),
    }

    // Set assignedAt when motoboy is assigned
    if (deliveryPersonId && deliveryPersonId !== currentOrder?.deliveryPersonId) {
      data.assignedAt = new Date()
    }

    // Set deliveredAt when status changes to delivered
    if (status === "delivered") {
      data.deliveredAt = new Date()
    }

    const order = await prisma.order.update({
      where: { id: params.id },
      data,
    })

    // Send push notification when motoboy is assigned
    if (deliveryPersonId && deliveryPersonId !== currentOrder?.deliveryPersonId) {
      sendPushToDeliveryPerson(
        deliveryPersonId,
        "Nova entrega!",
        `Pedido #${params.id.slice(-6)} atribuído a você`,
        `/pedido/${params.id}`
      )
    }

    // Auto-assign motoboy with fewest pending orders when status is "ready"
    // Skip for presencial and pickup orders - no motoboy needed
    if (status === "ready" && !deliveryPersonId && !currentOrder?.deliveryPersonId && currentOrder?.orderType !== "presencial" && currentOrder?.orderType !== "pickup") {
      const people = await prisma.deliveryPerson.findMany({
        where: { establishmentId: order.establishmentId, isActive: true },
        include: {
          _count: {
            select: { orders: true },
          },
        },
      })

      if (people.length > 0) {
        const pendingCounts = await Promise.all(
          people.map(async (p) => {
            const count = await prisma.order.count({
              where: {
                deliveryPersonId: p.id,
                status: { in: ["ready", "out_for_delivery"] },
              },
            })
            return { id: p.id, name: p.name, count }
          })
        )

        pendingCounts.sort((a, b) => a.count - b.count)
        const best = pendingCounts[0]

        await prisma.order.update({
          where: { id: params.id },
          data: {
            deliveryPersonId: best.id,
            deliveryPerson: best.name,
            assignedAt: new Date(),
          },
        })

        // Send push notification to motoboy
        sendPushToDeliveryPerson(
          best.id,
          "Nova entrega!",
          `Pedido #${params.id.slice(-6)} pronto para retirada`,
          `/pedido/${params.id}`
        )
      }
    }

    const updated = await prisma.order.findUnique({ where: { id: params.id } })

    return NextResponse.json(updated)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 })
  }
}
