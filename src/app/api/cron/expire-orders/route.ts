import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { restoreOrderStock } from "@/lib/stock"

/**
 * GET /api/cron/expire-orders — expurgo de pedidos não confirmados (abandoned).
 *
 * Migra para o cron a escrita-por-leitura que existia no GET /api/orders
 * (F3A-001/F3D-002): antes, CADA poll do dashboard/KDS/caixa rodava o expurgo
 * de 1–2 queries + transação. Agora roda de 5 em 5 minutos, idempotente,
 * respeitando `abandonedOrderMinutes` de cada estabelecimento e a regra de
 * agendados (F5A-031). Estorno de estoque + reversão de fidelidade (F5A-022).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const establishments = await prisma.establishment.findMany({
    select: { id: true, abandonedOrderMinutes: true },
  })
  if (establishments.length === 0) {
    return NextResponse.json({ success: true, expired: 0, establishments: 0 })
  }

  // Agrupa por janela de expiração — a maioria usa o default (15 min) e vira
  // uma única consulta com `establishmentId IN (...)`.
  const byMinutes = new Map<number, string[]>()
  for (const est of establishments) {
    const minutes = est.abandonedOrderMinutes ?? 15
    const ids = byMinutes.get(minutes)
    if (ids) ids.push(est.id)
    else byMinutes.set(minutes, [est.id])
  }

  let expired = 0

  for (const [minutes, establishmentIds] of byMinutes) {
    const threshold = new Date(Date.now() - minutes * 60 * 1000)
    const abandonedOrders = await prisma.order.findMany({
      where: {
        establishmentId: { in: establishmentIds },
        status: { in: ["pending", "new", "payment_pending"] },
        createdAt: { lt: threshold },
        // F5A-031: pedido agendado só expira depois da janela da entrega
        OR: [
          { isScheduled: false },
          { isScheduled: true, deliveryDate: { lt: threshold } },
        ],
      },
      select: {
        id: true,
        establishmentId: true,
        customerId: true,
        loyaltyPointsUsed: true,
        cashbackEarned: true,
        firstPurchaseBonus: true,
        total: true,
        items: true,
      },
    })
    if (abandonedOrders.length === 0) continue

    await prisma.$transaction(async (tx) => {
      await tx.order.updateMany({
        where: { id: { in: abandonedOrders.map((o) => o.id) } },
        data: {
          status: "abandoned",
          cancellationReason: "Pedido expirado — não confirmado no tempo limite",
          cancellationDate: new Date(),
          cancelledBy: "system",
        },
      })
      for (const o of abandonedOrders) {
        await restoreOrderStock(tx, o.items, o.id, o.establishmentId)
        if (o.customerId) {
          const reversalDelta = (o.loyaltyPointsUsed || 0) - (o.cashbackEarned || 0) - (o.firstPurchaseBonus || 0)
          await tx.customer.update({
            where: { id: o.customerId },
            data: {
              totalOrders: { decrement: 1 },
              totalSpent: { decrement: o.total || 0 },
              ...(reversalDelta !== 0 ? { loyaltyPoints: { increment: reversalDelta } } : {}),
            },
          })
        }
      }
    })
    expired += abandonedOrders.length
  }

  if (expired > 0) {
    console.log(`[Expire Orders Cron] ${expired} pedidos expirados em ${establishments.length} estabelecimentos`)
  }

  return NextResponse.json({ success: true, expired, establishments: establishments.length })
}
