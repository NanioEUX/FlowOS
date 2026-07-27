import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getIfoodAuth } from "@/lib/integrations/ifood"
import { updateIfoodStatus } from "@/lib/integrations/ifood-status"

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
          const statusActionMap: Record<string, string> = {
            confirmed: "confirm",
            preparing: "confirm",
            ready: "confirm",
            dispatched: "dispatch",
            delivered: "deliver",
            cancelled: "cancel",
          }
          const action = statusActionMap[status]
          if (action && order.externalId) {
            const result = await updateIfoodStatus(accessToken, establishment.ifoodMerchantId, order.externalId, action)
            console.log("[ifood status update]", { orderId: order.externalId, action, status: result.status, body: result.body, success: result.success })
          } else {
            console.log("[ifood sync] skipped:", { hasExternalId: !!order.externalId, status, action })
          }
        }
      } catch (err) {
        console.error("iFood status sync error:", err)
      }
    }

    return NextResponse.json({ success: true, order: updated })
  } catch (error: any) {
    console.error("[Order PATCH] Error:", error.message)
    return NextResponse.json({ error: "Erro ao atualizar pedido" }, { status: 500 })
  }
}
