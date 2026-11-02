import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { timingSafeEqualStr } from "@/lib/webhook-signature"
import { process99Event } from "@/lib/webhook-99"
import { getRequestId, logger } from "@/lib/logger"

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

  const requestId = getRequestId(req)

  try {
    const result = await process99Event(body, requestId)

    if (result.status === "processed") {
      await prisma.logWebhook99.updateMany({
        where: { rideId: body?.rideId || body?.ride_id || undefined, pedidoId: body?.externalId || body?.external_id || undefined },
        data: { statusProcessamento: "processado" },
      })
    } else if (result.status === "not_found") {
      // F4A-008: evento sem pedido correspondente não pode sumir — fica
      // registrado como "erro" e o cron de replay tenta de novo depois.
      await prisma.logWebhook99.updateMany({
        where: { rideId: body?.rideId || body?.ride_id || undefined, pedidoId: body?.externalId || body?.external_id || undefined },
        data: { statusProcessamento: "erro" },
      })
      return NextResponse.json({ received: true, error: "Pedido não encontrado" })
    }
  } catch (err: any) {
    // F4A-009: a falha ficava só no log (ninguém relia) e o pedido travava
    // em out_for_delivery. Agora devolve 500 → a 99 reenvia, e o cron de
    // replay reprocessa o que sobrou.
    logger.error("webhook-99", "falha ao processar — devolvendo 500 para o provedor reenviar", {
      requestId,
      rideId: body?.rideId || body?.ride_id || null,
      error: err?.message,
    })
    await prisma.logWebhook99.updateMany({
      where: { rideId: body?.rideId || body?.ride_id || undefined, pedidoId: body?.externalId || body?.external_id || undefined },
      data: { statusProcessamento: "erro" },
    })
    return NextResponse.json({ error: "processing failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
