import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Endpoint público (sem auth) usado pelo Service Worker para buscar os dados
 * do pedido mais recente quando o payload push não é entregue ao dispositivo
 * (comportamento known no iOS Chrome). O SW envia establishmentId + customerKey
 * que foram salvos no IndexedDB durante o subscription.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const establishmentId = searchParams.get("establishmentId")
  const customerKey = searchParams.get("customerKey")

  if (!establishmentId || !customerKey) {
    return NextResponse.json({ error: "establishmentId e customerKey são obrigatórios" }, { status: 400 })
  }

  const normalizedKey = customerKey.replace(/\D/g, "")
  const keys = [customerKey, normalizedKey].filter((k, i, arr) => k && arr.indexOf(k) === i)

  const order = await prisma.order.findFirst({
    where: {
      establishmentId,
      customerPhone: { in: keys },
      status: { notIn: ["cancelled", "abandoned"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      items: true,
      total: true,
      customerName: true,
      trackingToken: true,
      createdAt: true,
      establishment: { select: { slug: true } },
    },
  })

  if (!order) {
    return NextResponse.json({ error: "Nenhum pedido encontrado" }, { status: 404 })
  }

  let parsedItems: any[] = []
  try { parsedItems = JSON.parse(order.items || "[]") } catch {}

  const itemsSummary = parsedItems.length > 0
    ? parsedItems.slice(0, 3).map((item: any) => `${item.quantity}x ${item.name}`).join(", ") +
      (parsedItems.length > 3 ? ` +${parsedItems.length - 3} mais` : "")
    : ""

  const totalStr = order.total != null ? `R$ ${Number(order.total).toFixed(2).replace(".", ",")}` : ""

  const statusTitleMap: Record<string, string> = {
    pending: "Pedido Recebido",
    confirmed: "Confirmado",
    preparing: "Preparando",
    ready: "Pronto",
    out_for_delivery: "Saiu para Entrega",
    delivered: "Entregue",
    cancelled: "Cancelado",
  }

  return NextResponse.json({
    orderNumber: order.orderNumber,
    status: order.status,
    statusLabel: statusTitleMap[order.status] || "Atualização",
    customerName: order.customerName,
    itemsSummary,
    total: totalStr,
    url: order.trackingToken && order.establishment?.slug ? `/${order.establishment.slug}/menu?track=${order.trackingToken}` : "/",
  })
}
