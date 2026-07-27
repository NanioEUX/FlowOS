import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getIfoodAuth } from "@/lib/integrations/ifood"
import { updateIfoodStatus } from "@/lib/integrations/ifood-status"
import { getMerchantType } from "@/lib/integrations/ifood-merchant"

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { status, paymentStatus } = await req.json()

    const order = await prisma.order.findUnique({
      where: { id: params.id },
    })

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    if (order.paymentStatus !== "pending" && status === "cancelled") {
      return NextResponse.json({ error: "Apenas pedidos com pagamento pendente podem ser cancelados" }, { status: 400 })
    }

    if (status === "cancelled") {
      await prisma.order.delete({
        where: { id: params.id },
      })
      return NextResponse.json({ success: true, deleted: true })
    }

    const updated = await prisma.order.update({
      where: { id: params.id },
      data: {
        ...(status && { status }),
        ...(paymentStatus && { paymentStatus }),
        ...(status === "out_for_delivery" && { assignedAt: new Date() }),
      },
    })

    if (order.method === "ifood" && status) {
      try {
        const { accessToken } = await getIfoodAuth(
          process.env.IFOOD_CLIENT_ID!,
          process.env.IFOOD_CLIENT_SECRET!
        )
        const establishment = await prisma.establishment.findUnique({
          where: { id: order.establishmentId },
        })
        if (establishment?.ifoodMerchantId) {
          // Determine merchant logistics to decide which iFood endpoints apply.
          // STORE = iFood delivery (we can't finalize on their behalf).
          // MERCHANT = our own delivery (we call /conclude to mark as delivered).
          const merchantType = await getMerchantType(establishment.ifoodMerchantId, accessToken)

          const statusActionMap: Record<string, string> = {
            confirmed: "confirm",
            preparing: "confirm",
            // ready: signal that the kitchen finished; production should call /ready
            // (which moves the order to "Pronto" in the iFood merchant panel). The
            // iFood sandbox does not expose /ready and returns 404, so for now we
            // call /confirm (idempotent) — replace with "ready" once /ready is
            // enabled in your merchant account.
            dispatched: "dispatch",
            out_to_delivery: "dispatch",
            out_for_delivery: "dispatch",
            outfordelivery: "dispatch",
            delivered: merchantType === "MERCHANT" ? "deliver" : "",
            cancelled: "cancel",
          }
          const action = statusActionMap[status]
          if (action && order.externalId) {
            const result = await updateIfoodStatus(accessToken, establishment.ifoodMerchantId, order.externalId, action)
            console.log("[ifood status update]", { orderId: order.externalId, action, status: result.status, body: result.body, success: result.success, merchantType })
          } else {
            console.log("[ifood sync] skipped:", { hasExternalId: !!order.externalId, status, action, merchantType })
          }
        }
      } catch (err) {
        console.error("iFood status sync error:", err)
      }
    }

    // When the order becomes ready, auto-assign an available delivery person.
    if (status === "ready" && order.orderType === "delivery") {
      try {
        const freeDriver = await prisma.deliveryPerson.findFirst({
          where: { establishmentId: order.establishmentId, isActive: true },
          orderBy: { createdAt: "asc" },
        })
        if (freeDriver) {
          const count = await prisma.order.count({
            where: { deliveryPersonId: freeDriver.id, status: { in: ["out_for_delivery", "dispatched"] } },
          })
          if (count === 0) {
            await prisma.order.update({
              where: { id: order.id },
              data: {
                deliveryPersonId: freeDriver.id,
                deliveryPerson: freeDriver.name,
                assignedAt: new Date(),
              },
            })
            updated.deliveryPersonId = freeDriver.id
            updated.deliveryPerson = freeDriver.name
          }
        }
      } catch (autoErr: any) {
        console.error("auto-assign delivery person error:", autoErr.message)
      }
    }

    return NextResponse.json({ success: true, order: updated })
  } catch (error: any) {
    console.error("[Order PATCH] Error:", error.message)
    return NextResponse.json({ error: "Erro ao atualizar pedido" }, { status: 500 })
  }
}
