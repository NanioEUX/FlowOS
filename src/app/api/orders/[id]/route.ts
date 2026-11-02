import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getIfoodAuth } from "@/lib/integrations/ifood"
import { updateIfoodStatus } from "@/lib/integrations/ifood-status"
import { verifyAuth } from "@/lib/auth"
import { getWhatsAppProvider } from "@/lib/whatsapp"
import { randomTypingDelay } from "@/lib/whatsapp/bot-rules"
import { restoreOrderStock } from "@/lib/stock"
import { canTransition, isValidStatus, isRoleAllowedToSetStatus } from "@/lib/order-transitions"
import crypto from "crypto"
import { getRequestId, logger } from "@/lib/logger"

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestId = getRequestId(req)
  const id = params.id
  try {
    const auth = verifyAuth(req)
    const body = await req.json().catch(() => ({} as any))
    const { status, paymentStatus, cancellationReason, cancelledBy, deliveryPersonId } = body
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

    // Regra de cancelamento:
    // - Cliente (anônimo via token): SÓ pode cancelar enquanto pedido ainda
    //   não foi aceito (status="pending"/"payment_pending").
    // - Merchant (admin autenticado): pode cancelar QUALQUER status não-final.
    if (status === "cancelled") {
      // Idempotente: se o pedido JÁ está cancelado, responde sucesso para que
      // o cliente possa limpar o estado local (carrinho travado com itens de
      // pedido antigo) sem receber erro.
      if (order.status === "cancelled") {
        return NextResponse.json({ success: true, cancelled: true, alreadyCancelled: true })
      }
      const isMerchant = !!auth
      if (!isMerchant) {
        // "abandoned" = pedido online que expirou sem aceite/pagamento; o
        // cliente pode cancelar para destravar o próprio carrinho.
        const allowedStatuses = ["pending", "payment_pending", "abandoned"]
        if (!allowedStatuses.includes(order.status)) {
          return NextResponse.json(
            { error: "Este pedido já está em produção e não pode mais ser cancelado pelo cliente. Entre em contato pelo chat para solicitar cancelamento." },
            { status: 400 }
          )
        }
      } else {
        // Merchant: bloqueia só se já está finished.
        const finishedStatuses = ["delivered", "cancelled"]
        if (finishedStatuses.includes(order.status)) {
          return NextResponse.json(
            { error: "Pedido já finalizado ou cancelado" },
            { status: 400 }
          )
        }
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
          // Estorno de loyalty: devolver pontos usados, remover cashback e bônus
          const reversalDelta = (order.loyaltyPointsUsed || 0) - (order.cashbackEarned || 0) - (order.firstPurchaseBonus || 0)
          const updatedCustomer = await tx.customer.update({
            where: { id: order.customerId },
            data: {
              cancellationCount: { increment: 1 },
              totalOrders: { decrement: 1 },
              totalSpent: { decrement: order.total || 0 },
              ...(reversalDelta !== 0 ? { loyaltyPoints: { increment: reversalDelta } } : {}),
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

        // Restore stock for cancelled order items
        await restoreOrderStock(tx, order.items, order.id, order.establishmentId)

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

    // Máquina de estados no servidor (F5A-002 / F5D-008): o cancelamento já
    // tem as próprias regras acima; aqui o resto do fluxo — whitelist de
    // status, progresso para frente e restrição por papel (kds não entrega,
    // motoboy não muta status por este caminho).
    if (status && status !== order.status) {
      if (!isValidStatus(status)) {
        return NextResponse.json({ error: `Status inválido: ${status}` }, { status: 400 })
      }
      if (!auth) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      }
      if (!isRoleAllowedToSetStatus(auth.role, status)) {
        return NextResponse.json(
          { error: `Seu perfil não pode mover o pedido para "${status}"` },
          { status: 403 }
        )
      }
      if (!canTransition(order.status, status)) {
        return NextResponse.json(
          { error: `Transição inválida: ${order.status} → ${status}` },
          { status: 400 }
        )
      }
    }

    // Reatribuição de motoboy (F5B-018): antes era só regra de tela — o
    // handler ignorava o campo em silêncio. Agora aceita e valida o dono.
    let deliveryPersonPatch: Record<string, any> = {}
    if (deliveryPersonId !== undefined && deliveryPersonId !== null) {
      if (!auth) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      }
      if (deliveryPersonId === "") {
        deliveryPersonPatch = { deliveryPersonId: null, deliveryPerson: null }
      } else {
        const person = await prisma.deliveryPerson.findUnique({
          where: { id: deliveryPersonId },
          select: { id: true, name: true, establishmentId: true },
        })
        if (!person || person.establishmentId !== order.establishmentId) {
          return NextResponse.json({ error: "Entregador não encontrado" }, { status: 404 })
        }
        deliveryPersonPatch = { deliveryPersonId: person.id, deliveryPerson: person.name }
      }
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
        ...deliveryPersonPatch,
        ...(status === "out_for_delivery" && { assignedAt: new Date() }),
        ...(status === "out_for_delivery" && ["delivery", "pickup"].includes(order.orderType) && order.method !== "ifood" && !order.deliveryCode && { deliveryCode: String(crypto.randomInt(1000, 10000)) }),
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
          logger.warn("orders-patch", "falha de auth no sync do iFood — push de status ignorado", { requestId: getRequestId(req) })
        } else {
        const accessToken = auth.accessToken
        const establishment = await prisma.establishment.findUnique({
          where: { id: order.establishmentId },
        })
        if (establishment?.ifoodMerchantId) {
          // iFood state machine:
          //   confirm -> startPreparation -> readyToPickup -> dispatch (delivery)
          // Operador clica "Concluir Pedido" → manda readyToPickup (pedido
          // pronto). Quando operador clica "Sair p/ Entrega" → manda dispatch.
          const isDelivery = order.orderType === "delivery"
          const isMerchantDelivery = order.ifoodDeliveryBy === "MERCHANT"

          const statusActionMap: Record<string, string> = {
            confirmed: "confirm",
            accepted: "confirm",
            preparing: "startPreparation",
            ready: "readyForPickup",
            dispatched: "dispatch",
            out_to_delivery: "dispatch",
            out_for_delivery: "dispatch",
            outfordelivery: "dispatch",
            delivered: isMerchantDelivery ? "dispatch" : "",
            cancelled: "cancel",
          }
          const action = statusActionMap[status]
          if (action && order.externalId) {
            // Auto-confirm quando iFood ainda não recebeu o confirm (pedido
            // ainda em 'pending'/'new' no iFood). Dispara em pending → accepted
            // OU pending → preparing.
            if (action === "startPreparation" && (order.status === "pending" || order.status === "new" || order.status === "accepted" || order.status === "confirmed")) {
              const confirmResult = await updateIfoodStatus(accessToken, establishment.ifoodMerchantId, order.externalId, "confirm", order.ifoodDeliveryBy ?? undefined)
              logger.info("orders-patch", "auto-confirm no iFood ao iniciar o preparo", { requestId: getRequestId(req), orderId: id, externalId: order.externalId, success: confirmResult?.success, status: confirmResult?.status })
            }
            const result = await updateIfoodStatus(accessToken, establishment.ifoodMerchantId, order.externalId, action, order.ifoodDeliveryBy ?? undefined, action === "cancel" ? (cancellationReason || undefined) : undefined)
            // F4A-014: o body da resposta do iFood pode conter dados do cliente — fora do log.
            logger.info("orders-patch", "status atualizado no iFood", { requestId: getRequestId(req), orderId: id, externalId: order.externalId, action, status: result?.status, success: result?.success, isMerchantDelivery })
          } else if (status === "delivered" && !isMerchantDelivery) {
            logger.info("orders-patch", "sync do iFood ignorado (delivery concluída pelo iFood)", { requestId: getRequestId(req), orderId: id, externalId: order.externalId })
          } else {
            logger.info("orders-patch", "sync do iFood ignorado", { requestId: getRequestId(req), orderId: id, hasExternalId: !!order.externalId, status, action, isMerchantDelivery })
          }
        }
        }
      } catch (err) {
        logger.error("orders-patch", "falha ao sincronizar status do iFood", { requestId, orderId: id, error: (err as any)?.message })
      }
    }

    // Sync status to 99Food when order is from 99Food marketplace
    if (order.method === "99food" && status && order.externalId) {
      try {
        const establishment = await prisma.establishment.findUnique({
          where: { id: order.establishmentId },
          select: { nineFoodApiKey: true, nineFoodMerchantId: true },
        })

        if (establishment?.nineFoodApiKey && establishment.nineFoodMerchantId) {
          const { update99FoodStatus } = await import("@/lib/integrations/nine-food-status")

          const statusActionMap: Record<string, string> = {
            confirmed: "confirm",
            accepted: "confirm",
            preparing: "startPreparation",
            ready: "readyForPickup",
            dispatched: "dispatch",
            out_for_delivery: "dispatch",
            delivered: "dispatch",
            cancelled: "cancel",
          }
          const action = statusActionMap[status]
          if (action) {
            const result = await update99FoodStatus(
              establishment.nineFoodApiKey,
              order.externalId,
              action,
              status === "cancel" ? (cancellationReason || undefined) : undefined
            )
            logger.info("orders-patch", "status atualizado no 99Food", { requestId: getRequestId(req), orderId: id, externalId: order.externalId, action, success: result?.success, status: result?.status })
          }
        }
      } catch (err) {
        logger.error("orders-patch", "falha ao sincronizar status do 99Food", { requestId, orderId: id, error: (err as any)?.message })
      }
    }

    // Despachar corrida 99 quando pedido fica "Em Entrega"
    if (status === "out_for_delivery" && order.orderType === "delivery") {
      try {
        const est = await prisma.establishment.findUnique({
          where: { id: order.establishmentId },
          select: {
            tipoEntregaAtiva: true,
            api99Key: true,
            api99EmployeeId: true,
            addressLat: true,
            addressLng: true,
          },
        })

        if (
          est?.tipoEntregaAtiva === "99entrega" &&
          est.api99Key &&
          est.api99EmployeeId &&
          est.addressLat &&
          est.addressLng &&
          order.customerLat &&
          order.customerLng &&
          !order.entrega99RideId
        ) {
          const entregaPinCode = String(Math.floor(1000 + Math.random() * 9000))
          const { despacharCorrida99 } = await import("@/lib/integrations/nine-nine")
          const result = await despacharCorrida99(
            est.api99Key,
            est.api99EmployeeId,
            est.addressLat,
            est.addressLng,
            order.customerLat,
            order.customerLng,
            order.id,
            entregaPinCode
          )

          if (result.success && result.rideId) {
            await prisma.order.update({
              where: { id: order.id },
              data: {
                entrega99RideId: result.rideId,
                entregaPinCode,
                entregaStatusProvedor: "pending",
              },
            })
            logger.info("orders-patch", "corrida despachada na 99", { requestId: getRequestId(req), orderId: id, rideId: result?.rideId })
          } else {
            logger.error("orders-patch", "falha ao despachar corrida na 99", { requestId, orderId: id, error: result?.error })
          }
        }
      } catch (err) {
        logger.error("orders-patch", "erro ao despachar corrida na 99", { requestId, orderId: id, error: (err as any)?.message })
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
        logger.error("orders-patch", "falha ao atribuir entregante automaticamente", { requestId, orderId: id, error: autoErr?.message })
      }
    }

    // Criar notificação no sino quando o status mudar (substitui a anterior)
    if (status && status !== order.status && order.customerId) {
      const statusLabels: Record<string, string> = {
        confirmed: "Pedido confirmado!",
        preparing: "Seu pedido está sendo preparado",
        ready: order.orderType === "dineIn" ? "Pedido pronto!" : "Pedido pronto para retirada!",
        out_for_delivery: "Saiu para entrega!",
        delivered: "Pedido entregue!",
        cancelled: "Pedido cancelado",
      }
      const label = statusLabels[status] || "Status atualizado"
      try {
        // Deletar notificações anteriores de status deste pedido
        await prisma.customerNotification.deleteMany({
          where: {
            customerId: order.customerId,
            type: "order_status",
          },
        })
        // Criar notificação nova
        await prisma.customerNotification.create({
          data: {
            type: "order_status",
            title: label,
            message: `Pedido #${order.orderNumber || order.id.slice(0, 8)} - ${label}`,
            customerId: order.customerId,
          },
        })
      } catch (e: any) {
        logger.error("orders-patch", "erro ao criar notificação", { requestId, orderId: id, error: e?.message })
      }
    }

    // Notificar cliente via WhatsApp quando o status mudar (templates do bot v2)
    if (status && status !== order.status && order.customerPhone) {
      logger.info("orders-patch", "status do pedido alterado — notificando o cliente", { requestId: getRequestId(req), orderId: id, from: order.status, to: status })
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
        logger.info("orders-patch", "template de WhatsApp selecionado", { requestId: getRequestId(req), orderId: id, status, hasTemplate: !!template, provider: establishment?.whatsappProvider, hasBaseUrl: !!establishment?.evolutionBaseUrl })
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
            logger.info("orders-patch", "provedor de WhatsApp resolvido", { requestId: getRequestId(req), orderId: id, hasProvider: !!provider })
            if (provider) {
              const delay = randomTypingDelay(
                establishment.botTypingDelayMinMs || 1500,
                establishment.botTypingDelayMaxMs || 3500
              )
              logger.info("orders-patch", "enviando WhatsApp", { requestId: getRequestId(req), orderId: id, status, delay })
              const result = await provider.sendText(order.customerPhone, template, { delay })
              logger.info("orders-patch", "resultado do envio por WhatsApp", { requestId: getRequestId(req), orderId: id, status, success: result?.success })
            }
          }
        } catch (waErr: any) {
          logger.warn("orders-patch", "falha no envio do WhatsApp (não bloqueia o push)", { requestId: getRequestId(req), orderId: params.id, status, error: waErr?.message })
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
          // F4A-014: title/body do push carregam o nome do cliente — fora do log.
          logger.info("orders-patch", "enviando push", { requestId: getRequestId(req), orderId: id, status, titleLength: pushTitle?.length || 0, bodyLength: pushBody?.length || 0 })
          const pushResult = await sendPush(order.establishmentId, order.customerPhone, {
            title: pushTitle,
            body: pushBody,
            icon: establishment?.slug ? `/api/icon/${establishment.slug}?size=192` : undefined,
            url: establishment?.slug ? `/${establishment.slug}?orders=1` : `/`,
            tag: `order-${order.id}`,
          })
          logger.info("orders-patch", "resultado do push", { requestId: getRequestId(req), orderId: id, status, sent: pushResult?.sent, failed: pushResult?.failed })
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
          logger.warn("orders-patch", "falha no envio do push", { requestId: getRequestId(req), orderId: params.id, error: pushErr?.message })
        }
      } catch (notifyErr: any) {
        logger.error("orders-patch", "falha ao notificar cliente", { requestId, orderId: id, error: notifyErr?.message })
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
            logger.info("orders-patch", "notificação de agendamento enviada", { requestId: getRequestId(req), orderId: id })
          }
        }
      } catch (schedErr: any) {
        logger.error("orders-patch", "falha ao notificar agendamento", { requestId, orderId: id, error: schedErr?.message })
      }
    }

    return NextResponse.json({ success: true, order: updated })
  } catch (error: any) {
    logger.error("orders-patch", "erro ao atualizar o pedido", { requestId, orderId: id, error: (error as any)?.message })
    return NextResponse.json({ error: "Erro ao atualizar pedido" }, { status: 500 })
  }
}
