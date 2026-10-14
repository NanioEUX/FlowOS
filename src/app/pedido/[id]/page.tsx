import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { TrackingPage } from "./tracking-page"
import { redirect } from "next/navigation"

const allStatusSteps = [
  { key: "pending", label: "Pedido Recebido", icon: "📥" },
  { key: "payment_pending", label: "Aguardando Pagamento", icon: "⏳" },
  { key: "accepted", label: "Aceito", icon: "👍" },
  { key: "preparing", label: "Preparando", icon: "👨‍🍳" },
  { key: "ready", label: "Pronto", icon: "📦" },
  { key: "out_for_delivery", label: "Saiu para entrega", icon: "🛵" },
  { key: "delivered", label: "Entregue", icon: "🎉" },
]

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

  const updatedOrder = await prisma.order.findFirst({
    where: { trackingToken: params.id },
    include: { establishment: true },
  })

  if (!updatedOrder) {
    notFound()
  }

  // Credenciais do tenant nunca vão para o HTML da página pública de tracking (F6A-001)
  for (const k of ["password","evolutionApiKey","metaAccessToken","metaWebhookVerifyToken","asaasApiKey","efiClientSecret","efiCertificate","efiWebhookToken","interClientSecret","interCertificate","interCertificatePassword","pagarmeApiKey","pagarmeWebhookKey","api99Key","ifoodAccessToken","ifoodRefreshToken","nineFoodApiKey"]) {
    delete (updatedOrder.establishment as any)[k]
  }

  // "Confirmado" removido da timeline do cliente (redundante com "Aceito").
  // Retirada/No local não passam por "Saiu para entrega".
  const onsiteOrder = updatedOrder.orderType === "pickup" || updatedOrder.orderType === "dineIn"
  const pickupSteps = onsiteOrder
    ? allStatusSteps
        .filter(s => s.key !== "out_for_delivery")
        .map(s => s.key === "ready"
          ? { ...s, label: updatedOrder.orderType === "dineIn" ? "Pronto" : "Pronto para Retirada" }
          : s.key === "delivered" && updatedOrder.orderType === "pickup" ? { ...s, label: "Retirado" } : s)
    : allStatusSteps
  const statusSteps = updatedOrder.paymentMethod === "online"
    ? pickupSteps
    : pickupSteps.filter(s => s.key !== "payment_pending")

  return <TrackingPage order={updatedOrder} statusSteps={statusSteps} />
}
