import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"
import { isEstablishmentOpen } from "@/lib/store-hours"

/**
 * Valida e recalcula o input de POST /api/orders no servidor (F6B-001…004,
 * F6B-013, F6B-018). O navegador NÃO é fonte de preço, status, desconto,
 * cupom, fidelidade nem de pertencimento de produto à loja.
 */

export class OrderInputError extends Error {
  status: number
  code?: string
  constructor(message: string, status = 400, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export interface NormalizedOrderItem {
  id: string
  productId: string
  name: string
  price: number
  quantity: number
  basePrice?: number
  originalPrice?: number
  additionalOptions?: Array<{ name: string; price: number; quantity: number }>
  /** Alias lido por lib/stock.ts (deductAdditionalStock) */
  options?: Array<{ name: string; price: number; quantity: number }>
  observation?: string
  notes?: string
  additions?: Array<{ name: string; price: number }>
}

export interface BuiltOrderInput {
  establishment: any
  establishmentId: string
  customerName: string
  customerPhone: string | null
  customerEmail: string | null
  customerAddress: string | null
  customerComplement: string | null
  customerCep: string | null
  customerCpf: string | null
  customerLat: number | null
  customerLng: number | null
  orderType: string
  paymentMethod: string
  method: string
  items: NormalizedOrderItem[]
  itemsJson: string
  subtotal: number
  deliveryFee: number
  notes: string | null
  changeFor: number | null
  tableNumber: number | null
  waiterName: string | null
  isScheduled: boolean
  deliveryDate: Date | null
  couponId: string | null
  coupon: any | null
  wantsLoyalty: boolean
  isPayOnDelivery: boolean
  isOnlinePaymentMethod: boolean
  isMesa: boolean
  hasStaffAuth: boolean
  isPublicChannel: boolean
  initialStatus: string
  autoAccept: boolean
}

const ORDER_TYPES = new Set(["delivery", "pickup", "presencial", "table", "dineIn"])
const PAYMENT_METHODS = new Set([
  "cash", "delivery", "pickup", "card_delivery", "card_pickup",
  "pix", "card", "online", "asaas", "inter", "pending",
])
const PUBLIC_METHODS = new Set(["site", "bot", "whatsapp", "tablet"])
const STAFF_METHODS = new Set(["caixa", "manual", "admin", "pdv"])
const ONLINE_PAYMENT_METHODS = new Set(["pix", "card", "online", "asaas", "inter"])
const PAY_ON_DELIVERY_METHODS = new Set(["cash", "delivery", "pickup", "card_delivery", "card_pickup"])
const STAFF_PRESENCIAL_STATUSES = new Set(["new", "pending", "delivered"])
const MAX_ITEM_QUANTITY = 999
const MAX_CHANGE_FOR = 1_000_000

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null
  const n = typeof value === "number" ? value : parseFloat(String(value))
  return Number.isFinite(n) ? n : null
}

function toPositiveInt(value: unknown): number | null {
  const n = toNumber(value)
  if (n == null || !Number.isInteger(n) || n < 1) return null
  return n
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null || raw === "") return fallback
  try {
    return JSON.parse(typeof raw === "string" ? raw : String(raw)) as T
  } catch {
    return fallback
  }
}

/** Preço unitário base do produto (promo / destaque), espelhando o cardápio. */
function productBasePrice(product: any, allowDiscount: boolean): { base: number; original: number | null } {
  const hasPromo = allowDiscount && product.onSale && typeof product.promoPrice === "number" && product.promoPrice > 0
  const hasFeatured = allowDiscount && product.featured && typeof product.featuredDiscountPrice === "number" && product.featuredDiscountPrice > 0 && !product.onSale
  if (hasPromo) return { base: product.promoPrice, original: product.price }
  if (hasFeatured) return { base: product.featuredDiscountPrice, original: product.price }
  return { base: product.price, original: null }
}

function resolveInitialStatus(opts: {
  bodyStatus: unknown
  isOnlinePaymentMethod: boolean
  autoAccept: boolean
  isMesa: boolean
  orderType: string
  hasStaffAuth: boolean
}): string {
  // Pagamento online nunca começa na cozinha — o pagamento confirma antes.
  if (opts.isOnlinePaymentMethod) return "payment_pending"

  // Equipe autenticada (PDV) pode marcar estados limitados em pedido presencial.
  if (opts.hasStaffAuth && opts.orderType === "presencial" && typeof opts.bodyStatus === "string" && STAFF_PRESENCIAL_STATUSES.has(opts.bodyStatus)) {
    return opts.bodyStatus
  }

  // Tablet de mesa (anônimo, presencial) aceita apenas "new".
  if (!opts.hasStaffAuth && opts.isMesa && opts.bodyStatus === "new") return "new"

  // Canal público: status sempre calculado no servidor.
  if (opts.autoAccept) return "accepted"
  if (opts.isMesa) return "new"
  return "pending"
}

function computeDeliveryFee(establishment: any, orderType: string, subtotal: number): number {
  if (orderType !== "delivery") return 0
  const type = establishment.deliveryFeeType || "free"
  if (type === "free") return 0
  if (type === "free_above" && subtotal >= (establishment.deliveryFreeAbove || 0)) return 0
  return establishment.deliveryFeeAmount || 0
}

function checkMinimumOrder(establishment: any, orderType: string, subtotal: number): void {
  if (!establishment.minimumOrderEnabled) return
  const value = establishment.minimumOrderValue ?? 0
  if (!(value > 0) || subtotal <= 0) return
  const applyDelivery = establishment.minimumOrderApplyToDelivery !== false
  const applyPickup = establishment.minimumOrderApplyToPickup === true
  if (orderType === "delivery" && applyDelivery && subtotal < value) {
    throw new OrderInputError(
      `O pedido mínimo para delivery é R$ ${value.toFixed(2).replace(".", ",")}.`,
      400,
      "minimum_order_not_reached"
    )
  }
  if ((orderType === "pickup" || orderType === "dineIn") && applyPickup && subtotal < value) {
    throw new OrderInputError(
      `O pedido mínimo para retirada é R$ ${value.toFixed(2).replace(".", ",")}.`,
      400,
      "minimum_order_not_reached"
    )
  }
}

function validateScheduling(establishment: any, isScheduled: boolean, deliveryDateRaw: unknown): Date | null {
  if (!isScheduled && (deliveryDateRaw == null || deliveryDateRaw === "")) return null
  const scheduledDate = new Date(deliveryDateRaw as any)
  if (isNaN(scheduledDate.getTime())) {
    throw new OrderInputError("Data de agendamento inválida.", 400, "scheduled_invalid_date")
  }
  const now = new Date()
  const minMs = (establishment.scheduledMinHours || 24) * 60 * 60 * 1000
  const maxMs = (establishment.scheduledMaxAdvanceDays || 30) * 24 * 60 * 60 * 1000
  if (scheduledDate.getTime() <= now.getTime()) {
    throw new OrderInputError("Data de agendamento deve ser no futuro.", 400, "scheduled_must_be_future")
  }
  if (scheduledDate.getTime() - now.getTime() < minMs) {
    const minHours = establishment.scheduledMinHours || 24
    throw new OrderInputError(
      `Pedidos agendados precisam de pelo menos ${minHours}h de antecedência.`,
      400,
      "scheduled_too_soon"
    )
  }
  if (scheduledDate.getTime() - now.getTime() > maxMs) {
    const maxDays = establishment.scheduledMaxAdvanceDays || 30
    throw new OrderInputError(`Antecedência máxima é de ${maxDays} dias.`, 400, "scheduled_too_far")
  }
  return scheduledDate
}

async function validateCoupon(couponId: string, establishmentId: string, subtotal: number): Promise<any> {
  const coupon = await prisma.coupon.findUnique({ where: { id: couponId } })
  if (!coupon || coupon.establishmentId !== establishmentId) {
    throw new OrderInputError("Cupom inválido.", 400, "coupon_invalid")
  }
  if (!coupon.available) {
    throw new OrderInputError("Cupom indisponível.", 400, "coupon_unavailable")
  }
  if (coupon.usageLimit != null && coupon.timesUsed >= coupon.usageLimit) {
    throw new OrderInputError("Cupom esgotado.", 400, "coupon_exhausted")
  }
  // O schema atual de Coupon não guarda valor de desconto legível por máquina
  // (só name/type/conditionValue). Desconto do cliente é ignorado de propósito
  // — F6B-013. `subtotal` fica na assinatura para o dia em houver valor real.
  void subtotal
  return coupon
}

async function normalizeItems(opts: {
  rawItems: any
  establishmentId: string
  orderConfig: any
  isPublicChannel: boolean
}): Promise<NormalizedOrderItem[]> {
  const { rawItems, establishmentId, orderConfig, isPublicChannel } = opts
  let parsed = rawItems
  if (typeof rawItems === "string") {
    try {
      parsed = JSON.parse(rawItems)
    } catch {
      throw new OrderInputError("Itens inválidos.", 400, "items_invalid")
    }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new OrderInputError("Pedido deve conter ao menos um item", 400, "items_empty")
  }
  if (parsed.length > 200) {
    throw new OrderInputError("Pedido com itens demais.", 400, "items_too_many")
  }

  const dbIds: string[] = []
  for (const item of parsed) {
    const pid = item?.id || item?.productId
    if (typeof pid === "string" && pid && !pid.startsWith("custom-")) dbIds.push(pid)
  }
  const products = dbIds.length
    ? await prisma.product.findMany({
        where: { id: { in: dbIds }, establishmentId },
        include: { additionalOptions: true },
      })
    : []
  const productMap = new Map(products.map((p: any) => [p.id, p]))

  const discountExclusive = orderConfig?.discountExclusive === true
  const discountAppliesTo = orderConfig?.discountAppliesTo
  let discountUsed = false
  const normalized: NormalizedOrderItem[] = []

  for (const item of parsed) {
    if (!item || typeof item !== "object") {
      throw new OrderInputError("Item inválido", 400, "item_invalid")
    }
    const quantity = toPositiveInt(item.quantity)
    if (quantity == null || quantity > MAX_ITEM_QUANTITY) {
      throw new OrderInputError("Quantidade de item inválida.", 400, "item_quantity_invalid")
    }

    const rawId = item.id || item.productId
    if (!rawId || typeof rawId !== "string") {
      throw new OrderInputError("Item sem produto.", 400, "item_missing_product")
    }

    const isCustom = rawId.startsWith("custom-")
    const product = isCustom ? null : productMap.get(rawId)

    if (isCustom && isPublicChannel) {
      throw new OrderInputError("Produto indisponível.", 400, "product_unavailable")
    }
    if (!isCustom && !product) {
      // productId de outra loja / inexistente / indisponível
      throw new OrderInputError("Produto indisponível.", 400, "product_unavailable")
    }
    if (product) {
      if (product.isAvailable === false) {
        throw new OrderInputError(`"${product.name}" está indisponível.`, 400, "product_unavailable")
      }
      if (isPublicChannel && product.availableOnline === false) {
        throw new OrderInputError(`"${product.name}" não está disponível no cardápio online.`, 400, "product_not_online")
      }
    }

    // Opções de adicionais (menu envia additionalOptions; bot envia additions)
    const rawOptions: any[] = Array.isArray(item.additionalOptions)
      ? item.additionalOptions
      : Array.isArray(item.additions)
        ? item.additions.map((a: any) => ({ name: a?.name, price: a?.price, quantity: a?.quantity ?? 1 }))
        : []

    let optionsPrice = 0
    const additionalOptions: Array<{ name: string; price: number; quantity: number }> = []
    if (rawOptions.length > 0) {
      if (!product) {
        throw new OrderInputError("Item personalizado não aceita adicionais.", 400, "custom_item_options")
      }
      const dbOptions: any[] = product.additionalOptions || []
      for (const opt of rawOptions) {
        const optName = String(opt?.name || "").trim()
        if (!optName) continue
        const optQty = opt?.quantity == null ? 1 : Number(opt.quantity)
        if (!Number.isInteger(optQty) || optQty < 1 || optQty > MAX_ITEM_QUANTITY) {
          throw new OrderInputError("Quantidade de adicional inválida.", 400, "option_quantity_invalid")
        }
        const dbOpt = dbOptions.find((o) => String(o.name || "").trim().toLowerCase() === optName.toLowerCase())
        if (!dbOpt) {
          if (isPublicChannel) {
            throw new OrderInputError(`Adicional "${optName}" inválido.`, 400, "option_invalid")
          }
          // Staff/PDV: mantém preço enviado se o adicional saiu do catálogo local
          const optPrice = toNumber(opt.price) ?? 0
          if (optPrice < 0) throw new OrderInputError("Preço de adicional inválido.", 400, "option_price_invalid")
          optionsPrice += optPrice * optQty
          additionalOptions.push({ name: optName, price: optPrice, quantity: optQty })
          continue
        }
        const optPrice = dbOpt.price || 0
        optionsPrice += optPrice * optQty
        additionalOptions.push({ name: dbOpt.name, price: optPrice, quantity: optQty })
      }
    }

    if (isCustom) {
      // Item livre do PDV: preço vem do caixa autenticado.
      const customPrice = toNumber(item.price)
      if (customPrice == null || customPrice < 0) {
        throw new OrderInputError("Preço do item personalizado inválido.", 400, "item_price_invalid")
      }
      const name = String(item.name || "").trim()
      if (!name) throw new OrderInputError("Item personalizado sem nome.", 400, "item_name_required")
      normalized.push({
        id: rawId,
        productId: rawId,
        name,
        price: customPrice,
        quantity,
      })
      continue
    }

    // Recalcula preço no servidor (promo/destaque + adicionais)
    let allowDiscount = true
    if (discountExclusive) {
      const hasProductDiscount =
        (product.onSale && product.promoPrice > 0) ||
        (product.featured && product.featuredDiscountPrice > 0 && !product.onSale)
      if (hasProductDiscount && discountUsed) allowDiscount = false
      if (hasProductDiscount && allowDiscount) discountUsed = true
    }
    const { base, original } = productBasePrice(product, allowDiscount)
    let unitPrice = base + optionsPrice
    // `first_only`: só a 1ª unidade leva o preço promocional
    if (discountAppliesTo === "first_only" && original != null && quantity > 1) {
      // preço gravado por unidade permanece o promocional; o total do item no
      // cliente usa 1× promo + (n−1)× full. Guardamos o unit promo e deixamos o
      // subtotal calcular 1 promo + (n−1) full.
      unitPrice = base + optionsPrice
    }

    const out: NormalizedOrderItem = {
      id: product.id,
      productId: product.id,
      name: product.name,
      price: unitPrice,
      quantity,
      basePrice: base + optionsPrice,
      additionalOptions: additionalOptions.length ? additionalOptions : undefined,
      options: additionalOptions.length ? additionalOptions : undefined,
      observation: item.observation || item.notes || undefined,
    }
    if (original != null) out.originalPrice = original + optionsPrice
    normalized.push(out)
  }
  return normalized
}

function subtotalFromItems(items: NormalizedOrderItem[], orderConfig: any): number {
  const firstOnly = orderConfig?.discountAppliesTo === "first_only"
  return items.reduce((sum, item) => {
    if (firstOnly && item.originalPrice != null && item.quantity > 1) {
      const discountedUnit = item.price
      const fullUnit = item.originalPrice
      return sum + discountedUnit + fullUnit * (item.quantity - 1)
    }
    return sum + item.price * item.quantity
  }, 0)
}

export async function buildOrderInput(req: Request, body: any): Promise<BuiltOrderInput> {
  if (!body || typeof body !== "object") {
    throw new OrderInputError("Dados incompletos", 400, "invalid_body")
  }

  const establishmentId = body.establishmentId
  const customerName = typeof body.customerName === "string" ? body.customerName.trim() : ""
  const { items: rawItems } = body

  if (!establishmentId || !customerName || rawItems == null) {
    throw new OrderInputError("Dados incompletos", 400, "missing_fields")
  }

  const establishment = await prisma.establishment.findUnique({ where: { id: establishmentId } })
  if (!establishment) {
    throw new OrderInputError("Estabelecimento não encontrado", 404, "establishment_not_found")
  }

  const authUser = verifyAuth(req)
  const hasStaffAuth = !!authUser && authUser.establishmentId === establishmentId
  const isPublicChannel = !hasStaffAuth || ["site", "bot", "whatsapp"].includes(String(body.method || "site"))

  // ── Método / canal (F6B-001) ──
  const methodRaw = typeof body.method === "string" && body.method ? body.method : "site"
  if (!PUBLIC_METHODS.has(methodRaw) && !STAFF_METHODS.has(methodRaw)) {
    throw new OrderInputError("Canal de pedido inválido.", 400, "method_invalid")
  }
  if (STAFF_METHODS.has(methodRaw) && !hasStaffAuth) {
    throw new OrderInputError("Canal restrito a equipe autenticada.", 403, "method_forbidden")
  }
  // Pedidos públicos de delivery/pickup não podem se passar por canal interno.
  const method = methodRaw

  // ── Tipo de pedido / pagamento (whitelist) ──
  const orderType = typeof body.orderType === "string" && body.orderType ? body.orderType : "delivery"
  if (!ORDER_TYPES.has(orderType)) {
    throw new OrderInputError("Tipo de pedido inválido.", 400, "order_type_invalid")
  }
  const paymentMethodRaw = body.paymentMethod
  const paymentMethod = typeof paymentMethodRaw === "string" && paymentMethodRaw ? paymentMethodRaw : "online"
  if (!PAYMENT_METHODS.has(paymentMethod)) {
    throw new OrderInputError("Forma de pagamento inválida.", 400, "payment_method_invalid")
  }

  const isOnlinePaymentMethod = ONLINE_PAYMENT_METHODS.has(paymentMethod)
  const isPayOnDelivery = PAY_ON_DELIVERY_METHODS.has(paymentMethod)
  const isMesa = orderType === "presencial" && !!body.tableNumber
  const autoAccept = !!establishment.autoAcceptOrders

  // ── Plano / loja ativa (F6B-004 + F6B-014) ──
  if (establishment.isActive === false) {
    throw new OrderInputError("Estabelecimento inativo", 403, "establishment_inactive")
  }
  if (establishment.subscriptionStatus === "cancelled" || establishment.subscriptionStatus === "suspended") {
    throw new OrderInputError("Estabelecimento inativo", 403, "establishment_inactive")
  }
  const isCustomerFacing = ["site", "bot", "whatsapp"].includes(method)
  if (isCustomerFacing) {
    const now = new Date()
    if (establishment.subscriptionStatus === "expired" || establishment.subscriptionStatus === "pending_payment") {
      throw new OrderInputError("Estabelecimento inativo", 403, "subscription_blocked")
    }
    if (
      establishment.subscriptionStatus === "trial" &&
      establishment.trialEndsAt &&
      new Date(establishment.trialEndsAt) < now
    ) {
      throw new OrderInputError("Estabelecimento inativo", 403, "subscription_blocked")
    }
    // ── Loja aberta (F6B-004): horário + override. Agendado pula a checagem. ──
    const wantsSchedule = body.isScheduled === true || (body.deliveryDate != null && body.deliveryDate !== "")
    if (!wantsSchedule && !isEstablishmentOpen(establishment)) {
      throw new OrderInputError("Estabelecimento fechado no momento.", 403, "store_closed")
    }
  }

  // ── Itens: pertence à loja, disponível, preço recalculado (F6B-003) ──
  const orderConfig = parseJson<any>(establishment.orderConfig, { delivery: true, pickup: true, dineIn: true })
  const items = await normalizeItems({ rawItems, establishmentId, orderConfig, isPublicChannel })
  const subtotal = subtotalFromItems(items, orderConfig)
  if (subtotal <= 0) {
    throw new OrderInputError("Pedido deve conter ao menos um item", 400, "items_empty")
  }

  // ── Pedido mínimo ──
  if (isCustomerFacing) checkMinimumOrder(establishment, orderType, subtotal)

  // ── Taxa de entrega recalculada (ignora body.deliveryFee) ──
  const deliveryFee = computeDeliveryFee(establishment, orderType, subtotal)

  // ── Agendamento (F6B-018) ──
  const deliveryDate = validateScheduling(
    establishment,
    body.isScheduled === true,
    body.deliveryDate
  )
  const isScheduled = !!deliveryDate

  // ── Cupom (F6B-013): dono, disponibilidade e limite — desconto NÃO vem do body ──
  let coupon: any | null = null
  let couponId: string | null = null
  if (body.couponId) {
    couponId = String(body.couponId)
    coupon = await validateCoupon(couponId, establishmentId, subtotal)
  }

  // ── changeFor só para pagamento em dinheiro (F6B-023 mínimo) ──
  let changeFor: number | null = null
  if (body.changeFor != null && body.changeFor !== "") {
    if (!isPayOnDelivery || isOnlinePaymentMethod) {
      changeFor = null
    } else {
      const cf = toNumber(body.changeFor)
      if (cf != null && cf > 0 && cf <= MAX_CHANGE_FOR) changeFor = cf
    }
  }

  // ── Status inicial (F6B-001): body.status só em whitelist estreita ──
  const initialStatus = resolveInitialStatus({
    bodyStatus: body.status,
    isOnlinePaymentMethod,
    autoAccept,
    isMesa,
    orderType,
    hasStaffAuth,
  })

  // ── Fidelidade: só a intenção `useLoyalty` é aceita; valores vêm do servidor ──
  const wantsLoyalty = body.useLoyalty === true

  return {
    establishment,
    establishmentId,
    customerName,
    customerPhone: typeof body.customerPhone === "string" && body.customerPhone ? body.customerPhone : null,
    customerEmail: typeof body.customerEmail === "string" && body.customerEmail ? body.customerEmail : null,
    customerAddress: typeof body.customerAddress === "string" && body.customerAddress ? body.customerAddress : null,
    customerComplement: typeof body.customerComplement === "string" && body.customerComplement ? body.customerComplement : null,
    customerCep: typeof body.customerCep === "string" && body.customerCep ? body.customerCep : null,
    customerCpf: typeof body.customerCpf === "string" && body.customerCpf ? body.customerCpf : null,
    customerLat: toNumber(body.customerLat),
    customerLng: toNumber(body.customerLng),
    orderType,
    paymentMethod,
    method,
    items,
    itemsJson: JSON.stringify(items),
    subtotal,
    deliveryFee,
    notes: typeof body.notes === "string" && body.notes ? body.notes : null,
    changeFor,
    tableNumber: (() => {
      if (body.tableNumber == null || body.tableNumber === "") return null
      const n = Number(body.tableNumber)
      return Number.isFinite(n) ? Math.trunc(n) : null
    })(),
    waiterName: typeof body.waiterName === "string" && body.waiterName ? body.waiterName : null,
    isScheduled,
    deliveryDate,
    couponId,
    coupon,
    wantsLoyalty,
    isPayOnDelivery,
    isOnlinePaymentMethod,
    isMesa,
    hasStaffAuth,
    isPublicChannel,
    initialStatus,
    autoAccept,
  }
}

export interface LoyaltyRedemption {
  discount: number
  pointsUsed: number
}

/**
 * Resgata de fidelidade recalculado no servidor (F6B-002).
 * Espelha a fórmula do cardápio (menu-page.tsx): 1 ponto = R$ 0,01,
 * teto percentual do subtotal e saldo máximo do cliente.
 */
export function computeLoyaltyRedemption(opts: {
  customer: { loyaltyPoints: number } | null
  loyaltyConfigJson: string | null
  wantsLoyalty: boolean
  subtotal: number
}): LoyaltyRedemption {
  const { customer, loyaltyConfigJson, wantsLoyalty, subtotal } = opts
  if (!wantsLoyalty || !customer) return { discount: 0, pointsUsed: 0 }

  const config = parseJson<any>(loyaltyConfigJson, null)
  if (!config?.enabled) return { discount: 0, pointsUsed: 0 }
  // Resgate por produto: implementação do cliente está quebrada (procura
  // item.productId que não existe no CartItem). Ignora por segurança.
  if (config.redeemType === "product") return { discount: 0, pointsUsed: 0 }

  const balancePoints = Math.floor(customer.loyaltyPoints || 0)
  if (balancePoints <= 0) return { discount: 0, pointsUsed: 0 }

  const minOrder = config.minOrderToRedeem || 0
  if (minOrder > 0 && subtotal < minOrder) return { discount: 0, pointsUsed: 0 }

  const balance = balancePoints * 0.01
  const maxRedeemPercent = config.maxRedeemPercent || config.redeemLimitValue || 25
  const maxDiscount = (subtotal * maxRedeemPercent) / 100
  let discount = Math.min(balance, maxDiscount)
  if (!(discount > 0)) return { discount: 0, pointsUsed: 0 }

  let pointsUsed = Math.round(discount * 100)
  if (pointsUsed > balancePoints) pointsUsed = balancePoints
  discount = pointsUsed * 0.01
  return { discount, pointsUsed }
}

export interface FirstPurchaseBonus {
  discount: number
  bonusPoints: number
  eligible: boolean
}

/**
 * Desconto/bônus de primeira compra (só cliente existente já verificado por
 * WhatsApp com 0 pedidos — espelha o cardápio e corrige o desconto grátis
 * que o servidor dava para cliente novo sem verificação).
 */
export function computeFirstPurchaseBonus(opts: {
  customer: { totalOrders: number; whatsappVerified: boolean } | null
  establishment: {
    firstPurchaseEnabled?: boolean
    firstPurchaseDiscount?: number | null
    firstPurchaseBonus?: number | null
  }
}): FirstPurchaseBonus {
  const { customer, establishment } = opts
  if (!establishment.firstPurchaseEnabled || !customer) {
    return { discount: 0, bonusPoints: 0, eligible: false }
  }
  if ((customer.totalOrders || 0) !== 0) return { discount: 0, bonusPoints: 0, eligible: false }
  if (!customer.whatsappVerified) return { discount: 0, bonusPoints: 0, eligible: false }
  return {
    discount: establishment.firstPurchaseDiscount || 0,
    bonusPoints: establishment.firstPurchaseBonus || 0,
    eligible: true,
  }
}
