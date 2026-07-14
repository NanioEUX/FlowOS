import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createPaymentLink } from "@/lib/integrations/asaas"
import { createEfiPixCharge } from "@/lib/integrations/efi"
import crypto from "crypto"

// Orders GET: 5s cache (frequent updates but reduces DB load)
export const revalidate = 5

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { establishmentId, customerName, customerPhone, customerAddress, customerComplement, customerCep, customerCpf, items, total, deliveryFee, notes, paymentMethod, method, orderType, couponId, useLoyalty, loyaltyPointsUsed, loyaltyDiscount, tableNumber } = body

    console.log("[Orders POST] paymentMethod:", paymentMethod, "| orderType:", orderType, "| method:", method)

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

    // For presencial mesa orders: status=new, no payment at creation
    const isMesa = orderType === "presencial" && tableNumber
    const initialStatus = body.status || (isMesa ? "new" : "pending")

    // Parse items and calculate totals server-side (never trust client-sent total)
    const parsedItems = typeof items === "string" ? JSON.parse(items) : items
    const subtotal = parsedItems.reduce((s: number, i: any) => s + i.price * i.quantity, 0)
    const deliveryFeeValue = deliveryFee ? (typeof deliveryFee === "string" ? parseFloat(deliveryFee) : deliveryFee) : 0
    const loyaltyDiscountValue = loyaltyDiscount ? (typeof loyaltyDiscount === "string" ? parseFloat(loyaltyDiscount) : loyaltyDiscount) : 0
    const calculatedTotal = Math.max(0, subtotal + deliveryFeeValue - loyaltyDiscountValue)

    // Find or create customer - CPF is unique identifier
    let customerId: string | undefined
    if (customerPhone || customerCpf) {
      let customer = null

      // 1. Try to find by CPF first (unique per person)
      if (customerCpf) {
        const cpfDigits = customerCpf.replace(/\D/g, "")
        if (cpfDigits.length === 11) {
          customer = await prisma.customer.findFirst({
            where: { cpf: cpfDigits, establishmentId },
          })
          if (customer) {
            // Update phone/name if provided
            await prisma.customer.update({
              where: { id: customer.id },
              data: {
                ...(customerPhone && { phone: customerPhone }),
                ...(customerName && { name: customerName }),
              },
            })
          }
        }
      }

      // 2. If no CPF match, try by phone
      if (!customer && customerPhone) {
        customer = await prisma.customer.findFirst({
          where: { phone: customerPhone, establishmentId },
        })
        if (customer) {
          // Update CPF/name if provided
          const cpfDigits = customerCpf?.replace(/\D/g, "")
          await prisma.customer.update({
            where: { id: customer.id },
            data: {
              ...(cpfDigits?.length === 11 && { cpf: cpfDigits }),
              ...(customerName && { name: customerName }),
            },
          })
        }
      }

      if (customer) {
        customerId = customer.id
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
            cpf: customerCpf?.replace(/\D/g, "") || customer.cpf,
            address: customerComplement || customer.address,
            cep: customerCep || customer.cep,
            totalOrders: { increment: 1 },
            totalSpent: { increment: calculatedTotal },
            loyaltyPoints: { increment: pointsDelta },
          },
        })
      } else {
        // Create new customer
        let initialPoints = 0
        if (establishment.loyaltyConfig) {
          try {
            const lc = JSON.parse(establishment.loyaltyConfig)
            if (lc.enabled) {
              initialPoints = Math.floor(subtotal * (lc.pointsPerReal || 1))
            }
          } catch {}
        }
        customer = await prisma.customer.create({
          data: {
            phone: customerPhone || "",
            name: customerName,
            cpf: customerCpf?.replace(/\D/g, "") || null,
            address: customerComplement,
            cep: customerCep,
            establishmentId,
            totalOrders: 1,
            totalSpent: calculatedTotal,
            loyaltyPoints: initialPoints,
          },
        })
        customerId = customer.id
      }
    }

    // Create order with atomic orderNumber using raw SQL (works with Vercel Postgres pooling)
    const order = await prisma.$transaction(async (tx) => {
      // Atomic: get next number in a single query
      const result: any[] = await tx.$queryRawUnsafe(
        `SELECT COALESCE(MAX("orderNumber"), 0) + 1 as next FROM "Order" WHERE "establishmentId" = $1`,
        establishmentId
      )
      const orderNumber = Number(result[0]?.next || 1)

      return tx.order.create({
        data: {
          establishment: { connect: { id: establishmentId } },
          ...(customerId ? { customer: { connect: { id: customerId } } } : {}),
          customerName,
          customerPhone,
          customerAddress,
          orderType: orderType || "delivery",
          paymentMethod: isMesa ? "pending" : (paymentMethod || "online"),
          deliveryFee: deliveryFeeValue,
          items: typeof items === "string" ? items : JSON.stringify(items),
          total: calculatedTotal,
          notes,
          method: method || "site",
          trackingToken,
          status: initialStatus,
          ...(couponId ? { coupon: { connect: { id: couponId } } } : {}),
          orderNumber,
          tableNumber: tableNumber || null,
        },
      })
    })

    // Increment coupon usedCount
    if (couponId) {
      await prisma.coupon.update({
        where: { id: couponId },
        data: { usedCount: { increment: 1 } },
      }).catch(() => {})
    }

    let paymentLink = ""
    const paymentProvider = establishment.paymentProvider || "asaas"

    console.log("[Orders POST] paymentProvider:", paymentProvider, "| willCreatePayment:", paymentMethod === "asaas" || paymentMethod === "online" || paymentMethod === "pix" || paymentMethod === "card")

    if (paymentMethod === "asaas" || paymentMethod === "online" || paymentMethod === "pix" || paymentMethod === "card") {
      if (paymentProvider === "efi") {
        // Efi Pix payment
        if (!establishment.efiClientId || !establishment.efiClientSecret || !establishment.efiCertificate) {
          return NextResponse.json({ error: "Pagamento online configurado, mas a Efi não está Configure client ID, secret e certificado." }, { status: 400 })
        }
        try {
          const efiConfig = {
            clientId: establishment.efiClientId,
            clientSecret: establishment.efiClientSecret,
            certificate: establishment.efiCertificate,
            environment: (establishment.efiEnvironment || "sandbox") as "sandbox" | "production",
          }

          const itemNames = (Array.isArray(parsedItems) ? parsedItems : [])
            .map((i: any) => `${i.name} x${i.quantity}`)
            .join(", ")

          const txid = `flo${order.id.substring(0, 20)}${Date.now()}`.replace(/[^a-zA-Z0-9]/g, "").substring(0, 35)

          console.log("[Efi] Criando cobrança:", { txid, amount: order.total })

          const charge = await createEfiPixCharge(efiConfig, {
            amount: order.total,
            description: `Pedido #${order.orderNumber} - ${establishment.name} - ${itemNames}`.substring(0, 140),
            expiration: 3600,
            txid,
          })

          const pixQrCodeUrl = charge.location
            ? `https://pix.sejaefi.com.br/v2/${charge.location.split("/").pop()}`
            : null

          paymentLink = pixQrCodeUrl || `https://pix.sejaefi.com.br/v2/${charge.txid}`

          await prisma.order.update({
            where: { id: order.id },
            data: {
              paymentId: charge.txid,
              paymentLink,
              paymentStatus: "pending",
              status: "payment_pending",
            },
          })
        } catch (err: any) {
          console.error("[Efi] ERRO ao gerar pagamento:", err.message)
          await prisma.order.delete({ where: { id: order.id } }).catch(() => {})
          return NextResponse.json({ error: `Erro ao gerar pagamento: ${err.message}` }, { status: 500 })
        }
      } else {
        // Asaas payment (default)
        if (!establishment.asaasApiKey) {
          return NextResponse.json({ error: "Pagamento online configurado, mas a API Key do Asaas não está configurada. Configure em Configurações." }, { status: 400 })
        }
        try {
          const itemNames = (Array.isArray(parsedItems) ? parsedItems : [])
            .map((i: any) => `${i.name} x${i.quantity}`)
            .join(", ")

          console.log("[Asaas] Criando pagamento:", { customerName, customerPhone, customerCpf: customerCpf ? "***" : "VAZIO", value: order.total })

          const payment = await createPaymentLink({
            apiKey: establishment.asaasApiKey,
            customerName,
            customerPhone: customerPhone || "",
            customerCpf: customerCpf || "",
            value: order.total,
            description: `Pedido #${order.orderNumber} - ${establishment.name}`,
            billingType: "PIX",
          })

          paymentLink = payment.invoiceUrl

          await prisma.order.update({
            where: { id: order.id },
            data: {
              paymentId: payment.id,
              paymentLink: payment.invoiceUrl,
              paymentStatus: "pending",
              status: "payment_pending",
            },
          })
        } catch (err: any) {
          console.error("[Asaas] ERRO ao gerar pagamento:", err.message)
          // Deleta o pedido se o pagamento falhar
          await prisma.order.delete({ where: { id: order.id } }).catch(() => {})
          return NextResponse.json({ error: `Erro ao gerar pagamento: ${err.message}` }, { status: 500 })
        }
      }
    }

    console.log("[Orders POST] Resultado final - paymentLink:", paymentLink ? "SIM" : "NAO")

    const fullOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { establishment: true },
    })

    // Decrement stock for products
    const lowStockItems: { name: string; quantity: number; minQuantity: number }[] = []
    try {
      for (const item of parsedItems) {
        if (item.productId && item.productId !== "custom") {
          const product = await prisma.product.findUnique({ where: { id: item.productId } })

          // Direct sale: product linked to a stock item
          if (product?.stockItemId) {
            const stockItem = await prisma.stockItem.findUnique({ where: { id: product.stockItemId } })
            if (stockItem) {
              const newQty = stockItem.quantity - item.quantity
              await prisma.stockItem.update({
                where: { id: product.stockItemId },
                data: { quantity: newQty },
              })
              await prisma.stockMovement.create({
                data: {
                  type: "exit",
                  quantity: item.quantity,
                  notes: `Pedido ${order.id} - ${product.name}`,
                  itemId: product.stockItemId,
                },
              })
              if (stockItem.minQuantity > 0 && newQty <= stockItem.minQuantity) {
                lowStockItems.push({ name: stockItem.name, quantity: newQty, minQuantity: stockItem.minQuantity })
              }
            }
          }

          // BOM links: product made of multiple stock items
          const links = await prisma.productStockLink.findMany({ where: { productId: item.productId } })
          for (const link of links) {
            const deduction = link.quantity * item.quantity
            const stockItem = await prisma.stockItem.findUnique({ where: { id: link.stockItemId } })
            if (stockItem) {
              const newQty = stockItem.quantity - deduction
              await prisma.stockItem.update({
                where: { id: link.stockItemId },
                data: { quantity: newQty },
              })
              await prisma.stockMovement.create({
                data: {
                  type: "exit",
                  quantity: deduction,
                  notes: `Pedido ${order.id}`,
                  itemId: link.stockItemId,
                },
              })
              if (stockItem.minQuantity > 0 && newQty <= stockItem.minQuantity && !lowStockItems.find((l) => l.name === stockItem.name)) {
                lowStockItems.push({ name: stockItem.name, quantity: newQty, minQuantity: stockItem.minQuantity })
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("Error decrementing stock:", e)
    }

    return NextResponse.json({ order: fullOrder, paymentLink, trackingUrl: `/pedido/${trackingToken}`, lowStockItems })
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
