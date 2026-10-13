import { prisma } from "@/lib/prisma"
import { sendPush } from "@/lib/push"
import { getWhatsAppProvider } from "@/lib/whatsapp"
import { randomTypingDelay } from "@/lib/whatsapp/bot-rules"

/**
 * Notifica o cliente quando o pagamento (Pix ou cartão) é CONFIRMADO.
 *
 * Chamado pelos 3 caminhos que confirmam pagamento fora do PATCH do merchant:
 * - webhook Pagar.me (charge.paid / order.paid)
 * - polling /payment-status (quando detecta charge paga)
 * - rota do cartão (quando transação retorna paid/captured)
 *
 * Cria notificação no sino (CustomerNotification), envia push PWA e
 * (se configurado) o template de WhatsApp "pedido confirmado".
 * Nunca lança erro — notificação não pode derrubar o fluxo de pagamento.
 */
export async function notifyPaymentConfirmed(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        customerName: true,
        customerPhone: true,
        establishmentId: true,
        total: true,
        items: true,
        method: true,
        establishment: {
          select: {
            slug: true,
            name: true,
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
          },
        },
      },
    })
    if (!order) return

    const orderNum = order.orderNumber || order.id.slice(0, 8).toUpperCase()

    // 1) Sino in-app (CustomerNotification)
    if (order.customerId) {
      try {
        await prisma.customerNotification.create({
          data: {
            type: "payment_confirmed",
            title: "Pagamento confirmado!",
            message: `Pedido #${orderNum} - pagamento confirmado. Já estamos preparando!`,
            customerId: order.customerId,
          },
        })
      } catch (e: any) {
        console.warn("[PaymentNotify] CustomerNotification falhou:", e.message)
      }
    }

    // 2) Push PWA
    if (order.customerPhone) {
      try {
        const customerFirstName = order.customerName?.split(" ")[0] || "Cliente"
        let orderItems: any[] = []
        try { orderItems = JSON.parse(order.items || "[]") } catch {}
        const itemsSummary = orderItems.length > 0
          ? orderItems.slice(0, 3).map((i: any) => `${i.quantity}x ${i.name}`).join(", ") + (orderItems.length > 3 ? ` +${orderItems.length - 3} mais` : "")
          : ""
        const totalStr = order.total != null ? ` · R$ ${Number(order.total).toFixed(2).replace(".", ",")}` : ""
        const pushBody = `Olá ${customerFirstName}! O pagamento do pedido #${orderNum} foi confirmado${itemsSummary ? ` · ${itemsSummary}` : ""}${totalStr}`
        const pushResult = await sendPush(order.establishmentId, order.customerPhone, {
          title: `Pagamento confirmado · Pedido #${orderNum}`,
          body: pushBody,
          icon: order.establishment?.slug ? `/api/icon/${order.establishment.slug}?size=192` : undefined,
          url: order.establishment?.slug ? `/${order.establishment.slug}?orders=1` : `/`,
          tag: `order-${order.id}`,
        })
        console.log("[PaymentNotify] Push:", { orderId: order.id, sent: pushResult.sent, failed: pushResult.failed })
      } catch (e: any) {
        console.warn("[PaymentNotify] Push falhou:", e.message)
      }
    }

    // 3) WhatsApp (template "pedido confirmado") — igual ao PATCH do merchant
    if (order.customerPhone && order.establishment?.botTemplateOrderConfirmed) {
      try {
        const provider = getWhatsAppProvider({
          whatsappProvider: order.establishment.whatsappProvider,
          evolutionBaseUrl: order.establishment.evolutionBaseUrl,
          evolutionApiKey: order.establishment.evolutionApiKey,
          evolutionInstanceName: order.establishment.evolutionInstanceName,
          whatsappNumber: order.establishment.whatsappNumber,
          metaPhoneNumberId: order.establishment.metaPhoneNumberId,
          metaAccessToken: order.establishment.metaAccessToken,
        })
        if (provider) {
          const delay = randomTypingDelay(
            order.establishment.botTypingDelayMinMs || 1500,
            order.establishment.botTypingDelayMaxMs || 3500
          )
          await provider.sendText(order.customerPhone, order.establishment.botTemplateOrderConfirmed, { delay })
          console.log("[PaymentNotify] WhatsApp confirmado enviado:", order.id)
        }
      } catch (e: any) {
        console.warn("[PaymentNotify] WhatsApp falhou (não bloqueia):", e.message)
      }
    }
  } catch (e: any) {
    console.error("[PaymentNotify] Erro geral:", e.message)
  }
}
