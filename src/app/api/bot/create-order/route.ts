import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export interface BotOrderItem {
  productId: string
  name?: string
  price?: number
  quantity: number
  notes?: string
  additions?: Array<{ name: string; price: number }>
}

export interface BotCreateOrderRequest {
  establishmentId: string
  customerName: string
  customerPhone: string
  customerAddress?: string
  customerNumber?: string
  customerComplement?: string
  customerNeighborhood?: string
  customerCep?: string
  customerReference?: string
  customerCpf?: string
  items: BotOrderItem[]
  orderType: "delivery" | "pickup" | "table"
  paymentMethod: "online" | "cash" | "card_delivery" | "card_pickup" | "delivery" | "pickup"
  notes?: string
  scheduledFor?: string // ISO datetime - pedido agendado (encomenda)
}

export async function POST(req: NextRequest) {
  try {
    const body: BotCreateOrderRequest = await req.json()
    const {
      establishmentId,
      customerName,
      customerPhone,
      customerAddress,
      customerNumber,
      customerComplement,
      customerNeighborhood,
      customerCep,
      customerReference,
      customerCpf,
      items,
      orderType,
      paymentMethod,
      notes,
    } = body

    if (!establishmentId || !customerName || !customerPhone || !items?.length) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

    const productIds = items.map((i) => i.productId).filter(Boolean)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isAvailable: true },
    })
    const productMap = new Map(products.map((p) => [p.id, p]))

    const calculatedItems = items.map((item) => {
      const product = productMap.get(item.productId)
      if (!product) throw new Error(`Produto ${item.productId} não encontrado`)
      const additionsTotal =
        item.additions?.reduce((s, a) => s + a.price, 0) || 0
      const unitPrice = product.price + additionsTotal
      return {
        id: product.id,
        productId: product.id,
        name: product.name,
        price: unitPrice,
        quantity: item.quantity,
        notes: item.notes,
        additions: item.additions || [],
      }
    })

    const establishment = await prisma.establishment.findUnique({
      where: { id: establishmentId },
      select: {
        slug: true,
        scheduledMinHours: true,
        scheduledPrepMinutes: true,
        scheduledMaxAdvanceDays: true,
      },
    })
    if (!establishment) {
      return NextResponse.json({ error: "Estabelecimento não encontrado" }, { status: 404 })
    }

    // Validação de agendamento
    let isScheduled = false
    let scheduledDate: Date | null = null
    if (body.scheduledFor) {
      scheduledDate = new Date(body.scheduledFor)
      if (isNaN(scheduledDate.getTime())) {
        return NextResponse.json({ error: "Data de agendamento inválida" }, { status: 400 })
      }
      const now = new Date()
      const minMs = (establishment.scheduledMinHours || 24) * 60 * 60 * 1000
      const maxMs = (establishment.scheduledMaxAdvanceDays || 30) * 24 * 60 * 60 * 1000
      if (scheduledDate.getTime() <= now.getTime()) {
        return NextResponse.json(
          {
            error: "Data de agendamento deve ser no futuro.",
            code: "scheduled_must_be_future",
          },
          { status: 400 }
        )
      }
      if (scheduledDate.getTime() - now.getTime() < minMs) {
        const minHours = establishment.scheduledMinHours || 24
        return NextResponse.json(
          {
            error: `Pedidos agendados precisam de pelo menos ${minHours}h de antecedência.`,
            code: "scheduled_too_soon",
            minHours,
          },
          { status: 400 }
        )
      }
      if (scheduledDate.getTime() - now.getTime() > maxMs) {
        const maxDays = establishment.scheduledMaxAdvanceDays || 30
        return NextResponse.json(
          {
            error: `Antecedência máxima é de ${maxDays} dias.`,
            code: "scheduled_too_far",
            maxDays,
          },
          { status: 400 }
        )
      }
      isScheduled = true
    }

    const fullAddress = customerAddress
      ? `${customerAddress}${customerNumber ? `, ${customerNumber}` : ""}${
          customerComplement ? ` - ${customerComplement}` : ""
        }${customerNeighborhood ? ` - ${customerNeighborhood}` : ""}${
          customerReference ? ` (${customerReference})` : ""
        }`
      : null

    const isPayOnDelivery = ["cash", "delivery", "pickup", "card_delivery", "card_pickup"].includes(
      paymentMethod
    )

    // Chama o endpoint oficial /api/orders que faz toda a validação,
    // cálculo de total/taxa e geração de pagamento PIX.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}` || "http://localhost:3000"

    const ordersRes = await fetch(`${appUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        establishmentId,
        customerName,
        customerPhone,
        customerAddress: fullAddress,
        customerCep,
        customerCpf,
        items: calculatedItems,
        orderType,
        paymentMethod,
        method: "bot",
        notes,
        isScheduled,
        deliveryDate: scheduledDate?.toISOString(),
        // Não enviamos total/deliveryFee - o servidor recalcula
      }),
    })

    const ordersData = await ordersRes.json()
    if (!ordersRes.ok) {
      return NextResponse.json(
        { error: ordersData.error || "Erro ao criar pedido", code: ordersData.code },
        { status: ordersRes.status }
      )
    }

    // O endpoint /api/orders já retorna { order, paymentLink, trackingUrl }
    const fullOrder = ordersData.order
    if (!fullOrder) {
      return NextResponse.json({ success: true, ...ordersData })
    }

    const trackingUrl = ordersData.trackingUrl
      ? `https://flowoshub.com/${establishment.slug}${ordersData.trackingUrl.startsWith("/") ? ordersData.trackingUrl : "/" + ordersData.trackingUrl}`
      : null

    return NextResponse.json({
      success: true,
      order: {
        id: fullOrder.id,
        orderNumber: fullOrder.orderNumber,
        total: fullOrder.total,
        trackingUrl,
        paymentLink: ordersData.paymentLink,
        status: fullOrder.status,
      },
    })
  } catch (error: any) {
    console.error("[Bot Create Order] Erro:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
