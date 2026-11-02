import { prisma } from "@/lib/prisma"
import { sendPush } from "@/lib/push"
import { logger } from "@/lib/logger"

/**
 * Notifica o cliente quando o pagamento (Pix ou cartão) é CONFIRMADO.
 *
 * Chamado pelos 3 caminhos que confirmam pagamento fora do PATCH do merchant:
 * - webhook Pagar.me (charge.paid / order.paid)
 * - polling /payment-status (quando detecta charge paga)
 * - rota do cartão (quando transação retorna paid/captured)
 *
 * Envia apenas push PWA. Nunca lança erro — notificação não pode derrubar
 * o fluxo de pagamento.
 */
export async function notifyPaymentConfirmed(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerPhone: true,
        establishmentId: true,
        total: true,
        items: true,
        establishment: {
          select: { slug: true },
        },
      },
    })
    if (!order) return

    const orderNum = order.orderNumber || order.id.slice(0, 8).toUpperCase()

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
        logger.info("payment-notify", "push de pagamento enviado", { orderId: order.id, sent: pushResult.sent, failed: pushResult.failed })
      } catch (e: any) {
        logger.warn("payment-notify", "push de pagamento falhou", { error: e?.message })
      }
    }
  } catch (e: any) {
    logger.error("payment-notify", "erro ao notificar o pagamento", { error: e?.message })
  }
}
