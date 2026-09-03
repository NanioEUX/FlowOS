import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { buscarStatusCorrida99 } from "@/lib/integrations/nine-nine"

/**
 * Polling de status das corridas 99
 *
 * GET /api/delivery/poll-99
 * Chama periodicamente para verificar status das corridas ativas
 */
export async function GET() {
  try {
    const activeRides = await prisma.order.findMany({
      where: {
        entrega99RideId: { not: null },
        status: { in: ["out_for_delivery", "ready"] },
      },
      include: {
        establishment: {
          select: {
            api99Key: true,
            api99EmployeeId: true,
          },
        },
      },
    })

    const results = []

    for (const order of activeRides) {
      if (!order.establishment.api99Key || !order.establishment.api99EmployeeId) {
        continue
      }

      const statusResult = await buscarStatusCorrida99(
        order.establishment.api99Key,
        order.establishment.api99EmployeeId,
        order.entrega99RideId!
      )

      if (statusResult.success && statusResult.status) {
        const statusMap: Record<string, string> = {
          "pending": "pending",
          "accepted": "confirmed",
          "driver_arriving": "ready",
          "in_transit": "out_for_delivery",
          "delivered": "delivered",
          "cancelled": "cancelled",
          "canceled": "cancelled",
        }

        const mappedStatus = statusMap[statusResult.status] || statusResult.status

        await prisma.order.update({
          where: { id: order.id },
          data: {
            entregaStatusProvedor: statusResult.status,
            ...(mappedStatus && { status: mappedStatus }),
            ...(statusResult.status === "delivered" && { deliveredAt: new Date() }),
            ...(statusResult.status === "cancelled" && { cancellationReason: "Cancelado pela 99" }),
          },
        })

        results.push({
          orderId: order.id,
          rideId: order.entrega99RideId,
          status: statusResult.status,
          mappedStatus,
        })
      }
    }

    return NextResponse.json({
      success: true,
      polled: results.length,
      results,
    })
  } catch (error) {
    console.error("[poll-99] error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
