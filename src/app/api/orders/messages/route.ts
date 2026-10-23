import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

/**
 * GET /api/orders/messages?ids=id1,id2,... — lote de mensagens do chat (F3A-021).
 *
 * Substitui o N+1 do polling por pedido: pedidos (badge de "msg nova" por card)
 * e KDS faziam 1 requisição por pedido a cada 30s/5s (≈36 mil req/h com N=50).
 * Só staff autenticado (mesma regra do GET por pedido); retorna
 * `{ [orderId]: Message[] }`. Máximo 300 ids por chamada.
 */
export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) {
    return NextResponse.json({ error: "Autenticação necessária" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const ids = (searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  if (ids.length === 0) return NextResponse.json({})
  if (ids.length > 300) {
    return NextResponse.json({ error: "Máximo de 300 pedidos por chamada" }, { status: 400 })
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: ids }, establishmentId: auth.establishmentId },
    select: { id: true },
  })
  const validIds = orders.map((o) => o.id)
  if (validIds.length === 0) return NextResponse.json({})

  const messages = await prisma.orderMessage.findMany({
    where: { orderId: { in: validIds } },
    orderBy: { createdAt: "asc" },
  })

  const map: Record<string, typeof messages> = {}
  for (const id of validIds) map[id] = []
  for (const m of messages) map[m.orderId]!.push(m)

  return NextResponse.json(map)
}
