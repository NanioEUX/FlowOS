import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getIfoodAuth } from "@/lib/integrations/ifood"
import { updateIfoodStatus } from "@/lib/integrations/ifood-status"
import { verifyAuth } from "@/lib/auth"
import { getWhatsAppProvider } from "@/lib/whatsapp"
import { randomTypingDelay } from "@/lib/whatsapp/bot-rules"

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

    // Regra de cancelamento: só é possível cancelar enquanto o pedido ainda
    // não foi aceito pelo estabelecimento. Após o restaurante iniciar o
    // preparo (status="confirmed" em diante), o cliente deve solicitar
    // cancelamento pelo chat e o admin avalia manualmente.
    if (status === "cancelled") {
      const allowedStatuses = ["pending", "payment_pending"]
      if (!allowedStatuses.includes(order.status)) {
        return NextResponse.json(
          { error: "Este pedido já está em produção e não pode mais ser cancelado pelo cliente. Entre em contato pelo chat para solicitar cancelamento." },
          { status: 400 }
        )
      }
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
          const updatedCustomer = await tx.customer.update({
            where: { id: order.customerId },
            data: {
              cancellationCount: { increment: 1 },
            },
          })

          // Regra automática de bloqueio: se este estabelecimento tiver
          // cancellationBlockEnabled=true e o cliente (atualizado) tiver
          // cancelado N ou mais pedidos nos últimos X dias, bloqueia o
          // pagamento na entrega por Y dias (Customer.blockedUntil).
          if (cancelledByFinal === "customer") {
            const establishment = await tx.establishment.findUnique({
              where: { id: order.establishmentId },
              select: {
                cancellationBlockEnabled: true,
                cancellationBlockThreshold: true,
                cancellationBlockWindowDays: true,
                cancellationBlockDurationDays: true,
              },
            })
            if (
              establishment?.cancellationBlockEnabled &&
              establishment.cancellationBlockThreshold > 0
            ) {
              const windowStart = new Date(
                Date.now() - establishment.cancellationBlockWindowDays * 86400000
              )
              const recentCancellations = await tx.order.count({
                where: {
                  customerId: order.customerId,
                  establishmentId: order.establishmentId,
                  status: "cancelled",
                  cancelledBy: "customer",
                  cancellationDate: { gte: windowStart },
                },
              })
              if (recentCancellations >= establishment.cancellationBlockThreshold) {
                const blockedUntil = new Date(
                  Date.now() + establishment.cancellationBlockDurationDays * 86400000
                )
                await tx.customer.update({
                  where: { id: order.customerId },
                  data: { blockedUntil },
                })
              }
            }
          }
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
        ...(status === "out_for_delivery" && order.method !== "ifood" && !order.deliveryCode && { deliveryCode: String(Math.floor(1000 + Math.random() * 9000)) }),
        ...(status === "delivered" && { deliveredAt: new Date() }),
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
          // iFood state machine:
          //   confirm -> startPreparation -> dispatch (delivery) or readyToPickup (takeout)
          // For DELIVERY orders: use /dispatch (NOT /readyToPickup)
          // For TAKEOUT orders: use /readyToPickup (NOT /dispatch)
          const isDelivery = order.orderType === "delivery"
          const isMerchantDelivery = order.ifoodDeliveryBy === "MERCHANT"

          // readyToPickup is ONLY for takeout; delivery uses dispatch directly
          const readyAction = isDelivery ? "dispatch" : "readyForPickup"

          const statusActionMap: Record<string, string> = {
            confirmed: "confirm",
            preparing: "startPreparation",
            ready: readyAction,
            dispatched: "dispatch",
            out_to_delivery: "dispatch",
            out_for_delivery: "dispatch",
            outfordelivery: "dispatch",
            delivered: isMerchantDelivery ? "dispatch" : "",
            cancelled: "cancel",
          }
          const action = statusActionMap[status]
          if (action && order.externalId) {
            // When accepting a new iFood order (pending -> preparing), we need to
            // call /confirm first, then /startPreparation. iFood requires confirm
            // before any other status change.
            if (action === "startPreparation" && order.status === "pending") {
              const confirmResult = await updateIfoodStatus(accessToken, establishment.ifoodMerchantId, order.externalId, "confirm", order.ifoodDeliveryBy ?? undefined)
              console.log("[ifood status update] auto-confirm on accept:", { orderId: order.externalId, success: confirmResult.success, status: confirmResult.status })
            }
            const result = await updateIfoodStatus(accessToken, establishment.ifoodMerchantId, order.externalId, action, order.ifoodDeliveryBy ?? undefined)
            console.log("[ifood status update]", { orderId: order.externalId, action, status: result.status, body: result.body, success: result.success, isMerchantDelivery })
          } else if (status === "delivered" && !isMerchantDelivery) {
            console.log("[ifood sync] iFood delivery: skipping (iFood auto-concludes after dispatch)", { orderId: order.externalId })
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

    // Criar notificação no sino quando o status mudar
    if (status && status !== order.status && order.customerId) {
      const statusLabels: Record<string, string> = {
        confirmed: "Pedido confirmado!",
        preparing: "Seu pedido está sendo preparado",
        ready: "Pedido pronto para retirada!",
        out_for_delivery: "Saiu para entrega!",
        delivered: "Pedido entregue!",
        cancelled: "Pedido cancelado",
      }
      const label = statusLabels[status] || "Status atualizado"
      try {
        await prisma.customerNotification.create({
          data: {
            type: "order_status",
            title: label,
            message: `Pedido #${order.orderNumber || order.id.slice(0, 8)} - ${label}`,
            customerId: order.customerId,
          },
        })
      } catch (e: any) {
        console.error("Erro ao criar notificação:", e.message)
      }
    }

    // Notificar cliente via WhatsApp quando o status mudar (templates do bot v2)
    if (status && status !== order.status && order.customerPhone) {
      console.log(`[Order PATCH] Status mudou de "${order.status}" para "${status}" - notificando ${order.customerPhone}`)
      try {
        const establishment = await prisma.establishment.findUnique({
          where: { id: order.establishmentId },
          select: {
            name: true,
            slug: true,
            logo: true,
            whatsappProvider: true,
            evolutionBaseUrl: true,
            evolutionApiKey: true,
            evolutionInstanceName: true,
            whatsappNumber: true,
            metaPhoneNumberId: true,
            metaAccessToken: true,
            botEnabled: true,
            botTypingDelayMinMs: true,
            botTypingDelayMaxMs: true,
            botTemplateOrderConfirmed: true,
            botTemplateOrderPreparing: true,
            botTemplateOrderReady: true,
            botTemplateOrderDelivering: true,
            botTemplateOrderDelivered: true,
            botTemplateOrderCancelled: true,
            botTemplateOrderScheduled: true,
          },
        })
        const templateMap: Record<string, string | null | undefined> = {
          confirmed: establishment?.botTemplateOrderConfirmed,
          preparing: establishment?.botTemplateOrderPreparing,
          ready: establishment?.botTemplateOrderReady,
          out_for_delivery: establishment?.botTemplateOrderDelivering,
          delivered: establishment?.botTemplateOrderDelivered,
          cancelled: establishment?.botTemplateOrderCancelled,
        }
        const template = templateMap[status]
        console.log(`[Order PATCH] Template for "${status}": ${template ? template.substring(0, 50) : 'EMPTY/NULL'} | provider: ${establishment?.whatsappProvider} | baseUrl: ${establishment?.evolutionBaseUrl ? 'SET' : 'MISSING'}`)
        // WhatsApp falhando NUNCA pode impedir o push PWA de rodar.
        try {
          if (template && establishment) {
            const provider = getWhatsAppProvider({
              whatsappProvider: establishment.whatsappProvider,
              evolutionBaseUrl: establishment.evolutionBaseUrl,
              evolutionApiKey: establishment.evolutionApiKey,
              evolutionInstanceName: establishment.evolutionInstanceName,
              whatsappNumber: establishment.whatsappNumber,
              metaPhoneNumberId: establishment.metaPhoneNumberId,
              metaAccessToken: establishment.metaAccessToken,
            })
            console.log(`[Order PATCH] Provider: ${provider ? 'OK' : 'NULL'}`)
            if (provider) {
              const delay = randomTypingDelay(
                establishment.botTypingDelayMinMs || 1500,
                establishment.botTypingDelayMaxMs || 3500
              )
              console.log(`[Order PATCH] Enviando WhatsApp "${status}" para ${order.customerPhone} com delay ${delay}ms...`)
              const result = await provider.sendText(order.customerPhone, template, { delay })
              console.log(`[Order PATCH] WhatsApp "${status}" resultado:`, JSON.stringify(result))
            }
          }
        } catch (waErr: any) {
          console.warn(`[Order PATCH] WhatsApp "${status}" falhou (não bloqueia push):`, waErr.message)
        }

        // Push notification PWA (sempre, independente de template)
        try {
          const { sendPush } = await import("@/lib/push")
          const customerName = order.customerName?.split(" ")[0] || "Cliente"
          const orderNum = (order as any).orderNumber || order.id.substring(0, 8).toUpperCase()
          const statusTitleMap: Record<string, string> = {
            pending: "Pedido Recebido",
            confirmed: "Confirmado",
            preparing: "Preparando",
            ready: "Pronto",
            out_for_delivery: "Saiu para Entrega",
            delivered: "Entregue",
            cancelled: "Cancelado",
          }
          const statusVerbMap: Record<string, string> = {
            pending: "foi recebido",
            confirmed: "foi confirmado",
            preparing: "está sendo preparado",
            ready: "está pronto",
            out_for_delivery: "saiu para entrega",
            delivered: "foi entregue",
            cancelled: "foi cancelado",
          }
          const statusLabel = statusTitleMap[status] || "Atualização do pedido"
          const orderTotalStr = order.total != null ? `R$ ${Number(order.total).toFixed(2).replace(".", ",")}` : ""
          // Parse items from JSON string for push notification
          let orderItems: any[] = []
          try { orderItems = JSON.parse(order.items || "[]") } catch {}
          const itemsSummary = orderItems.length > 0
            ? orderItems.slice(0, 3).map((item: any) => `${item.quantity}x ${item.name}`).join(", ") + (orderItems.length > 3 ? ` +${orderItems.length - 3} mais` : "")
            : ""
          const pushTitle = `Pedido #${orderNum} · ${statusLabel}`
          const pushBody = `Olá ${customerName}! Seu pedido #${orderNum} ${statusVerbMap[status] || "foi atualizado"}${itemsSummary ? ` · ${itemsSummary}` : ""}${orderTotalStr ? ` · ${orderTotalStr}` : ""}`
          console.log(`[Order PATCH] Push "${status}": title="${pushTitle}" body="${pushBody}" phone=${order.customerPhone}`)
          const pushResult = await sendPush(order.establishmentId, order.customerPhone, {
            title: pushTitle,
            body: pushBody,
            icon: establishment?.slug ? `/api/icon/${establishment.slug}?size=192` : undefined,
            url: order.trackingToken && establishment?.slug ? `/${establishment.slug}?track=${order.trackingToken}` : `/`,
            tag: `order-${order.id}`,
          })
          console.log(`[Order PATCH] Push "${status}" resultado: sent=${pushResult.sent} failed=${pushResult.failed}`)
          await prisma.pushLog
            .create({
              data: {
                establishmentId: order.establishmentId,
                customerKey: order.customerPhone,
                status: pushResult.sent > 0 ? "ok" : "failed",
                sent: pushResult.sent,
                failed: pushResult.failed,
                detail: `PATCH "${status}" nº ${(order as any).orderNumber || order.id} - ${pushTitle} - ${pushBody}`.slice(0, 200),
              },
            })
            .catch(() => {})
        } catch (pushErr: any) {
          console.warn(`[Order PATCH] Push falhou:`, pushErr.message)
        }
      } catch (notifyErr: any) {
        console.error(`[Order PATCH] Falha ao notificar cliente: ${notifyErr.message}`)
      }
    }

    // Notificação inicial pra pedido agendado recém-criado
    if (order.isScheduled && order.deliveryDate && order.customerPhone) {
      try {
        const establishment = await prisma.establishment.findUnique({
          where: { id: order.establishmentId },
          select: {
            whatsappProvider: true,
            evolutionBaseUrl: true,
            evolutionApiKey: true,
            evolutionInstanceName: true,
            whatsappNumber: true,
            metaPhoneNumberId: true,
            metaAccessToken: true,
            botEnabled: true,
            botTypingDelayMinMs: true,
            botTypingDelayMaxMs: true,
            botTemplateOrderScheduled: true,
          },
        })
        if (establishment?.botTemplateOrderScheduled) {
          const provider = getWhatsAppProvider({
            whatsappProvider: establishment.whatsappProvider,
            evolutionBaseUrl: establishment.evolutionBaseUrl,
            evolutionApiKey: establishment.evolutionApiKey,
            evolutionInstanceName: establishment.evolutionInstanceName,
            whatsappNumber: establishment.whatsappNumber,
            metaPhoneNumberId: establishment.metaPhoneNumberId,
            metaAccessToken: establishment.metaAccessToken,
          })
          if (provider) {
            const dt = new Date(order.deliveryDate)
            const data = dt.toLocaleDateString("pt-BR")
            const hora = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
            const msg = establishment.botTemplateOrderScheduled
              .replace("{data}", data)
              .replace("{hora}", hora)
            const delay = randomTypingDelay(
              establishment.botTypingDelayMinMs || 1500,
              establishment.botTypingDelayMaxMs || 3500
            )
            await provider.sendText(order.customerPhone, msg, { delay })
            console.log(`[Order] Notificação de agendamento enviada para ${order.customerPhone}`)
          }
        }
      } catch (schedErr: any) {
        console.error(`[Order] Falha ao notificar agendamento: ${schedErr.message}`)
      }
    }

    return NextResponse.json({ success: true, order: updated })
  } catch (error: any) {
    console.error("[Order PATCH] Error:", error.message)
    return NextResponse.json({ error: "Erro ao atualizar pedido" }, { status: 500 })
  }
}
