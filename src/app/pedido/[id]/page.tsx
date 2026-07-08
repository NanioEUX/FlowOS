import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { TrackingPage } from "./tracking-page"
import { redirect } from "next/navigation"

const allStatusSteps = [
  { key: "pending", label: "Pedido recebido", icon: "📥" },
  { key: "payment_pending", label: "Aguardando pagamento", icon: "⏳" },
  { key: "confirmed", label: "Confirmado", icon: "✅" },
  { key: "preparing", label: "Preparando", icon: "👨‍🍳" },
  { key: "ready", label: "Pronto", icon: "📦" },
  { key: "out_for_delivery", label: "Saiu para entrega", icon: "🛵" },
  { key: "delivered", label: "Entregue", icon: "🎉" },
]

const ASAAS_API_URL =
  process.env.ASAAS_ENVIRONMENT === "sandbox"
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3"

async function syncPaymentStatus(orderId: string, paymentId: string, apiKey: string) {
  try {
    const res = await fetch(`${ASAAS_API_URL}/payments/${paymentId}`, {
      headers: { access_token: apiKey },
    })
    if (!res.ok) return null
    const payment = await res.json()

    const statusMap: Record<string, string> = {
      RECEIVED: "paid",
      CONFIRMED: "paid",
      OVERDUE: "overdue",
      REFUNDED: "refunded",
    }
    const orderStatusMap: Record<string, string> = {
      RECEIVED: "confirmed",
      CONFIRMED: "confirmed",
    }

    const newPaymentStatus = statusMap[payment.status]
    if (!newPaymentStatus) return null

    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: newPaymentStatus,
        status: orderStatusMap[payment.status],
      },
    })

    return { paymentStatus: newPaymentStatus, asaasStatus: payment.status }
  } catch {
    return null
  }
}

export default async function OrderTrackingPage({
  params,
}: {
  params: { id: string }
}) {
  const order = await prisma.order.findFirst({
    where: {
      trackingToken: params.id,
    },
    include: { establishment: true },
  })

  if (!order) {
    notFound()
  }

  if (order.paymentId && order.paymentStatus === "pending" && order.establishment.asaasApiKey) {
    await syncPaymentStatus(order.id, order.paymentId, order.establishment.asaasApiKey)
  }

  const updatedOrder = await prisma.order.findFirst({
    where: { trackingToken: params.id },
    include: { establishment: true },
  })

  if (!updatedOrder) {
    notFound()
  }

  const statusSteps = updatedOrder.paymentMethod === "online"
    ? allStatusSteps
    : allStatusSteps.filter(s => s.key !== "payment_pending")

  return <TrackingPage order={updatedOrder} statusSteps={statusSteps} />
}
