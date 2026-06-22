import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createPaymentLink } from "@/lib/integrations/asaas"
import crypto from "crypto"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { establishmentId, customerName, customerPhone, customerAddress, customerComplement, customerCep, items, total, deliveryFee, notes, paymentMethod, method, orderType, couponId, useLoyalty, loyaltyPointsUsed, loyaltyDiscount } = body

    if (!establishmentId || !customerName || !items || !total) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

    const establishment = await prisma.establishment.findUnique({
      where: { id: establishmentId },
    })

    if (!establishment) {
      return NextResponse.json({ error: "Estabelecimento não encontrado" }, { status: 404 })
    }

    const trackingToken = crypto.randomBytes(12).toString("hex")

    // Generate order number per establishment
    const lastOrder = await prisma.order.findFirst({
      where: { establishmentId },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    })
    const orderNumber = (lastOrder?.orderNumber || 0) + 1

    // Find or create customer
    let customerId: string | undefined
    if (customerPhone) {
      let customer = await prisma.customer.findFirst({
        where: { phone: customerPhone, establishmentId },
      })
      if (customer) {
        customerId = customer.id
        // Calculate loyalty points: earn points based on subtotal (before loyalty discount)
        const subtotal = (typeof items === "string" ? JSON.parse(items) : items).reduce((s: number, i: any) => s + i.price * i.quantity, 0)
        let pointsDelta = 0
        if (useLoyalty && loyaltyPointsUsed > 0) {
          pointsDelta -= loyaltyPointsUsed
        }
        if (establishment.loyaltyConfig) {
          try {
            const lc = JSON.parse(establishment.loyaltyConfig)
            if (lc.enabled) {
              pointsDelta += Math.floor(subtotal * (lc.pointsPerReal || 1))
            }
          } catch {}
        }
        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            name: customerName,
            address: customerComplement || customer.address,
            cep: customerCep || customer.cep,
            totalOrders: { increment: 1 },
            totalSpent: { increment: total },
            loyaltyPoints: { increment: pointsDelta },
          },
        })
      } else {
        let initialPoints = 0
        if (establishment.loyaltyConfig) {
          try {
            const lc = JSON.parse(establishment.loyaltyConfig)
            if (lc.enabled) {
              const subtotal = (typeof items === "string" ? JSON.parse(items) : items).reduce((s: number, i: any) => s + i.price * i.quantity, 0)
              initialPoints = Math.floor(subtotal * (lc.pointsPerReal || 1))
            }
          } catch {}
        }
        customer = await prisma.customer.create({
          data: { phone: customerPhone, name: customerName, address: customerComplement, cep: customerCep, establishmentId, totalOrders: 1, totalSpent: total, loyaltyPoints: initialPoints },
        })
        customerId = customer.id
      }
    }

    const order = await prisma.order.create({
      data: {
        establishmentId,
        customerId,
        customerName,
        customerPhone,
        customerAddress,
        orderType: orderType || "delivery",
        paymentMethod: paymentMethod || "online",
        deliveryFee: deliveryFee ? (typeof deliveryFee === "string" ? parseFloat(deliveryFee) : deliveryFee) : 0,
        items: typeof items === "string" ? items : JSON.stringify(items),
        total: typeof total === "string" ? parseFloat(total) : total,
        notes,
        method: method || "site",
        trackingToken,
        status: body.status || "pending",
        couponId: couponId || null,
        orderNumber,
      },
    })

    // Increment coupon usedCount
    if (couponId) {
      await prisma.coupon.update({
        where: { id: couponId },
        data: { usedCount: { increment: 1 } },
      }).catch(() => {})
    }

    let paymentLink = ""

    if (paymentMethod === "asaas" || paymentMethod === "online") {
      if (establishment.asaasApiKey) {
        const parsedItems = typeof items === "string" ? JSON.parse(items) : items
        const itemNames = (Array.isArray(parsedItems) ? parsedItems : [])
          .map((i: any) => `${i.name} x${i.quantity}`)
          .join(", ")

        const splitRules = []
        if (establishment.asaasWalletId && establishment.platformFee > 0) {
          splitRules.push({
            walletId: establishment.asaasWalletId,
            percentual: 100 - establishment.platformFee,
            description: `Repasse para ${establishment.name}`,
          })
        }

        const payment = await createPaymentLink({
          apiKey: establishment.asaasApiKey,
          customerName,
          customerPhone: customerPhone || "",
          value: order.total,
          description: `Pedido #${orderNumber} - ${establishment.name} - ${itemNames}`,
          splitRules: splitRules.length > 0 ? splitRules : undefined,
        })

        paymentLink = payment.invoiceUrl

        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentId: payment.id,
            paymentLink: payment.invoiceUrl,
            paymentStatus: payment.status,
            status: "payment_pending",
          },
        })
      }
    }

    const fullOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { establishment: true },
    })

    // Decrement stock for products
    try {
      const parsedItems = typeof items === "string" ? JSON.parse(items) : items
      for (const item of parsedItems) {
        if (item.productId && item.productId !== "custom") {
          const product = await prisma.product.findUnique({ where: { id: item.productId } })

          // Direct sale: product linked to a stock item
          if (product?.stockItemId) {
            const stockItem = await prisma.stockItem.findUnique({ where: { id: product.stockItemId } })
            if (stockItem && stockItem.quantity >= item.quantity) {
              await prisma.stockItem.update({
                where: { id: product.stockItemId },
                data: { quantity: stockItem.quantity - item.quantity },
              })
              await prisma.stockMovement.create({
                data: {
                  type: "exit",
                  quantity: item.quantity,
                  notes: `Pedido ${order.id} - ${product.name}`,
                  itemId: product.stockItemId,
                },
              })
            }
          }

          // BOM links: product made of multiple stock items
          const links = await prisma.productStockLink.findMany({ where: { productId: item.productId } })
          for (const link of links) {
            const deduction = link.quantity * item.quantity
            const stockItem = await prisma.stockItem.findUnique({ where: { id: link.stockItemId } })
            if (stockItem && stockItem.quantity >= deduction) {
              await prisma.stockItem.update({
                where: { id: link.stockItemId },
                data: { quantity: stockItem.quantity - deduction },
              })
              await prisma.stockMovement.create({
                data: {
                  type: "exit",
                  quantity: deduction,
                  notes: `Pedido ${order.id}`,
                  itemId: link.stockItemId,
                },
              })
            }
          }
        }
      }
    } catch (e) {
      console.error("Error decrementing stock:", e)
    }

    return NextResponse.json({ order: fullOrder, paymentLink, trackingUrl: `/pedido/${trackingToken}` })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao criar pedido" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const establishmentId = searchParams.get("establishmentId")
  const status = searchParams.get("status")

  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId necessário" }, { status: 400 })
  }

  const where: any = { establishmentId }
  if (status) where.status = status

  const orders = await prisma.order.findMany({
    where,
    include: { establishment: { select: { name: true, phone: true } } },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(orders)
}
