import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getIfoodAuth } from "@/lib/integrations/ifood"
import { updateIfoodStatus } from "@/lib/integrations/ifood-status"
import { verifyAuth } from "@/lib/auth"

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = verifyAuth(req)
    const body = await req.json().catch(() => ({} as any))
    const { status, paymentStatus, cancellationReason, cancelledBy } = body
    const tokenFromBody = (body && (body.trackingToken || body.token)) || null

    const order = await prisma.order.findUnique({
      where: { id: params.id },
    })

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    // Authorization:
    // - Authenticated establishment users (admin/caixa/entregador): can do any
    //   update, but only on orders of their own establishment.
    // - Anonymous customers: can ONLY cancel their own order, and only via
    //   tracking token + only when payment is still pending. This matches the
    //   same pattern used by /api/orders/[id]/messages and /payment-status.
    if (auth) {
      if (order.establishmentId !== auth.establishmentId) {
        return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
      }
    } else if (status === "cancelled" && tokenFromBody && order.trackingToken === tokenFromBody) {
      // Customer-initiated cancel with valid tracking token
      // Falls through to the cancel branch below (which has its own
      // paymentStatus === "pending" check).
    } else {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    if (order.paymentStatus !== "pending" && status === "cancelled") {
      return NextResponse.json({ error: "Apenas pedidos com pagamento pendente podem ser cancelados" }, { status: 400 })
    }

    if (status === "cancelled") {
      // Soft-delete: keep the order with status="cancelled" so admins can
      // view it, see the reason, and act on repeat-cancelling customers.
      // Also bump the customer's cancellationCount for future blocking rules.
      const cancelledByFinal = cancelledBy || (auth ? "merchant" : "customer")

      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: params.id },
          data: {
            status: "cancelled",
            paymentStatus: "cancelled",
            cancellationReason: cancellationReason || null,
            cancellationDate: new Date(),
            cancelledBy: cancelledByFinal,
          },
        })

        if (order.customerId) {
          await tx.customer.update({
            where: { id: order.customerId },
            data: {
              cancellationCount: { increment: 1 },
            },
          })
        }

        // Mantém o CancellationLog como snapshot adicional de auditoria
        await tx.cancellationLog.create({
          data: {
            establishmentId: order.establishmentId,
            orderId: order.id,
            source: order.method || "site",
            cancelledBy: cancelledByFinal,
            reason: cancellationReason || null,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            total: order.total,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            externalId: order.externalId,
          },
        })
      })
      return NextResponse.json({ success: true, cancelled: true })
    }

    // Pagamentos na entrega são confirmados no momento da finalização do
    // pedido (entrega/retirada concluída). Evita precisar clicar em botão
    // separado para marcar como pago.
    const isPayOnDelivery =
      order.paymentMethod &&
      ["cash", "delivery", "pickup", "card_delivery", "card_pickup"].includes(
        order.paymentMethod
      )
    const autoConfirmPayment =
      status === "delivered" && isPayOnDelivery && order.paymentStatus !== "paid"

    const updated = await prisma.order.update({
      where: { id: params.id },
      data: {
        ...(status && { status }),
        ...(paymentStatus && { paymentStatus }),
        ...(status === "out_for_delivery" && { assignedAt: new Date() }),
        ...(autoConfirmPayment && { paymentStatus: "paid" }),
      },
    })

    if (order.method === "ifood" && status) {
      try {
        const auth = await getIfoodAuth(
          process.env.IFOOD_CLIENT_ID!,
          process.env.IFOOD_CLIENT_SECRET!
        )
        if (!auth?.accessToken) {
          console.warn("[ifood sync] auth failed, skipping iFood status push")
        } else {
        const accessToken = auth.accessToken
        const establishment = await prisma.establishment.findUnique({
          where: { id: order.establishmentId },
        })
        if (establishment?.ifoodMerchantId) {
          // iFood state machine: confirm -> readyForPickup -> dispatch -> conclude.
          // Whether the merchant can drive delivery themselves depends on
          // order.delivery.deliveredBy captured at order creation.
          //   IFOOD  = iFood delivery (we cannot /conclude, we just update local)
          //   MERCHANT = own delivery (we can call /conclude)
          const isMerchantDelivery = order.ifoodDeliveryBy === "MERCHANT"

          const statusActionMap: Record<string, string> = {
            confirmed: "confirm",
            preparing: "confirm",
            // ready: tell iFood the kitchen finished so the courier can be
            // dispatched. /readyForPickup is the canonical endpoint for both
            // STORE and MERCHANT merchants. The iFood sandbox may return 404 —
            // we fall back to /confirm (idempotent) in that case.
            ready: "readyForPickup",
            dispatched: "dispatch",
            out_to_delivery: "dispatch",
            out_for_delivery: "dispatch",
            outfordelivery: "dispatch",
            delivered: isMerchantDelivery ? "deliver" : "",
            cancelled: "cancel",
          }
          const action = statusActionMap[status]
          if (action && order.externalId) {
            const result = await updateIfoodStatus(accessToken, establishment.ifoodMerchantId, order.externalId, action)
            console.log("[ifood status update]", { orderId: order.externalId, action, status: result.status, body: result.body, success: result.success, isMerchantDelivery })
          } else if (status === "delivered" && !isMerchantDelivery) {
            console.log("[ifood sync] STORE order: skipping /conclude (iFood finishes via webhook CON)", { orderId: order.externalId })
          } else {
            console.log("[ifood sync] skipped:", { hasExternalId: !!order.externalId, status, action, isMerchantDelivery })
          }
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
