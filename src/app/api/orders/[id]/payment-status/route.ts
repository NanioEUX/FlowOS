import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getInterPixStatus } from "@/lib/integrations/inter"
import { getPagarmeConfig } from "@/lib/pagarme-config"
import { notifyPaymentConfirmed } from "@/lib/payment-notifications"
import { isClosedOrderStatus } from "@/lib/order-transitions"
import { getRequestId, logger } from "@/lib/logger"

// Public endpoint used by the cardápio to poll payment status. Requires the
// order's trackingToken as ?token= so only someone with the order link can
// trigger a status check. Never returns secrets.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestId = getRequestId(req)
  const { searchParams } = new URL(req.url)
  const token = searchParams.get("token")
  if (!token) {
    return NextResponse.json({ error: "Token necessário" }, { status: 401 })
  }

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    select: {
      trackingToken: true,
      paymentStatus: true,
      status: true,
      paymentId: true,
      establishmentId: true,
      establishment: {
        select: {
          interClientId: true,
          interClientSecret: true,
          interCertificate: true,
          interCertificatePassword: true,
        },
      },
    },
  })

  if (!order || order.trackingToken !== token) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
  }

  const isInterPayment = order.paymentId?.startsWith("inter_")

  if (isInterPayment && order.paymentStatus === "pending" && order.establishment.interClientId) {
    const txid = order.paymentId!.replace("inter_", "")
    try {
      const config = {
        clientId: order.establishment.interClientId!,
        clientSecret: order.establishment.interClientSecret!,
        certificate: order.establishment.interCertificate!,
        certificatePassword: order.establishment.interCertificatePassword || "",
      }
      const result = await getInterPixStatus(config, txid)

      if (result.status === "CONCLUIDA") {
        const est = await prisma.establishment.findUnique({
          where: { id: order.establishmentId },
          select: { autoAcceptOrders: true },
        })
        const interNewStatus = est?.autoAcceptOrders ? "accepted" : "pending"
        // F4B-035: pagamento tardio em pedido já cancelado/abandonado não
        // ressuscita o pedido — o dinheiro é registrado (para o reembolso
        // manual) e o lojista é alertado.
        if (isClosedOrderStatus(order.status)) {
          logger.error("payment-status", "pagamento recebido para pedido já fechado — reembolso manual necessário", {
            requestId: getRequestId(req),
            orderId: params.id,
            status: order.status,
            gateway: "inter",
          })
          await prisma.order.update({
            where: { id: params.id },
            data: { paymentStatus: "paid" },
          })
          return NextResponse.json({ paymentStatus: "paid", status: order.status })
        }
        await prisma.order.update({
          where: { id: params.id },
          data: { paymentStatus: "paid", status: interNewStatus },
        })
        notifyPaymentConfirmed(params.id).catch(() => {})
        return NextResponse.json({ paymentStatus: "paid", status: interNewStatus })
      }
    } catch (error: any) {
      logger.error("payment-status", "erro ao consultar status do PIX Inter", { requestId, orderId: params.id, error: error?.message })
    }
  }

  // Pagar.me payment status polling.
  // Compatível tanto com order id (or_...) quanto com charge id (ch_...)
  // dependendo do que foi gravado no paymentId.
  const pagarmeId = order.paymentId
  const isPagarmePayment = !!(pagarmeId && (pagarmeId.startsWith("ch_") || pagarmeId.startsWith("or_")))
  if (isPagarmePayment && order.paymentStatus === "pending" && pagarmeId) {
    try {
      const config = await getPagarmeConfig()
      if (config.apiKey) {
        // Se for order id, buscar primeiro a order para descobrir a charge.
        let chargeId = pagarmeId
        if (pagarmeId.startsWith("or_")) {
          const orderRes = await fetch(`https://api.pagar.me/core/v5/orders/${pagarmeId}`, {
            headers: { Authorization: `Basic ${Buffer.from(config.apiKey + ":").toString("base64")}` },
          })
          if (orderRes.ok) {
            const orderData = await orderRes.json()
            chargeId = orderData?.charges?.[0]?.id || pagarmeId
          }
        }
        const res = await fetch(`https://api.pagar.me/core/v5/charges/${chargeId}`, {
          headers: { Authorization: `Basic ${Buffer.from(config.apiKey + ":").toString("base64")}` },
        })
        if (res.ok) {
          const charge = await res.json()
          const isPaid = charge.status === "paid" || charge.last_transaction_status === "paid" || charge.status === "captured"
          if (isPaid) {
            // Check autoAcceptOrders to decide between accepted (auto) or
            // pending (waiting for merchant to manually accept)
            const est = await prisma.establishment.findUnique({
              where: { id: order.establishmentId },
              select: { autoAcceptOrders: true },
            })
            const newStatus = est?.autoAcceptOrders ? "accepted" : "pending"
            // F4B-035: pagamento tardio em pedido cancelado/abandonado não
            // ressuscita o pedido (registra o pago + alerta para reembolso).
            if (isClosedOrderStatus(order.status)) {
              logger.error("payment-status", "pagamento recebido para pedido já fechado — reembolso manual necessário", {
                requestId: getRequestId(req),
                orderId: params.id,
                status: order.status,
                gateway: "pagarme",
              })
              await prisma.order.update({
                where: { id: params.id },
                data: { paymentStatus: "paid" },
              })
              return NextResponse.json({ paymentStatus: "paid", status: order.status })
            }
            await prisma.order.update({
              where: { id: params.id },
              data: { paymentStatus: "paid", status: newStatus },
            })
            notifyPaymentConfirmed(params.id).catch(() => {})
            return NextResponse.json({ paymentStatus: "paid", status: newStatus })
          }
          // PIX expired or failed → cancel order with reason
          const isExpired = charge.status === "failed" || charge.status === "canceled" || charge.status === "expired"
            || charge.last_transaction_status === "failed" || charge.last_transaction_status === "expired"
          if (isExpired) {
            const fullOrder = await prisma.order.findUnique({
              where: { id: params.id },
              select: { customerId: true, loyaltyPointsUsed: true, cashbackEarned: true, firstPurchaseBonus: true, total: true },
            })
            await prisma.$transaction(async (tx) => {
              await tx.order.update({
                where: { id: params.id },
                data: {
                  paymentStatus: "expired",
                  status: "cancelled",
                  cancellationReason: "Pagamento PIX não realizado — cobrança expirada",
                  cancellationDate: new Date(),
                  cancelledBy: "system",
                },
              })
              // Reverse loyalty points and cashback
              if (fullOrder?.customerId) {
                const reversalDelta = (fullOrder.loyaltyPointsUsed || 0) - (fullOrder.cashbackEarned || 0) - (fullOrder.firstPurchaseBonus || 0)
                await tx.customer.update({
                  where: { id: fullOrder.customerId },
                  data: {
                    totalOrders: { decrement: 1 },
                    totalSpent: { decrement: fullOrder.total || 0 },
                    ...(reversalDelta !== 0 ? { loyaltyPoints: { increment: reversalDelta } } : {}),
                  },
                })
              }
            })
            return NextResponse.json({ paymentStatus: "expired", status: "cancelled" })
          }
        }
      }
    } catch (e: any) {
      logger.error("payment-status", "erro ao consultar status da cobrança Pagar.me", { requestId, orderId: params.id, error: e?.message })
    }
  }

  return NextResponse.json({
    paymentStatus: order.paymentStatus,
    status: order.status,
  })
}
