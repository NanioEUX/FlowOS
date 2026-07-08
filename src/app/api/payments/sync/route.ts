import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

const ASAAS_API_URL =
  process.env.ASAAS_ENVIRONMENT === "sandbox"
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3"

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json()

    if (!orderId) {
      return NextResponse.json({ error: "orderId obrigatório" }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { establishment: { select: { asaasApiKey: true } } },
    })

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    if (!order.paymentId) {
      return NextResponse.json({ error: "Pedido não possui cobrança Asaas" }, { status: 400 })
    }

    if (!order.establishment.asaasApiKey) {
      return NextResponse.json({ error: "API Key do Asaas não configurada" }, { status: 400 })
    }

    // Query Asaas for payment status
    const res = await fetch(`${ASAAS_API_URL}/payments/${order.paymentId}`, {
      headers: { access_token: order.establishment.asaasApiKey },
    })

    if (!res.ok) {
      const err = await res.json()
      console.error("[PaymentSync] Erro Asaas:", JSON.stringify(err))
      return NextResponse.json({ error: "Erro ao consultar Asaas", details: err }, { status: 502 })
    }

    const payment = await res.json()

    const statusMap: Record<string, string> = {
      RECEIVED: "paid",
      CONFIRMED: "paid",
      OVERDUE: "overdue",
      REFUNDED: "refunded",
      REFUND_REQUESTED: "refund_requested",
      PENDING: "pending",
    }

    const orderStatusMap: Record<string, string> = {
      RECEIVED: "confirmed",
      CONFIRMED: "confirmed",
      PENDING: "payment_pending",
    }

    const newPaymentStatus = statusMap[payment.status] || "pending"
    const newOrderStatus = orderStatusMap[payment.status] || order.status

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: newPaymentStatus,
        status: newOrderStatus,
      },
    })

    console.log(`[PaymentSync] Pedido #${order.orderNumber}: ${order.paymentStatus} -> ${newPaymentStatus}`)

    return NextResponse.json({
      paymentStatus: newPaymentStatus,
      orderStatus: newOrderStatus,
      asaasStatus: payment.status,
    })
  } catch (error: any) {
    console.error("[PaymentSync] Erro:", error.message)
    return NextResponse.json({ error: "Erro ao sincronizar pagamento" }, { status: 500 })
  }
}

// GET: sync all pending payments (called periodically or manually)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const establishmentId = searchParams.get("establishmentId")

    const user = await verifyAuth(req)
    if (!user || user.establishmentId !== establishmentId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const pendingOrders = await prisma.order.findMany({
      where: {
        establishmentId: establishmentId!,
        paymentId: { not: null },
        paymentStatus: "pending",
      },
      include: { establishment: { select: { asaasApiKey: true } } },
    })

    if (!pendingOrders.length) {
      return NextResponse.json({ synced: 0, message: "Nenhum pagamento pendente" })
    }

    const apiKey = pendingOrders[0].establishment.asaasApiKey
    if (!apiKey) {
      return NextResponse.json({ error: "API Key não configurada" }, { status: 400 })
    }

    let synced = 0
    const statusMap: Record<string, string> = {
      RECEIVED: "paid",
      CONFIRMED: "paid",
      OVERDUE: "overdue",
      REFUNDED: "refunded",
    }
    const orderStatusMap: Record<string, string> = {
      RECEIVED: "confirmed",
      CONFIRMED: "confirmed",
    }

    for (const order of pendingOrders) {
      try {
        const res = await fetch(`${ASAAS_API_URL}/payments/${order.paymentId}`, {
          headers: { access_token: apiKey },
        })
        if (!res.ok) continue
        const payment = await res.json()
        const newPaymentStatus = statusMap[payment.status]
        if (newPaymentStatus && newPaymentStatus !== order.paymentStatus) {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: newPaymentStatus,
              status: orderStatusMap[payment.status] || order.status,
            },
          })
          synced++
        }
      } catch {}
    }

    return NextResponse.json({ synced, total: pendingOrders.length })
  } catch (error: any) {
    console.error("[PaymentSync] Erro:", error.message)
    return NextResponse.json({ error: "Erro ao sincronizar" }, { status: 500 })
  }
}
