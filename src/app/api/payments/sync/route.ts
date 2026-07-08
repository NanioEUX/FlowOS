import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

const ASAAS_API_URL =
  process.env.ASAAS_ENVIRONMENT === "sandbox"
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3"

const PAYMENT_STATUS_MAP: Record<string, string> = {
  AWAITING_RISK_ANALYSIS: "pending",
  PENDING: "pending",
  EXECUTE_SCHEDULED: "pending",
  RECEIVED: "paid",
  RECEIVED_IN_CASH: "paid",
  CONFIRMED: "paid",
  OVERDUE: "overdue",
  REFUNDED: "refunded",
  REFUND_REQUESTED: "refund_requested",
  CHARGEBACK_REQUESTED: "chargeback",
  CHARGEBACK_DISPUTE: "chargeback",
  CHARGEBACK: "chargeback",
  CREDIT_NOTE: "credit_note",
  DELETED: "deleted",
  SETTLED: "paid",
}

const ORDER_STATUS_MAP: Record<string, string> = {
  RECEIVED: "confirmed",
  RECEIVED_IN_CASH: "confirmed",
  CONFIRMED: "confirmed",
  SETTLED: "confirmed",
  OVERDUE: "cancelled",
}

// POST: sync single order payment status
export async function POST(req: NextRequest) {
  try {
    // Verify auth
    const user = await verifyAuth(req)
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

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

    // Verify user owns this order
    if (user.establishmentId !== order.establishmentId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    if (!order.paymentId) {
      return NextResponse.json({ error: "Pedido não possui cobrança Asaas" }, { status: 400 })
    }

    if (!order.establishment.asaasApiKey) {
      return NextResponse.json({ error: "API Key do Asaas não configurada" }, { status: 400 })
    }

    console.log("[PaymentSync POST] Syncing order:", order.id, "paymentId:", order.paymentId)

    // Query Asaas for payment status
    const res = await fetch(`${ASAAS_API_URL}/payments/${order.paymentId}`, {
      headers: { access_token: order.establishment.asaasApiKey },
    })

    if (!res.ok) {
      const err = await res.json()
      console.error("[PaymentSync POST] Erro Asaas:", JSON.stringify(err))
      return NextResponse.json({ error: "Erro ao consultar Asaas", details: err }, { status: 502 })
    }

    const payment = await res.json()

    console.log("[PaymentSync POST] Asaas status:", payment.status)

    const newPaymentStatus = PAYMENT_STATUS_MAP[payment.status] || "pending"
    const newOrderStatus = ORDER_STATUS_MAP[payment.status]

    // Only update if status actually changed
    const updateData: Record<string, unknown> = {}

    if (order.paymentStatus !== newPaymentStatus) {
      updateData.paymentStatus = newPaymentStatus
    }

    if (newOrderStatus && order.status !== newOrderStatus) {
      updateData.status = newOrderStatus
    }

    if (Object.keys(updateData).length === 0) {
      console.log("[PaymentSync POST] No update needed - status unchanged")
      return NextResponse.json({
        paymentStatus: order.paymentStatus,
        orderStatus: order.status,
        asaasStatus: payment.status,
        updated: false,
      })
    }

    await prisma.order.update({
      where: { id: order.id },
      data: updateData,
    })

    console.log("[PaymentSync POST] Order updated:", updateData)

    return NextResponse.json({
      paymentStatus: newPaymentStatus,
      orderStatus: newOrderStatus || order.status,
      asaasStatus: payment.status,
      updated: true,
    })
  } catch (error: any) {
    console.error("[PaymentSync POST] Erro:", error.message)
    return NextResponse.json({ error: "Erro ao sincronizar pagamento" }, { status: 500 })
  }
}

// GET: sync all payments for establishment (called periodically or manually)
export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const establishmentId = searchParams.get("establishmentId")

    if (!establishmentId) {
      return NextResponse.json({ error: "establishmentId obrigatório" }, { status: 400 })
    }

    // Verify user owns this establishment
    if (user.establishmentId !== establishmentId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Find orders with paymentId that are NOT already paid (and not too old - 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const ordersToSync = await prisma.order.findMany({
      where: {
        establishmentId,
        paymentId: { not: null },
        paymentStatus: { notIn: ["paid", "refunded"] },
        createdAt: { gte: sevenDaysAgo },
      },
      include: { establishment: { select: { asaasApiKey: true } } },
    })

    console.log(`[PaymentSync GET] Found ${ordersToSync.length} orders to sync`)

    if (!ordersToSync.length) {
      return NextResponse.json({ synced: 0, total: 0, message: "Nenhum pagamento para sincronizar" })
    }

    const apiKey = ordersToSync[0].establishment.asaasApiKey
    if (!apiKey) {
      return NextResponse.json({ error: "API Key não configurada" }, { status: 400 })
    }

    let synced = 0
    let errors = 0

    for (const order of ordersToSync) {
      try {
        const res = await fetch(`${ASAAS_API_URL}/payments/${order.paymentId}`, {
          headers: { access_token: apiKey },
        })

        if (!res.ok) {
          errors++
          continue
        }

        const payment = await res.json()
        const newPaymentStatus = PAYMENT_STATUS_MAP[payment.status] || "pending"
        const newOrderStatus = ORDER_STATUS_MAP[payment.status]

        // Only update if status actually changed
        const updateData: Record<string, unknown> = {}

        if (order.paymentStatus !== newPaymentStatus) {
          updateData.paymentStatus = newPaymentStatus
        }

        if (newOrderStatus && order.status !== newOrderStatus) {
          updateData.status = newOrderStatus
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.order.update({
            where: { id: order.id },
            data: updateData,
          })
          synced++
          console.log(`[PaymentSync GET] Order #${order.orderNumber}: ${order.paymentStatus} -> ${newPaymentStatus}`)
        }
      } catch (err) {
        errors++
      }
    }

    console.log(`[PaymentSync GET] Synced: ${synced}, Errors: ${errors}, Total: ${ordersToSync.length}`)

    return NextResponse.json({ synced, errors, total: ordersToSync.length })
  } catch (error: any) {
    console.error("[PaymentSync GET] Erro:", error.message)
    return NextResponse.json({ error: "Erro ao sincronizar" }, { status: 500 })
  }
}
