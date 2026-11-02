import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit"
import crypto from "crypto"
import { getRequestId, logger } from "@/lib/logger"

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { handshakeCode, deliveryPersonToken } = body

    if (!handshakeCode || !/^\d{4}$/.test(handshakeCode)) {
      return NextResponse.json(
        { error: "Código deve ter exatamente 4 dígitos" },
        { status: 400 }
      )
    }

    // F5B-021: 4 dígitos = 10k combinações; limita tentativas por pedido e por
    // IP (melhor esforço em serverless) antes de qualquer consulta.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    const perOrder = checkRateLimit(`handshake:order:${params.id}`, 8, 5 * 60 * 1000)
    const perIp = checkRateLimit(`handshake:ip:${ip}:${params.id}`, 12, 5 * 60 * 1000)
    if (!perOrder.allowed || !perIp.allowed) {
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente." },
        { status: 429 }
      )
    }

    const order = await prisma.order.findUnique({
      where: { id: params.id },
    })

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    // Auth: dashboard session OR motoboy token
    if (deliveryPersonToken) {
      const person = await prisma.deliveryPerson.findUnique({
        where: { token: deliveryPersonToken },
      })
      if (!person || person.id !== order.deliveryPersonId) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      }
    } else {
      const auth = verifyAuth(req)
      if (!auth) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      }
      if (order.establishmentId !== auth.establishmentId) {
        return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
      }
    }

    // Validate preconditions
    // Delivery: must be in route. Pickup: confirmed at the counter while "ready"
    // (the customer collects the order and informs the code).
    const isPickupReady = order.orderType === "pickup" && order.status === "ready"
    if (!["out_for_delivery", "dispatched"].includes(order.status) && !isPickupReady) {
      return NextResponse.json(
        { error: "Pedido precisa estar em rota de entrega para confirmar" },
        { status: 400 }
      )
    }

    if (!order.deliveryCode) {
      return NextResponse.json(
        { error: "Este pedido não possui código de entrega" },
        { status: 400 }
      )
    }

    // Verify code locally (comparação em tempo constante)
    const codeBuf = Buffer.from(handshakeCode, "utf8")
    const expectedBuf = Buffer.from(String(order.deliveryCode ?? ""), "utf8")
    const codeOk = codeBuf.length === expectedBuf.length && crypto.timingSafeEqual(codeBuf, expectedBuf)
    if (!codeOk) {
      return NextResponse.json(
        { error: "Código de confirmação incorreto. Verifique com o cliente e tente novamente." },
        { status: 400 }
      )
    }

    // Código certo — zera o contador e marca como entregue
    resetRateLimit(`handshake:order:${params.id}`)
    resetRateLimit(`handshake:ip:${ip}:${params.id}`)
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "delivered", deliveredAt: new Date() },
    })

    return NextResponse.json({ success: true, message: "Entrega confirmada com sucesso" })
  } catch (err: any) {
    logger.error("delivery-handshake", "falha no handshake de entrega", { requestId: getRequestId(req), orderId: params.id, error: err?.message })
    return NextResponse.json(
      { error: "Erro interno ao processar confirmação" },
      { status: 500 }
    )
  }
}
