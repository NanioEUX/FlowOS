import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireEstablishment } from "@/lib/require-auth"
import { createInterPixCharge, generateInterTxId } from "@/lib/integrations/inter"
import { computeOrderItemCosts } from "@/lib/cmv"
import { convertQuantity } from "@/lib/units"
import { deductOrderStock, restoreOrderStock } from "@/lib/stock"
import {
  buildOrderInput,
  computeFirstPurchaseBonus,
  computeLoyaltyRedemption,
  OrderInputError,
} from "@/lib/order-input"

import crypto from "crypto"
import { getRequestId, logger } from "@/lib/logger"

/**
 * Build split rules for Pagar.me V5
 * SaaS takes commission %, establishment gets the rest
 * Establishment absorbs processing fees (charge_processing_fee: true)
 */
function buildSplitRules(
  totalAmount: number,
  establishmentRecipientId: string | null | undefined,
  saasCommissionPercentage: number,
  saasRecipientId?: string | null,
  pagarmeConfig?: { feePercentage?: number; saasProfitPercentage?: number }
) {
  if (!establishmentRecipientId) return undefined

  if (!saasRecipientId) {
    logger.warn("orders", "saasRecipientId não configurado — split ignorado")
    return undefined
  }

  // SaaS profit only (Pagar.me fee is charged automatically by Pagar.me)
  const saasProfit = pagarmeConfig?.saasProfitPercentage || 0

  // If SaaS profit is 0, no split needed - establishment gets 100% (Pagar.me deducts its fee automatically)
  if (saasProfit <= 0) {
    logger.info("orders", "lucro do SaaS é 0 — split não configurado")
    return undefined
  }

  // Pagar.me V5 requires integer percentages (no decimals)
  const saasPercentage = Math.max(1, Math.round(saasProfit))
  const establishmentPercentage = 100 - saasPercentage

  logger.info("orders", "regras de split definidas", { saasPercentage, establishmentPercentage, hasSaasRecipient: !!saasRecipientId, hasEstablishmentRecipient: !!establishmentRecipientId })

  return [
    {
      recipientId: saasRecipientId,
      type: "percentage" as const,
      amount: saasPercentage,
      options: {
        chargeProcessingFee: true,
        chargeRemainderFee: true,
        liable: true,
      },
    },
    {
      recipientId: establishmentRecipientId,
      type: "percentage" as const,
      amount: establishmentPercentage,
      options: {
        chargeProcessingFee: false,
        chargeRemainderFee: false,
        liable: false,
      },
    },
  ]
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  // escopo do catch (o establishmentId só é conhecido depois do buildOrderInput)
  let estId: string | undefined
  try {
    const body = await req.json()

    // Servidor é a única fonte de preço/status/desconto/cupom/fidelidade
    // (F6B-001…004, F6B-013, F6B-018). `total` do body é ignorado.
    const input = await buildOrderInput(req, body)
    estId = input.establishmentId
    const {
      establishment,
      establishmentId,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      customerComplement,
      customerCep,
      customerCpf,
      customerLat,
      customerLng,
      orderType,
      paymentMethod,
      method,
      items,
      itemsJson,
      subtotal,
      deliveryFee: deliveryFeeValue,
      notes,
      changeFor,
      tableNumber,
      waiterName,
      isScheduled,
      deliveryDate,
      couponId,
      wantsLoyalty,
      isPayOnDelivery,
      isOnlinePaymentMethod,
      isMesa,
      initialStatus,
    } = input

    logger.info("orders-post", "parâmetros do pedido", { requestId, paymentMethod, orderType, method, status: initialStatus })
    logger.info("orders-post", "totais calculados no servidor", { requestId, subtotal, deliveryFee: deliveryFeeValue })

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
    logger.info("orders-post", "decisão de auto-aceite", { requestId, autoAcceptOrders: establishment.autoAcceptOrders, paymentMethod, isOnlinePaymentMethod, isMesa, status: initialStatus })

    // Find or create customer - CPF is unique identifier
    let customerId: string | undefined
    let customerTier: string | null = null
    let firstPurchaseBonusValue = 0
    let loyaltyDiscountValue = 0
    let loyaltyPointsUsedValue = 0
    let calculatedTotal = subtotal + deliveryFeeValue
    let customer: any = null
    // Persistência do cliente adiada até após a validação do total (limite pay-on-delivery)
    let pendingCustomerUpdate: any = null
    let pendingCustomerCreate: any = null

    if (customerPhone || customerCpf) {
      // 1. Try to find by CPF first (unique per person)
      if (customerCpf) {
        const cpfDigits = customerCpf.replace(/\D/g, "")
        if (cpfDigits.length === 11) {
          customer = await prisma.customer.findFirst({
            where: { cpf: cpfDigits, establishmentId },
          })
        }
      }

      // 2. If no CPF match, try by phone
      if (!customer && customerPhone) {
        customer = await prisma.customer.findFirst({
          where: { phone: customerPhone, establishmentId },
        })
      }

      if (customer) {
        customerId = customer.id

        // Fidelidade recalculada no servidor (F6B-002) — ignora valores do body
        const loyalty = computeLoyaltyRedemption({
          customer,
          loyaltyConfigJson: establishment.loyaltyConfig,
          wantsLoyalty,
          subtotal,
        })
        loyaltyDiscountValue = loyalty.discount
        loyaltyPointsUsedValue = loyalty.pointsUsed

        // Bônus primeira compra (só cliente existente verificado no WhatsApp)
        const firstPurchase = computeFirstPurchaseBonus({ customer, establishment })
        firstPurchaseBonusValue = firstPurchase.bonusPoints

        calculatedTotal = Math.max(0, subtotal + deliveryFeeValue - loyaltyDiscountValue - firstPurchase.discount)

        let pointsDelta = 0
        if (loyaltyPointsUsedValue > 0) {
          pointsDelta -= loyaltyPointsUsedValue
        }
        // Bônus cash da primeira compra (somado aos pontos ganhos neste pedido)
        if (firstPurchaseBonusValue > 0) {
          pointsDelta += firstPurchaseBonusValue
        }
        if (establishment.loyaltyConfig) {
          try {
            const lc = JSON.parse(establishment.loyaltyConfig)
            if (lc.enabled) {
              let basePoints = Math.floor((subtotal - loyaltyDiscountValue) * (lc.cashbackPercent || lc.pointsPerReal || 1))
              // Apply tier multiplier based on order count within period
              let tierMultiplier = 1
              let ordersInPeriod = customer.totalOrders || 0
              if (establishment.tierConfig) {
                try {
                  const tc = JSON.parse(establishment.tierConfig)
                  // Migrate old minSpent → minOrders
                  if (tc.tiers?.length && tc.tiers[0]?.minSpent !== undefined && tc.tiers[0]?.minOrders === undefined) {
                    tc.tiers = tc.tiers.map((t: any) => ({ ...t, minOrders: t.minSpent ?? 0 }))
                  }
                  if (tc.enabled && tc.tiers?.length) {
                    // Count orders in period
                    const periodDays = tc.periodDays || 90
                    const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)
                    const countResult = await prisma.order.aggregate({
                      _count: { id: true },
                      where: {
                        customerId: customer.id,
                        status: { not: "cancelled" },
                        createdAt: { gte: periodStart },
                      },
                    })
                    ordersInPeriod = countResult._count.id || 0
                    const sortedTiers = [...tc.tiers].sort((a: any, b: any) => (b.minOrders || 0) - (a.minOrders || 0))
                    const currentTier = sortedTiers.find((t: any) => ordersInPeriod >= (t.minOrders || 0))
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
            // Migrate old minSpent → minOrders
            if (tc.tiers?.length && tc.tiers[0]?.minSpent !== undefined && tc.tiers[0]?.minOrders === undefined) {
              tc.tiers = tc.tiers.map((t: any) => ({ ...t, minOrders: t.minSpent ?? 0 }))
            }
            if (tc.enabled && tc.tiers?.length) {
              const periodDays = tc.periodDays || 90
              const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)
              const countResult = await prisma.order.aggregate({
                _count: { id: true },
                where: {
                  customerId: customer.id,
                  status: { not: "cancelled" },
                  createdAt: { gte: periodStart },
                },
              })
              const ordersInPeriod = countResult._count.id || 0
              const sortedTiers = [...tc.tiers].sort((a: any, b: any) => (b.minOrders || 0) - (a.minOrders || 0))
              const matchedTier = sortedTiers.find((t: any) => ordersInPeriod >= (t.minOrders || 0))
              if (matchedTier) newTier = matchedTier.name.toLowerCase()
            }
          } catch {}
        }
        customerTier = newTier
        pendingCustomerUpdate = {
          where: { id: customer.id },
          data: {
            ...(customerPhone && { phone: customerPhone }),
            ...(customerName && { name: customerName }),
            ...(customerEmail && { email: customerEmail }),
            ...(customerCpf?.replace(/\D/g, "")?.length === 11 && { cpf: customerCpf.replace(/\D/g, "") }),
            address: customerComplement || customer.address,
            cep: customerCep || customer.cep,
            totalOrders: { increment: 1 },
            totalSpent: { increment: calculatedTotal },
            ...(loyaltyPointsUsedValue !== 0 || pointsDelta !== 0
              ? { loyaltyPoints: { increment: pointsDelta } }
              : {}),
            tier: newTier,
          },
        }
      } else {
        // Create new customer — sem desconto de primeira compra (exige
        // whatsappVerified, que cliente novo ainda não tem).
        // Criado APÓS a validação do limite pay-on-delivery.
        let initialPoints = 0
        let initialTier = "bronze"
        if (establishment.loyaltyConfig) {
          try {
            const lc = JSON.parse(establishment.loyaltyConfig)
            if (lc.enabled) {
              initialPoints = Math.floor(subtotal * (lc.cashbackPercent || lc.pointsPerReal || 1))
            }
          } catch {}
        }
        if (establishment.tierConfig) {
          try {
            const tc = JSON.parse(establishment.tierConfig)
            // Migrate old minSpent → minOrders
            if (tc.tiers?.length && tc.tiers[0]?.minSpent !== undefined && tc.tiers[0]?.minOrders === undefined) {
              tc.tiers = tc.tiers.map((t: any) => ({ ...t, minOrders: t.minSpent ?? 0 }))
            }
            if (tc.enabled && tc.tiers?.length) {
              const sortedTiers = [...tc.tiers].sort((a: any, b: any) => (b.minOrders || 0) - (a.minOrders || 0))
              const matchedTier = sortedTiers.find((t: any) => 1 >= (t.minOrders || 0))
              if (matchedTier) initialTier = matchedTier.name.toLowerCase()
            }
          } catch {}
        }
        customerTier = initialTier
        pendingCustomerCreate = {
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
        }
      }
    }

    // Regra: limite de valor para pagar na entrega (usa total final do servidor)
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

    // Persiste cliente só após validações do total
    if (pendingCustomerUpdate) {
      await prisma.customer.update(pendingCustomerUpdate)
    }
    if (pendingCustomerCreate) {
      customer = await prisma.customer.create({ data: pendingCustomerCreate })
      customerId = customer.id
    }

    // Calculate cashbackEarned for this order
    let cashbackEarnedValue = 0
    try {
      const parsedLoyalty = establishment.loyaltyConfig ? JSON.parse(establishment.loyaltyConfig) : null
      const parsedTierConfig = establishment.tierConfig ? JSON.parse(establishment.tierConfig) : null
      if (parsedLoyalty?.enabled && (parsedLoyalty?.cashbackPercent || parsedLoyalty?.pointsPerReal)) {
        const base = (subtotal - loyaltyDiscountValue) * (parsedLoyalty.cashbackPercent || parsedLoyalty.pointsPerReal || 0)
        let tierMultiplier = 1
        if (parsedTierConfig?.enabled && parsedTierConfig?.tiers?.length && customerTier) {
          const currentTier = parsedTierConfig.tiers.find((t: any) => t.name?.toLowerCase() === customerTier?.toLowerCase())
          tierMultiplier = currentTier?.multiplier || 1
        }
        cashbackEarnedValue = Math.floor(base * tierMultiplier)
      }
    } catch {}

    // Create order with atomic orderNumber + stock decrement in a single transaction
    const lowStockItems: { name: string; quantity: number; minQuantity: number }[] = []
    // F5A-026: MAX+1 lido sem trava — em corrida o segundo insert estoura o
    // @@unique([establishmentId, orderNumber]) com P2002; refaz o número até 3×.
    let order: any = null
    for (let orderAttempt = 0; orderAttempt < 3 && !order; orderAttempt++) {
      try {
        order = await prisma.$transaction(async (tx) => {
      // Atomic: get next number in a single query
      const result: any[] = await tx.$queryRawUnsafe(
        `SELECT COALESCE(MAX("orderNumber"), 0) + 1 as next FROM "Order" WHERE "establishmentId" = $1`,
        establishmentId
      )
      const orderNumber = Number(result[0]?.next || 1)

      const createdOrder = await tx.order.create({
        data: {
          establishment: { connect: { id: establishmentId } },
          ...(customerId ? { customer: { connect: { id: customerId } } } : {}),
          customerName,
          customerPhone,
          customerAddress,
          customerLat: customerLat != null ? Number(customerLat) : null,
          customerLng: customerLng != null ? Number(customerLng) : null,
          orderType,
          paymentMethod: isMesa ? "pending" : paymentMethod,
          ...(changeFor && changeFor > 0 ? { changeFor } : {}),
          deliveryFee: deliveryFeeValue,
          items: itemsJson,
          total: calculatedTotal,
          notes,
          method,
          trackingToken,
          status: initialStatus,
          ...(couponId ? { coupon: { connect: { id: couponId } } } : {}),
          orderNumber,
          tableNumber: tableNumber || null,
          isScheduled,
          deliveryDate: deliveryDate || null,
          ...((orderType === "delivery" || orderType === "pickup") && method !== "ifood" && {
            // F5B-020: nunca derivar do telefone do cliente (4 dígitos previsíveis)
            deliveryCode: String(crypto.randomInt(1000, 10000)),
          }),
          cashbackEarned: cashbackEarnedValue,
          loyaltyPointsUsed: loyaltyPointsUsedValue,
          firstPurchaseBonus: firstPurchaseBonusValue,
        },
      })

      // Decrement stock atomically — if this fails, the entire order rolls back
      // Now includes additional options with consumesStock=true
      const stockResult = await deductOrderStock(tx, items, createdOrder.id, establishmentId, false)
      lowStockItems.push(...stockResult)

      return createdOrder
        })
      } catch (e: any) {
        if (e?.code !== "P2002") throw e
        lowStockItems.length = 0
      }
    }
    if (!order) {
      throw new Error("Não foi possível gerar um número único para o pedido. Tente novamente.")
    }

    // Snapshot CMV (custo de mercadoria vendida) — calculado a partir dos
    // insumos vinculados via ficha técnica (ProductStockLink). Itens sem
    // ficha técnica ficam com custo 0.
    try {
      const { costs } = await computeOrderItemCosts(items)
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
    } catch (e: any) {
      logger.error("orders-post", "falha ao gravar snapshot de CMV", { requestId, establishmentId: estId, error: e?.message })
    }

    // Increment coupon timesUsed
    if (couponId) {
      await prisma.coupon.update({
        where: { id: couponId },
        data: { timesUsed: { increment: 1 } },
      }).catch(() => {})
    }

    let paymentLink = ""
    let pixPayload = ""
    const isOnlinePayment =
      paymentMethod === "asaas" ||
      paymentMethod === "online" ||
      paymentMethod === "pix" ||
      paymentMethod === "card"
    // "card_delivery" / "card_pickup" = cartão NA MÁQUINA do estabelecimento,
    // não no Asaas. Não deve gerar cobrança online.
    const isPayOnDeliveryCard =
      paymentMethod === "card_delivery" || paymentMethod === "card_pickup"
    logger.info("orders-post", "decisão de cobrança online", { requestId, willCreatePayment: isOnlinePayment, provider: establishment.paymentProvider, paymentMethod })

    if (isOnlinePayment) {
      const useInter = establishment.paymentProvider === "inter" && paymentMethod === "pix"
      const usePagarme = !useInter

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

          logger.info("orders-post", "criando cobrança PIX no Inter", { requestId, establishmentId: estId, orderId: order?.id, txid, value: order?.total })

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
          logger.error("orders-post", "erro ao gerar pagamento Inter", { requestId, establishmentId: estId, orderId: order?.id, error: err?.message })
          // F5A-009: o pedido já debitou estoque na transação de criação —
          // apagar sem estorno inflava o estoque a cada falha de PSP.
          await prisma
            .$transaction(async (tx) => {
              await restoreOrderStock(tx, order.items, order.id, order.establishmentId)
              await tx.order.delete({ where: { id: order.id } })
            })
            .catch(() => {})
          return NextResponse.json({ error: `Erro ao gerar pagamento: ${err.message}` }, { status: 500 })
        }
      }

      if (usePagarme) {
        // Pagar.me payment - PIX or Card
        // API Key comes from global config (admin SaaS), not from establishment
        const { getPagarmeConfig } = await import("@/lib/pagarme-config")
        const pagarmeConfig = await getPagarmeConfig()
        const pagarmeApiKey = pagarmeConfig.apiKey
        // F4A-014: prefixo da API key NUNCA no log
        logger.info("orders-post", "chave do Pagar.me carregada", {
          requestId,
          configured: !!pagarmeApiKey,
        })
        if (!pagarmeApiKey) {
          return NextResponse.json({ error: "Pagamento Pagar.me não configurado no servidor. Contate o administrador." }, { status: 400 })
        }
        try {
          logger.info("orders-post", "criando pagamento Pagar.me", {
            requestId,
            establishmentId: estId,
            orderId: order?.id,
            value: order?.total,
          })

          const { createPagarmeCustomer, createPixTransaction } = await import("@/lib/integrations/pagarme")
          
          // F4A-014: CPF/telefone/email do cliente não vão para o log
          logger.info("orders-post", "dados do cliente enviados ao gateway (redigido)", {
            requestId,
            establishmentId: estId,
            orderId: order?.id,
            hasCpf: !!customerCpf,
            hasEmail: !!customerEmail,
            hasPhone: !!customerPhone,
          })
          
          // Create customer first
          const customer = await createPagarmeCustomer({
            apiKey: pagarmeApiKey,
            name: customerName,
            email: customerEmail || `${(customerPhone || "").replace(/\D/g, "")}@pedidoflow.com`,
            phone: customerPhone || "",
            document: customerCpf || "",
          })
          
          const billingType = paymentMethod === "card" ? "card" : "pix"
          
          if (billingType === "pix") {
            // Sandbox PIX simulator doesn't support split — skip it in test mode
            const isSandbox = pagarmeApiKey.startsWith("sk_test_")
            const splitRules = isSandbox ? undefined : buildSplitRules(
              order.total,
              establishment.pagarmeSplitReceiverId,
              establishment.saasCommissionPercentage || 10,
              pagarmeConfig.saasRecipientId,
              pagarmeConfig
            )
            if (isSandbox && establishment.pagarmeSplitReceiverId) {
              logger.info("orders-post", "sandbox do Pagar.me detectado — split desabilitado no PIX", { requestId, establishmentId: estId, orderId: order?.id })
            }

            let pixPayment
            try {
              pixPayment = await createPixTransaction({
                apiKey: pagarmeApiKey,
                customerId: customer.id,
                amount: order.total,
                description: `Pedido #${order.orderNumber} - ${establishment.name}`,
                orderId: order.id,
                splitRules,
              })
            } catch (splitErr: any) {
              // Fallback: retry without split if it still fails
              if (splitRules) {
                logger.warn("orders-post", "split do Pagar.me falhou — tentando sem split", {
                requestId,
                establishmentId: estId,
                orderId: order?.id,
                error: splitErr?.message,
              })
                pixPayment = await createPixTransaction({
                  apiKey: pagarmeApiKey,
                  customerId: customer.id,
                  amount: order.total,
                  description: `Pedido #${order.orderNumber} - ${establishment.name}`,
                  orderId: order.id,
                })
              } else {
                throw splitErr
              }
            }
            
            const charge = pixPayment.charges?.[0]
            const tx = charge?.last_transaction
            const qrCodeUrl = tx?.qr_code_url || charge?.qr_code_url || ""
            
            // Fetch QR code image if URL available
            if (qrCodeUrl) {
              try {
                const qrRes = await fetch(qrCodeUrl)
                if (qrRes.ok) {
                  const qrBuffer = await qrRes.arrayBuffer()
                  const qrBase64 = Buffer.from(qrBuffer).toString("base64")
                  paymentLink = `data:image/png;base64,${qrBase64}`
                }
              } catch (e: any) {
                logger.error("orders-post", "erro ao baixar QR code do Pagar.me", { requestId, establishmentId: estId, orderId: order?.id, error: e?.message })
                paymentLink = qrCodeUrl
              }
            }
            
            logger.info("orders-post", "QR Code do Pagar.me", { requestId, establishmentId: estId, orderId: order?.id, hasQrCode: !!qrCodeUrl })
            
            pixPayload = (tx as any)?.qr_code || ""
            
            await prisma.order.update({
              where: { id: order.id },
              data: {
                paymentId: pixPayment.id,
                paymentLink: paymentLink,
                pixPayload: pixPayload || "",
                paymentStatus: "pending",
                status: "payment_pending",
              },
            })
          } else {
            // Card payment - will be processed in the card endpoint
            await prisma.order.update({
              where: { id: order.id },
              data: {
                paymentStatus: "pending",
                status: "payment_pending",
              },
            })
          }
        } catch (err: any) {
          logger.error("orders-post", "erro ao gerar pagamento Pagar.me", { requestId, establishmentId: estId, orderId: order?.id, error: err?.message })
          // F5A-009: estorno do estoque antes do hard delete (falha de PSP).
          await prisma
            .$transaction(async (tx) => {
              await restoreOrderStock(tx, order.items, order.id, order.establishmentId)
              await tx.order.delete({ where: { id: order.id } })
            })
            .catch(() => {})
          return NextResponse.json({ error: `Erro ao gerar pagamento: ${err.message}` }, { status: 500 })
        }
      }
    }

    logger.info("orders-post", "resultado final do pedido", { requestId, establishmentId: estId, orderId: order?.id, hasPaymentLink: !!paymentLink })

    const fullOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { establishment: true },
    })

    // Credenciais do tenant nunca saem na resposta pública (F6A-001)
    if (fullOrder?.establishment) {
      for (const k of ["password","evolutionApiKey","metaAccessToken","metaWebhookVerifyToken","asaasApiKey","efiClientSecret","efiCertificate","efiWebhookToken","interClientSecret","interCertificate","interCertificatePassword","pagarmeApiKey","pagarmeWebhookKey","api99Key","ifoodAccessToken","ifoodRefreshToken","nineFoodApiKey"]) {
        delete (fullOrder.establishment as any)[k]
      }
    }

    return NextResponse.json({ order: fullOrder, paymentLink, pixPayload: pixPayload || "", trackingUrl: `/pedido/${trackingToken}`, lowStockItems })
  } catch (error) {
    if (error instanceof OrderInputError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    logger.error("orders-post", "falha ao criar o pedido", { requestId, establishmentId: estId, error: (error as any)?.message })
    return NextResponse.json({ error: "Erro ao criar pedido" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const establishmentIdParam = searchParams.get("establishmentId")
  const status = searchParams.get("status")
  // F5A-038: take opcional (KDS passa para não baixar o histórico inteiro a
  // cada 5s). Sem parâmetro o comportamento legado é preservado — os relatórios
  // ainda agregam no cliente e precisam da lista completa (ver Fase 3).
  const takeParam = parseInt(searchParams.get("take") || "", 10)
  const take = Number.isFinite(takeParam) && takeParam > 0 ? Math.min(takeParam, 1000) : undefined

  const { user, error } = requireEstablishment(req, establishmentIdParam)
  if (error) return error
  const establishmentId = user.establishmentId

  // F3A-001/F3D-002: o expurgo de abandoned saiu daqui (escrita-por-leitura em
  // todo poll) e virou o cron /api/cron/expire-orders (vercel.json, */5 min).

  const where: any = { establishmentId }
  if (status) {
    // F5A-038: lista separada por vírgula vira `in`; valor único mantém o formato legado
    const statusList = status.split(",").map((s) => s.trim()).filter(Boolean)
    if (statusList.length > 1) where.status = { in: statusList }
    else if (statusList.length === 1) where.status = statusList[0]
  }
  // F3A-001: janela opcional desde (ISO) — consumidores podem reduzir o scan
  const since = searchParams.get("since")
  if (since) {
    const sinceDate = new Date(since)
    if (!Number.isNaN(sinceDate.getTime())) where.createdAt = { gte: sinceDate }
  }
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
    select: {
      id: true,
      orderNumber: true,
      externalId: true,
      externalDisplayId: true,
      ifoodDeliveryBy: true,
      changeFor: true,
      establishmentId: true,
      customerId: true,
      customerName: true,
      customerPhone: true,
      customerAddress: true,
      customerLat: true,
      customerLng: true,
      orderType: true,
      paymentMethod: true,
      items: true,
      total: true,
      deliveryFee: true,
      status: true,
      paymentId: true,
      paymentLink: true,
      pixPayload: true,
      paymentStatus: true,
      notes: true,
      method: true,
      tableNumber: true,
      deliveryPerson: true,
      deliveryPersonId: true,
      deliveryCode: true,
      couponId: true,
      trackingToken: true,
      assignedAt: true,
      deliveredAt: true,
      cancellationReason: true,
      cancellationDate: true,
      cancelledBy: true,
      cancellationCount: true,
      cashbackEarned: true,
      loyaltyPointsUsed: true,
      firstPurchaseBonus: true,
      isScheduled: true,
      deliveryDate: true,
      entregaProvedor: true,
      entrega99RideId: true,
      entregaStatusProvedor: true,
      entregaPrecoCusto: true,
      entregaLinkRastreamento: true,
      entregaPinCode: true,
      createdAt: true,
      updatedAt: true,
      establishment: { select: { name: true, phone: true, slug: true } },
      customer: { select: { id: true, name: true, phone: true, cancellationCount: true, blockedUntil: true, needsHuman: true, needsHumanAt: true } },
    },
    orderBy: { createdAt: "desc" },
    ...(take ? { take } : {}),
  })

  return NextResponse.json(orders)
}
