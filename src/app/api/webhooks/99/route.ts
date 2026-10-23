import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { timingSafeEqualStr } from "@/lib/webhook-signature"
import { restoreOrderStock } from "@/lib/stock"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  // Optional shared secret (WEBHOOK_99_SECRET): when set, require it via
  // x-webhook-secret header, Authorization: Bearer or ?key= query param.
  const webhookSecret = process.env.WEBHOOK_99_SECRET || ""
  if (webhookSecret) {
    const provided =
      req.headers.get("x-webhook-secret") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      req.nextUrl.searchParams.get("key") ||
      ""
    if (!timingSafeEqualStr(provided, webhookSecret)) {
      console.warn("[99 Webhook] missing/invalid WEBHOOK_99_SECRET")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ received: true })
  }

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

  const statusMap: Record<string, string> = {
    "pending": "pending",
    "accepted": "confirmed",
    "driver_arriving": "ready",
    "in_transit": "out_for_delivery",
    "delivered": "delivered",
    "cancelled": "cancelled",
    "canceled": "cancelled",
  }

  // F5B-... (5.1): fora do mapa, NÃO grava string arbitrária na coluna de
  // status — só o campo de provedor é atualizado.
  const mappedStatus = statusMap[status] || null

  try {
    if (pedido.status === "cancelled") {
      // Terminal: evento de corrida após cancelamento não reescreve status
      // nem deliveredAt — só o log é marcado como processado.
    } else if (mappedStatus === "cancelled") {
      // Estorno de estoque ao cancelamento vindo da 99 (F5A-010: era só
      // update — o estoque debitado ficava perdido).
      await prisma.$transaction(async (tx) => {
        await restoreOrderStock(tx, pedido.items, pedido.id, pedido.establishmentId)
        await tx.order.update({
          where: { id: pedido.id },
          data: {
            status: "cancelled",
            paymentStatus: pedido.paymentStatus === "paid" ? "refunded" : "cancelled",
            cancellationReason: "Cancelado pela 99",
            cancellationDate: new Date(),
            cancelledBy: "system",
            entregaStatusProvedor: status,
          },
        })
      })
    } else {
      await prisma.order.update({
        where: { id: pedido.id },
        data: {
          entregaStatusProvedor: status,
          ...(mappedStatus && { status: mappedStatus }),
          ...(status === "delivered" && { deliveredAt: new Date() }),
        },
      })
    }

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
