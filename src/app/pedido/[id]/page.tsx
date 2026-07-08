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
    console.log("[Sync] Checking payment:", paymentId)
    const res = await fetch(`${ASAAS_API_URL}/payments/${paymentId}`, {
      headers: { access_token: apiKey },
    })
    if (!res.ok) {
      console.log("[Sync] Asaas returned:", res.status)
      return null
    }
    const payment = await res.json()
    console.log("[Sync] Asaas status:", payment.status)

    const statusMap: Record<string, string> = {
      RECEIVED: "paid",
      RECEIVED_IN_CASH: "paid",
      CONFIRMED: "paid",
      OVERDUE: "overdue",
      REFUNDED: "refunded",
    }
    const orderStatusMap: Record<string, string> = {
      RECEIVED: "confirmed",
      RECEIVED_IN_CASH: "confirmed",
      CONFIRMED: "confirmed",
      SETTLED: "confirmed",
    }

    const newPaymentStatus = statusMap[payment.status]
    if (!newPaymentStatus) return null

    console.log("[Sync] Updating order:", { orderId, paymentStatus: newPaymentStatus, status: orderStatusMap[payment.status] })
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: newPaymentStatus,
        status: orderStatusMap[payment.status],
      },
    })

    return { paymentStatus: newPaymentStatus, asaasStatus: payment.status }
  } catch (err: any) {
    console.error("[Sync] Error:", err?.message)
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

  if (order.paymentId && order.paymentStatus !== "paid" && order.establishment.asaasApiKey) {
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
