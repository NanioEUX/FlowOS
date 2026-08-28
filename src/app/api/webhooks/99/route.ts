import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

/**
 * Webhook público para receber atualizações de status da 99Entrega.
 * POST /api/webhooks/99
 *
 * A 99 envia notificações quando o status de uma corrida muda.
 * Este endpoint processa e atualiza o pedido correspondente.
 */
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ received: true })
  }

  // Log do webhook recebido para auditoria
  try {
    await prisma.logWebhook99.create({
      data: {
        rideId: body?.rideId || body?.ride_id || null,
        pedidoId: body?.externalId || body?.external_id || null,
        payload: body,
        statusProcessamento: "pendente",
      },
    })
  } catch (err) {
    console.error("[99 Webhook] Erro ao salvar log:", err)
  }

  const rideId = body?.rideId || body?.ride_id
  const status = body?.status || body?.rideStatus || body?.ride_status
  const externalId = body?.externalId || body?.external_id

  if (!rideId && !externalId) {
    return NextResponse.json({ received: true })
  }

  // Buscar pedido pelo ride_id ou external_id (pedido_id)
  let pedido: any = null
  if (rideId) {
    pedido = await prisma.order.findFirst({
      where: { entrega99RideId: rideId },
    })
  }
  if (!pedido && externalId) {
    pedido = await prisma.order.findFirst({
      where: { id: externalId },
    })
  }

  if (!pedido) {
    console.warn("[99 Webhook] Pedido não encontrado para rideId:", rideId, "externalId:", externalId)
    return NextResponse.json({ received: true, error: "Pedido não encontrado" })
  }

  // Mapear status da 99 para status do pedido
  const statusMap: Record<string, string> = {
    "pending": "pending",
    "accepted": "confirmed",
    "driver_arriving": "ready",
    "in_transit": "out_for_delivery",
    "delivered": "delivered",
    "cancelled": "cancelled",
    "canceled": "cancelled",
  }

  const mappedStatus = statusMap[status] || status

  // Atualizar pedido
  try {
    await prisma.order.update({
      where: { id: pedido.id },
      data: {
        entregaStatusProvedor: status,
        ...(mappedStatus && { status: mappedStatus }),
        ...(status === "delivered" && { deliveredAt: new Date() }),
        ...(status === "cancelled" && { cancellationReason: "Cancelado pela 99" }),
      },
    })

    // Atualizar log como processado
    await prisma.logWebhook99.updateMany({
      where: { rideId: rideId || undefined, pedidoId: pedido.id },
      data: { statusProcessamento: "processado" },
    })
  } catch (err) {
    console.error("[99 Webhook] Erro ao atualizar pedido:", err)
    await prisma.logWebhook99.updateMany({
      where: { rideId: rideId || undefined, pedidoId: pedido.id },
      data: { statusProcessamento: "erro" },
    })
  }

  return NextResponse.json({ received: true })
}
