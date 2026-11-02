import { prisma } from "@/lib/prisma"
import { restoreOrderStock } from "@/lib/stock"
import { logger } from "@/lib/logger"

/**
 * Processamento de eventos de corrida da 99 (F4A-009/F4B-006).
 *
 * O webhook grava o evento em `LogWebhook99` e chama `process99Event`.
 * O cron `/api/cron/replay-webhooks` relê o que ficou "pendente"/"erro" e
 * chama a MESMA função — assim o evento que falhou não fica preso para
 * sempre (antes ninguém relia a tabela).
 */

const STATUS_MAP: Record<string, string> = {
  pending: "pending",
  accepted: "confirmed",
  driver_arriving: "ready",
  in_transit: "out_for_delivery",
  delivered: "delivered",
  cancelled: "cancelled",
  canceled: "cancelled",
}

export interface Process99Result {
  status: "processed" | "not_found" | "ignored" | "error"
  detail?: string
}

export async function process99Event(body: any, requestId?: string): Promise<Process99Result> {
  const rideId = body?.rideId || body?.ride_id
  const status = body?.status || body?.rideStatus || body?.ride_status
  const externalId = body?.externalId || body?.external_id

  if (!rideId && !externalId) {
    return { status: "ignored", detail: "sem rideId/externalId" }
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
    logger.warn("webhook-99", "pedido não encontrado para o evento", {
      requestId,
      rideId: rideId || null,
      externalId: externalId || null,
    })
    return { status: "not_found" }
  }

  // Fora do mapa, NÃO grava string arbitrária na coluna de status — só o
  // campo de provedor é atualizado (F5A-010).
  const mappedStatus = STATUS_MAP[status] || null

  try {
    if (pedido.status === "cancelled") {
      // Terminal: evento de corrida após cancelamento não reescreve status
      // nem deliveredAt.
    } else if (mappedStatus === "cancelled") {
      // Estorno de estoque ao cancelamento vindo da 99 (F5A-010).
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

    return { status: "processed" }
  } catch (err: any) {
    logger.error("webhook-99", "erro ao atualizar pedido", {
      requestId,
      orderId: pedido?.id || null,
      establishmentId: pedido?.establishmentId || null,
      error: err?.message,
    })
    throw err
  }
}
