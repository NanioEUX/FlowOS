import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createPaymentLink } from "@/lib/integrations/asaas"
import { createInterPixCharge, generateInterTxId } from "@/lib/integrations/inter"
import { computeOrderItemCosts } from "@/lib/cmv"
import { convertQuantity } from "@/lib/units"

import crypto from "crypto"

// Orders GET: 5s cache (frequent updates but reduces DB load)
export const revalidate = 5

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { establishmentId, customerName, customerPhone, customerAddress, customerComplement, customerCep, customerCpf, items, total, deliveryFee, notes, paymentMethod, method, orderType, couponId, useLoyalty, loyaltyPointsUsed, loyaltyDiscount, firstPurchaseDiscount, couponDiscount, tableNumber, waiterName, changeFor, isScheduled, deliveryDate, customerLat, customerLng } = body

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

    // Parse items and calculate totals server-side (never trust client-sent total)
    const parsedItems = typeof items === "string" ? JSON.parse(items) : items
    const subtotal = parsedItems.reduce((s: number, i: any) => s + i.price * i.quantity, 0)
    const deliveryFeeValue = deliveryFee ? (typeof deliveryFee === "string" ? parseFloat(deliveryFee) : deliveryFee) : 0
    const loyaltyDiscountValue = loyaltyDiscount ? (typeof loyaltyDiscount === "string" ? parseFloat(loyaltyDiscount) : loyaltyDiscount) : 0
    const couponDiscountValue = couponDiscount ? (typeof couponDiscount === "string" ? parseFloat(couponDiscount) : couponDiscount) : 0
    const firstPurchaseDiscountValue = firstPurchaseDiscount ? (typeof firstPurchaseDiscount === "string" ? parseFloat(firstPurchaseDiscount) : firstPurchaseDiscount) : 0
    let calculatedTotal = Math.max(0, subtotal + deliveryFeeValue - loyaltyDiscountValue - couponDiscountValue - firstPurchaseDiscountValue)
    console.log("[Orders POST] totals:", { subtotal, deliveryFeeValue, loyaltyDiscountValue, couponDiscountValue, firstPurchaseDiscountValue, calculatedTotal })

    const isPayOnDelivery =
      paymentMethod &&
      ["cash", "delivery", "pickup", "card_delivery", "card_pickup"].includes(paymentMethod)

    // Regra: cliente bloqueado por excesso de cancelamentos (config por
    // estabelecimento: cancellationBlockEnabled). Se bloqueado, só permite
    // pagamento online (PIX/Cartão).
    if (isPayOnDelivery && customerPhone) {
      const blockedCustomer = await prisma.customer.findFirst({
        where: {
          phone: customerPhone,
          establishmentId,
          blockedUntil: { gt: new Date() },
        },
        select: { blockedUntil: true },
      })
      if (blockedCustomer) {
        const untilStr = new Date(blockedCustomer.blockedUntil!).toLocaleDateString("pt-BR")
        return NextResponse.json(
          {
            error: `Você está com pagamento na entrega bloqueado até ${untilStr} por excesso de cancelamentos. Por favor, finalize este pagamento online.`,
            code: "blocked_until",
          },
          { status: 400 }
        )
      }
    }

    // Regra: limite de valor para pagar na entrega
    if (
      isPayOnDelivery &&
      establishment.maxPayOnDeliveryAmount != null &&
      calculatedTotal > establishment.maxPayOnDeliveryAmount
    ) {
      return NextResponse.json(
        {
          error: `Pedidos acima de R$ ${establishment.maxPayOnDeliveryAmount.toFixed(2).replace(".", ",")} só podem ser pagos online.`,
          code: "pay_on_delivery_limit_exceeded",
        },
        { status: 400 }
      )
    }

    // Regra: bloqueia novo pedido na entrega se já existe um em andamento
    if (
      isPayOnDelivery &&
      establishment.blockConcurrentPayOnDelivery &&
      customerPhone
    ) {
      const openDeliveryOrder = await prisma.order.findFirst({
        where: {
          establishmentId,
          customerPhone,
          status: { in: ["pending", "confirmed", "preparing", "ready"] },
          paymentMethod: { in: ["cash", "delivery", "pickup", "card_delivery", "card_pickup"] },
        },
        select: { id: true, orderNumber: true },
      })
      if (openDeliveryOrder) {
        return NextResponse.json(
          {
            error: `Você tem o pedido #${openDeliveryOrder.orderNumber} com pagamento na entrega em andamento. Pague online para fazer um novo pedido.`,
            code: "concurrent_pay_on_delivery_blocked",
          },
          { status: 400 }
        )
      }
    }

    const trackingToken = crypto.randomBytes(12).toString("hex")

    // For presencial mesa orders: status=new, no payment at creation
    const isMesa = orderType === "presencial" && tableNumber
    const initialStatus = body.status || (isMesa ? "new" : "pending")

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
        // Calculate real totalSpent from delivered orders (excluding this new order)
        const deliveredAgg = await prisma.order.aggregate({
          where: {
            customerId: customer.id,
            establishmentId,
            status: { in: ["delivered", "confirmed", "preparing", "ready", "dispatched", "out_for_delivery"] },
          },
          _sum: { total: true },
          _count: true,
        })
        const deliveredTotal = (deliveredAgg._sum.total || 0) + calculatedTotal
        const isFirstOrder = deliveredAgg._count === 0

        // Bônus primeira compra (só se WhatsApp verificado)
        // NOTA: O desconto de primeira compra já é subtraído pelo client via
        // firstPurchaseDiscount no body (linha 39). Não aplicar novamente aqui
        // para evitar double-subtract.
        let firstPurchaseBonusValue = 0
        if (isFirstOrder && establishment.firstPurchaseEnabled && customer.whatsappVerified) {
          firstPurchaseBonusValue = establishment.firstPurchaseBonus || 0
        }

        let pointsDelta = 0
        if (useLoyalty && loyaltyPointsUsed > 0) {
          pointsDelta -= loyaltyPointsUsed
        }
        // Bônus cash da primeira compra (somado aos pontos ganhos neste pedido)
        if (firstPurchaseBonusValue > 0) {
          pointsDelta += firstPurchaseBonusValue
        }
        if (establishment.loyaltyConfig) {
          try {
            const lc = JSON.parse(establishment.loyaltyConfig)
            if (lc.enabled) {
              let basePoints = Math.floor(subtotal * (lc.pointsPerReal || 1))
              // Apply tier multiplier based on real delivered totals
              let tierMultiplier = 1
              if (establishment.tierConfig) {
                try {
                  const tc = JSON.parse(establishment.tierConfig)
                  if (tc.enabled && tc.tiers?.length) {
                    const sortedTiers = [...tc.tiers].sort((a: any, b: any) => (b.minSpent || 0) - (a.minSpent || 0))
                    const currentTier = sortedTiers.find((t: any) => deliveredTotal >= (t.minSpent || 0))
                    tierMultiplier = currentTier?.multiplier || 1
                  }
                } catch {}
              }
              pointsDelta += Math.floor(basePoints * tierMultiplier)
            }
          } catch {}
        }
        let newTier = customer.tier || "bronze"
        if (establishment.tierConfig) {
          try {
            const tc = JSON.parse(establishment.tierConfig)
            if (tc.enabled && tc.tiers?.length) {
              const sortedTiers = [...tc.tiers].sort((a: any, b: any) => (b.minSpent || 0) - (a.minSpent || 0))
              const matchedTier = sortedTiers.find((t: any) => deliveredTotal >= (t.minSpent || 0))
              if (matchedTier) newTier = matchedTier.name.toLowerCase()
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
            tier: newTier,
          },
        })
      } else {
        // Create new customer
        let initialPoints = 0
        let initialTier = "bronze"
        if (establishment.loyaltyConfig) {
          try {
            const lc = JSON.parse(establishment.loyaltyConfig)
            if (lc.enabled) {
              initialPoints = Math.floor(subtotal * (lc.pointsPerReal || 1))
            }
          } catch {}
        }
        // Bônus primeira compra para cliente novo (verificado via WhatsApp)
        if (establishment.firstPurchaseEnabled) {
          if (establishment.firstPurchaseDiscount) {
            calculatedTotal = Math.max(0, calculatedTotal - establishment.firstPurchaseDiscount)
          }
          if (establishment.firstPurchaseBonus) {
            initialPoints += establishment.firstPurchaseBonus
          }
        }
        if (establishment.tierConfig) {
          try {
            const tc = JSON.parse(establishment.tierConfig)
            if (tc.enabled && tc.tiers?.length) {
              const sortedTiers = [...tc.tiers].sort((a: any, b: any) => (b.minSpent || 0) - (a.minSpent || 0))
              const matchedTier = sortedTiers.find((t: any) => calculatedTotal >= (t.minSpent || 0))
              if (matchedTier) initialTier = matchedTier.name.toLowerCase()
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
            tier: initialTier,
            // Marca como verificado se tinha código verificado antes do pedido (não é estritamente necessário aqui)
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
          customerLat: customerLat ? Number(customerLat) : null,
          customerLng: customerLng ? Number(customerLng) : null,
          orderType: orderType || "delivery",
          paymentMethod: isMesa ? "pending" : (paymentMethod || "online"),
          ...(changeFor && Number(changeFor) > 0 ? { changeFor: Number(changeFor) } : {}),
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
          isScheduled: !!isScheduled,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          ...(orderType === "delivery" && (method || "site") !== "ifood" && {
            deliveryCode: String(Math.floor(1000 + Math.random() * 9000)),
          }),
        },
      })
    })

    // Snapshot CMV (custo de mercadoria vendida) — calculado a partir dos
    // insumos vinculados via ficha técnica (ProductStockLink). Itens sem
    // ficha técnica ficam com custo 0.
    try {
      const { costs } = await computeOrderItemCosts(parsedItems)
      if (costs.length > 0) {
        await prisma.orderItemCost.createMany({
          data: costs.map((c) => ({
            orderId: order.id,
            productId: c.productId,
            productName: c.productName,
            quantity: c.quantity,
            unitCostCents: c.unitCostCents,
            totalCostCents: c.totalCostCents,
          })),
        })
      }
    } catch (e) {
      console.error("[Orders POST] Falha ao gravar CMV snapshot:", e)
    }

    // Increment coupon timesUsed
    if (couponId) {
      await prisma.coupon.update({
        where: { id: couponId },
        data: { timesUsed: { increment: 1 } },
      }).catch(() => {})
    }

    let paymentLink = ""
    const isOnlinePayment =
      paymentMethod === "asaas" ||
      paymentMethod === "online" ||
      paymentMethod === "pix" ||
      paymentMethod === "card"
    // "card_delivery" / "card_pickup" = cartão NA MÁQUINA do estabelecimento,
    // não no Asaas. Não deve gerar cobrança online.
    const isPayOnDeliveryCard =
      paymentMethod === "card_delivery" || paymentMethod === "card_pickup"
    console.log("[Orders POST] willCreatePayment:", isOnlinePayment, "| provider:", establishment.paymentProvider, "| method:", paymentMethod)

    if (isOnlinePayment) {
      const useInter = establishment.paymentProvider === "inter" && paymentMethod === "pix"
      const useAsaas = !useInter

      if (useInter) {
        // Inter PIX payment (0% fee)
        if (!establishment.interClientId || !establishment.interClientSecret || !establishment.interCertificate || !establishment.interPixKey) {
          return NextResponse.json({ error: "Pagamento PIX configurado, mas o Inter não está configurado. Configure client ID, secret, certificado e chave PIX." }, { status: 400 })
        }
        try {
          const config = {
            clientId: establishment.interClientId,
            clientSecret: establishment.interClientSecret,
            certificate: establishment.interCertificate,
            certificatePassword: establishment.interCertificatePassword || "",
          }
          const txid = generateInterTxId(order.id, order.orderNumber ?? 0)
          const description = `Pedido #${order.orderNumber} - ${establishment.name}`

          console.log("[Inter] Criando cobrança PIX:", { txid, value: order.total })

          await createInterPixCharge(config, {
            value: order.total,
            txid,
            description,
            pixKey: establishment.interPixKey,
          })

          await prisma.order.update({
            where: { id: order.id },
            data: {
              paymentId: `inter_${txid}`,
              paymentLink: `inter://${txid}`,
              paymentStatus: "pending",
              status: "payment_pending",
            },
          })
        } catch (err: any) {
          console.error("[Inter] ERRO ao gerar pagamento:", err.message)
          await prisma.order.delete({ where: { id: order.id } }).catch(() => {})
          return NextResponse.json({ error: `Erro ao gerar pagamento: ${err.message}` }, { status: 500 })
        }
      }

      if (useAsaas) {
        // Asaas payment (default) - PIX or Card
        if (!establishment.asaasApiKey) {
          return NextResponse.json({ error: "Pagamento online configurado, mas a API Key do Asaas não está configurada. Configure em Configurações." }, { status: 400 })
        }
        try {
          console.log("[Asaas] Criando pagamento:", { customerName, customerPhone, customerCpf: customerCpf ? "***" : "VAZIO", value: order.total })

          const billingType = paymentMethod === "card" ? "UNDEFINED" : "PIX"
          const payment = await createPaymentLink({
            apiKey: establishment.asaasApiKey,
            customerName,
            customerPhone: customerPhone || "",
            customerCpf: customerCpf || "",
            value: order.total,
            description: `Pedido #${order.orderNumber} - ${establishment.name}`,
            billingType: billingType as any,
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
            const stockItem = await prisma.stockItem.findUnique({ where: { id: link.stockItemId } })
            if (stockItem) {
              // Converte quantidade da unidade do link pra unidade do StockItem
              const linkUnit = link.unit || "un"
              const deductionInLinkUnit = link.quantity * item.quantity
              const deductionInStockUnit = convertQuantity(deductionInLinkUnit, linkUnit, stockItem.unit) ?? deductionInLinkUnit
              const newQty = stockItem.quantity - deductionInStockUnit
              await prisma.stockItem.update({
                where: { id: link.stockItemId },
                data: { quantity: newQty },
              })
              await prisma.stockMovement.create({
                data: {
                  type: "exit",
                  quantity: deductionInStockUnit,
                  notes: `Pedido ${order.id} - ${deductionInLinkUnit}${linkUnit}`,
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
  // Regras para mostrar um pedido no painel de pedidos:
  // - Pedidos fora do cardápio digital (iFood, WhatsApp, manual) → sempre visíveis.
  // - Pedidos do cardápio digital com pagamento NA ENTREGA (cash/card na
  //   máquina) → sempre visíveis (entram em produção imediatamente).
  // - Pedidos do cardápio digital com pagamento ONLINE (Asaas/Inter) →
  //   aparecem após paymentStatus = "paid" OU se o pedido já foi cancelado
  //   (para que o painel de "Cancelados" continue exibindo-os).
  // Só escondemos quando TODAS as condições abaixo forem verdadeiras:
  //   method === "site" AND paymentMethod online AND paymentStatus !== "paid"
  //   AND status !== "cancelled"
  where.AND = [
    {
      OR: [
        { method: { not: "site" } },
        {
          paymentMethod: {
            in: [
              "cash",
              "delivery",
              "pickup",
              "card_delivery",
              "card_pickup",
            ],
          },
        },
        { paymentStatus: "paid" },
        { status: "cancelled" },
      ],
    },
  ]

  const orders = await prisma.order.findMany({
    where,
    include: {
      establishment: { select: { name: true, phone: true, slug: true } },
      customer: { select: { id: true, name: true, phone: true, cancellationCount: true, blockedUntil: true, needsHuman: true, needsHumanAt: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(orders)
}
