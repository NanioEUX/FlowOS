import { describe, it, expect, vi, beforeEach } from "vitest"

const mockPrisma = vi.hoisted(() => ({
  establishment: { findUnique: vi.fn() },
  product: { findMany: vi.fn() },
  coupon: { findUnique: vi.fn() },
}))

const mockVerifyAuth = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))
vi.mock("@/lib/auth", () => ({ verifyAuth: (...args: any[]) => mockVerifyAuth(...args) }))

import {
  buildOrderInput,
  computeLoyaltyRedemption,
  computeFirstPurchaseBonus,
  OrderInputError,
} from "../order-input"

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]

function openAllHours() {
  return JSON.stringify(
    DAY_NAMES.map((day) => ({ day, open: "00:00", close: "23:59", active: true }))
  )
}

function baseEstablishment(overrides: any = {}) {
  return {
    id: "est-1",
    name: "Loja Teste",
    isActive: true,
    subscriptionStatus: "active",
    trialEndsAt: null,
    autoAcceptOrders: false,
    businessHours: openAllHours(),
    isOpenOverride: null,
    orderConfig: '{"delivery":true,"pickup":true,"dineIn":true}',
    paymentConfig: '{"online":true,"delivery":true,"pickup":true}',
    deliveryFeeType: "fixed",
    deliveryFeeAmount: 5,
    deliveryFreeAbove: 0,
    minimumOrderEnabled: false,
    minimumOrderValue: 0,
    minimumOrderApplyToDelivery: true,
    minimumOrderApplyToPickup: false,
    scheduledMinHours: 2,
    scheduledMaxAdvanceDays: 30,
    loyaltyConfig: null,
    tierConfig: null,
    firstPurchaseEnabled: false,
    firstPurchaseDiscount: null,
    firstPurchaseBonus: 0,
    maxPayOnDeliveryAmount: null,
    blockConcurrentPayOnDelivery: false,
    ...overrides,
  }
}

function product1(overrides: any = {}) {
  return {
    id: "prod-1",
    name: "Hambúrguer",
    price: 30,
    isAvailable: true,
    availableOnline: true,
    availablePresencial: true,
    onSale: false,
    promoPrice: null,
    featured: false,
    featuredDiscountPrice: null,
    additionalOptions: [],
    establishmentId: "est-1",
    ...overrides,
  }
}

function makeRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
  })
}

function baseBody(overrides: any = {}) {
  return {
    establishmentId: "est-1",
    customerName: "João",
    customerPhone: "11999998888",
    orderType: "delivery",
    paymentMethod: "cash",
    method: "site",
    items: [{ id: "prod-1", name: "Hambúrguer", price: 30, quantity: 2 }],
    ...overrides,
  }
}

async function expectOrderError(promise: Promise<any>, status: number, code?: string) {
  const err = await promise.then(() => null).catch((e) => e)
  expect(err).toBeInstanceOf(OrderInputError)
  expect((err as OrderInputError).status).toBe(status)
  if (code) expect((err as OrderInputError).code).toBe(code)
}

describe("buildOrderInput — F6B-001 status/method", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyAuth.mockReturnValue(null)
    mockPrisma.establishment.findUnique.mockResolvedValue(baseEstablishment())
    mockPrisma.product.findMany.mockResolvedValue([product1()])
    mockPrisma.coupon.findUnique.mockResolvedValue(null)
  })

  it("ignora body.status em pedido de delivery (canal público)", async () => {
    const input = await buildOrderInput(makeRequest(), baseBody({ status: "delivered" }))
    expect(input.initialStatus).toBe("pending")
  })

  it("status payment_pending quando pagamento online", async () => {
    const input = await buildOrderInput(
      makeRequest(),
      baseBody({ paymentMethod: "pix", status: "delivered" })
    )
    expect(input.initialStatus).toBe("payment_pending")
  })

  it("autoAccept leva a accepted sem aceitar body.status", async () => {
    mockPrisma.establishment.findUnique.mockResolvedValue(baseEstablishment({ autoAcceptOrders: true }))
    const input = await buildOrderInput(makeRequest(), baseBody({ status: "preparing" }))
    expect(input.initialStatus).toBe("accepted")
  })

  it("mesa anônima aceita apenas status new", async () => {
    const input = await buildOrderInput(
      makeRequest(),
      baseBody({
        orderType: "presencial",
        tableNumber: "3",
        paymentMethod: "pending",
        method: "tablet",
        status: "new",
      })
    )
    expect(input.initialStatus).toBe("new")
    expect(input.isMesa).toBe(true)
  })

  it("mesa anônima com status delivered é rejeitada (cai no default new)", async () => {
    const input = await buildOrderInput(
      makeRequest(),
      baseBody({
        orderType: "presencial",
        tableNumber: "3",
        paymentMethod: "pending",
        method: "tablet",
        status: "delivered",
      })
    )
    // Não é staff → body.status ignored → isMesa → "new"
    expect(input.initialStatus).toBe("new")
  })

  it("staff autenticado pode marcar delivered em presencial", async () => {
    mockVerifyAuth.mockReturnValue({ establishmentId: "est-1", userId: "u1", email: "a@b.c", role: "admin", permissions: [] })
    const input = await buildOrderInput(
      makeRequest({ Authorization: "Bearer x" }),
      baseBody({
        orderType: "presencial",
        paymentMethod: "cash",
        method: "caixa",
        status: "delivered",
        items: [{ productId: "prod-1", name: "Hambúrguer", price: 30, quantity: 1 }],
      })
    )
    expect(input.initialStatus).toBe("delivered")
    expect(input.hasStaffAuth).toBe(true)
  })

  it("rejeita method desconhecido", async () => {
    await expectOrderError(
      buildOrderInput(makeRequest(), baseBody({ method: "hack" })),
      400,
      "method_invalid"
    )
  })

  it("rejeita method staff sem JWT", async () => {
    await expectOrderError(
      buildOrderInput(makeRequest(), baseBody({ method: "caixa", orderType: "presencial" })),
      403,
      "method_forbidden"
    )
  })
})

describe("buildOrderInput — F6B-002 fidelidade (via computeLoyaltyRedemption)", () => {
  const loyaltyConfig = JSON.stringify({
    enabled: true,
    pointsPerReal: 1,
    redeemPoints: 100,
    redeemDiscount: 10,
    redeemLimitType: "percentage",
    redeemLimitValue: 30,
    minOrderToRedeem: 0,
  })

  it("ignora desconto do body e zera sem useLoyalty", () => {
    const r = computeLoyaltyRedemption({
      customer: { loyaltyPoints: 10000 },
      loyaltyConfigJson: loyaltyConfig,
      wantsLoyalty: false,
      subtotal: 100,
    })
    expect(r).toEqual({ discount: 0, pointsUsed: 0 })
  })

  it("saldo em pontos limita o desconto (1 ponto = R$ 0,01)", () => {
    const r = computeLoyaltyRedemption({
      customer: { loyaltyPoints: 500 }, // R$ 5,00
      loyaltyConfigJson: loyaltyConfig,
      wantsLoyalty: true,
      subtotal: 100,
    })
    expect(r.discount).toBeCloseTo(5, 5)
    expect(r.pointsUsed).toBe(500)
  })

  it("teto percentual do subtotal limita o desconto", () => {
    const r = computeLoyaltyRedemption({
      customer: { loyaltyPoints: 100000 }, // R$ 1000
      loyaltyConfigJson: loyaltyConfig,
      wantsLoyalty: true,
      subtotal: 100, // teto 30% = R$ 30
    })
    expect(r.discount).toBeCloseTo(30, 5)
    expect(r.pointsUsed).toBe(3000)
  })

  it("sem saldo = zero", () => {
    const r = computeLoyaltyRedemption({
      customer: { loyaltyPoints: 0 },
      loyaltyConfigJson: loyaltyConfig,
      wantsLoyalty: true,
      subtotal: 100,
    })
    expect(r.discount).toBe(0)
  })

  it("resgate por produto é ignorado (cliente quebrado)", () => {
    const cfg = JSON.stringify({ enabled: true, redeemType: "product", redeemProductId: "p1" })
    const r = computeLoyaltyRedemption({
      customer: { loyaltyPoints: 10000 },
      loyaltyConfigJson: cfg,
      wantsLoyalty: true,
      subtotal: 100,
    })
    expect(r).toEqual({ discount: 0, pointsUsed: 0 })
  })

  it("minOrderToRedeem bloqueia subtotal abaixo do mínimo", () => {
    const cfg = JSON.stringify({ enabled: true, minOrderToRedeem: 50, redeemLimitValue: 25 })
    const r = computeLoyaltyRedemption({
      customer: { loyaltyPoints: 10000 },
      loyaltyConfigJson: cfg,
      wantsLoyalty: true,
      subtotal: 30,
    })
    expect(r.discount).toBe(0)
  })
})

describe("computeFirstPurchaseBonus", () => {
  const est = { firstPurchaseEnabled: true, firstPurchaseDiscount: 5, firstPurchaseBonus: 50 }

  it("exige whatsappVerified e totalOrders 0", () => {
    expect(
      computeFirstPurchaseBonus({
        customer: { totalOrders: 0, whatsappVerified: true },
        establishment: est,
      })
    ).toEqual({ discount: 5, bonusPoints: 50, eligible: true })
  })

  it("bloqueia sem verificação", () => {
    expect(
      computeFirstPurchaseBonus({
        customer: { totalOrders: 0, whatsappVerified: false },
        establishment: est,
      }).discount
    ).toBe(0)
  })

  it("bloqueia com pedidos anteriores", () => {
    expect(
      computeFirstPurchaseBonus({
        customer: { totalOrders: 2, whatsappVerified: true },
        establishment: est,
      }).discount
    ).toBe(0)
  })
})

describe("buildOrderInput — F6B-003 produto cross-tenant / indisponível", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyAuth.mockReturnValue(null)
    mockPrisma.establishment.findUnique.mockResolvedValue(baseEstablishment())
  })

  it("rejeita productId de outra loja", async () => {
    // product.findMany filtrado por establishmentId → vazio
    mockPrisma.product.findMany.mockResolvedValue([])
    await expectOrderError(
      buildOrderInput(makeRequest(), baseBody()),
      400,
      "product_unavailable"
    )
  })

  it("rejeita produto isAvailable=false", async () => {
    mockPrisma.product.findMany.mockResolvedValue([product1({ isAvailable: false })])
    await expectOrderError(
      buildOrderInput(makeRequest(), baseBody()),
      400,
      "product_unavailable"
    )
  })

  it("rejeita produto availableOnline=false no canal público", async () => {
    mockPrisma.product.findMany.mockResolvedValue([product1({ availableOnline: false })])
    await expectOrderError(
      buildOrderInput(makeRequest(), baseBody()),
      400,
      "product_not_online"
    )
  })

  it("aceita item personalizado só para staff (custom-)", async () => {
    mockVerifyAuth.mockReturnValue({ establishmentId: "est-1", userId: "u1", email: "a@b.c", role: "admin", permissions: [] })
    mockPrisma.product.findMany.mockResolvedValue([])
    const input = await buildOrderInput(
      makeRequest({ Authorization: "Bearer x" }),
      baseBody({
        orderType: "presencial",
        paymentMethod: "cash",
        method: "caixa",
        items: [{ productId: "custom-123", name: "Taxa", price: 10, quantity: 1 }],
      })
    )
    expect(input.items[0].productId).toBe("custom-123")
    expect(input.items[0].price).toBe(10)
  })

  it("rejeita item personalizado no canal público", async () => {
    mockPrisma.product.findMany.mockResolvedValue([])
    await expectOrderError(
      buildOrderInput(
        makeRequest(),
        baseBody({ items: [{ id: "custom-123", name: "Taxa", price: 10, quantity: 1 }] })
      ),
      400,
      "product_unavailable"
    )
  })

  it("recalcula preço com promo e ignora preço adulterado do body", async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      product1({ onSale: true, promoPrice: 20 }),
    ])
    const input = await buildOrderInput(
      makeRequest(),
      baseBody({
        paymentMethod: "cash",
        items: [{ id: "prod-1", name: "Hambúrguer", price: 0.01, quantity: 1 }],
      })
    )
    expect(input.items[0].price).toBe(20)
    expect(input.subtotal).toBe(20)
  })

  it("recalcula adicionais a partir do banco", async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      product1({
        additionalOptions: [{ id: "opt-1", name: "Bacon", price: 5, consumesStock: false }],
      }),
    ])
    const input = await buildOrderInput(
      makeRequest(),
      baseBody({
        paymentMethod: "cash",
        items: [
          {
            id: "prod-1",
            name: "Hambúrguer",
            price: 999,
            quantity: 1,
            additionalOptions: [{ name: "Bacon", price: 0.01, quantity: 1 }],
          },
        ],
      })
    )
    expect(input.items[0].price).toBe(35) // 30 + 5
  })

  it("rejeita quantidade absurda", async () => {
    mockPrisma.product.findMany.mockResolvedValue([product1()])
    await expectOrderError(
      buildOrderInput(
        makeRequest(),
        baseBody({
          paymentMethod: "cash",
          items: [{ id: "prod-1", name: "Hambúrguer", price: 30, quantity: 100000 }],
        })
      ),
      400,
      "item_quantity_invalid"
    )
  })
})

describe("buildOrderInput — F6B-004 loja fechada / plano", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyAuth.mockReturnValue(null)
    mockPrisma.product.findMany.mockResolvedValue([product1()])
    mockPrisma.coupon.findUnique.mockResolvedValue(null)
  })

  it("rejeita pedido público quando isOpenOverride=false", async () => {
    mockPrisma.establishment.findUnique.mockResolvedValue(
      baseEstablishment({ isOpenOverride: false })
    )
    await expectOrderError(
      buildOrderInput(makeRequest(), baseBody()),
      403,
      "store_closed"
    )
  })

  it("rejeita quando trial vencido (canal público)", async () => {
    mockPrisma.establishment.findUnique.mockResolvedValue(
      baseEstablishment({
        subscriptionStatus: "trial",
        trialEndsAt: new Date(Date.now() - 86400000),
      })
    )
    await expectOrderError(
      buildOrderInput(makeRequest(), baseBody()),
      403,
      "subscription_blocked"
    )
  })

  it("rejeita subscriptionStatus expired", async () => {
    mockPrisma.establishment.findUnique.mockResolvedValue(
      baseEstablishment({ subscriptionStatus: "expired" })
    )
    await expectOrderError(
      buildOrderInput(makeRequest(), baseBody()),
      403,
      "subscription_blocked"
    )
  })

  it("rejeita isActive=false", async () => {
    mockPrisma.establishment.findUnique.mockResolvedValue(
      baseEstablishment({ isActive: false })
    )
    await expectOrderError(
      buildOrderInput(makeRequest(), baseBody()),
      403,
      "establishment_inactive"
    )
  })

  it("rejeita cancelled/suspended", async () => {
    mockPrisma.establishment.findUnique.mockResolvedValue(
      baseEstablishment({ subscriptionStatus: "cancelled" })
    )
    await expectOrderError(
      buildOrderInput(makeRequest(), baseBody()),
      403,
      "establishment_inactive"
    )
  })

  it("loja fechada por horário bloqueia canal público", async () => {
    mockPrisma.establishment.findUnique.mockResolvedValue(
      baseEstablishment({ businessHours: "[]" })
    )
    // businessHours [] = aberta (regra do cardápio). Usa override false já testado.
    // Para horário: dia de hoje inativo.
    const today = DAY_NAMES[new Date().getDay()]
    mockPrisma.establishment.findUnique.mockResolvedValue(
      baseEstablishment({
        businessHours: JSON.stringify([
          { day: today, open: "08:00", close: "18:00", active: false },
        ]),
      })
    )
    await expectOrderError(
      buildOrderInput(makeRequest(), baseBody()),
      403,
      "store_closed"
    )
  })

  it("staff (caixa) ignora gate de horário", async () => {
    mockVerifyAuth.mockReturnValue({ establishmentId: "est-1", userId: "u1", email: "a@b.c", role: "admin", permissions: [] })
    mockPrisma.establishment.findUnique.mockResolvedValue(
      baseEstablishment({ isOpenOverride: false })
    )
    const input = await buildOrderInput(
      makeRequest({ Authorization: "Bearer x" }),
      baseBody({
        orderType: "presencial",
        paymentMethod: "cash",
        method: "caixa",
        items: [{ productId: "prod-1", name: "Hambúrguer", price: 30, quantity: 1 }],
      })
    )
    expect(input.hasStaffAuth).toBe(true)
    expect(input.subtotal).toBe(30)
  })
})

describe("buildOrderInput — F6B-013 cupom", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyAuth.mockReturnValue(null)
    mockPrisma.establishment.findUnique.mockResolvedValue(baseEstablishment())
    mockPrisma.product.findMany.mockResolvedValue([product1()])
  })

  it("rejeita cupom de outra loja", async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue({
      id: "c1",
      establishmentId: "est-OTHER",
      available: true,
      usageLimit: 10,
      timesUsed: 0,
    })
    await expectOrderError(
      buildOrderInput(makeRequest(), baseBody({ couponId: "c1", paymentMethod: "cash" })),
      400,
      "coupon_invalid"
    )
  })

  it("rejeita cupom esgotado", async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue({
      id: "c1",
      establishmentId: "est-1",
      available: true,
      usageLimit: 1,
      timesUsed: 1,
    })
    await expectOrderError(
      buildOrderInput(makeRequest(), baseBody({ couponId: "c1", paymentMethod: "cash" })),
      400,
      "coupon_exhausted"
    )
  })

  it("rejeita cupom indisponível", async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue({
      id: "c1",
      establishmentId: "est-1",
      available: false,
      usageLimit: 10,
      timesUsed: 0,
    })
    await expectOrderError(
      buildOrderInput(makeRequest(), baseBody({ couponId: "c1", paymentMethod: "cash" })),
      400,
      "coupon_unavailable"
    )
  })

  it("aceita cupom válido e NÃO aplica couponDiscount do body", async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue({
      id: "c1",
      establishmentId: "est-1",
      available: true,
      usageLimit: 10,
      timesUsed: 0,
      type: "todos",
      conditionValue: 0,
    })
    const input = await buildOrderInput(
      makeRequest(),
      baseBody({ couponId: "c1", couponDiscount: 99999, paymentMethod: "cash" })
    )
    expect(input.couponId).toBe("c1")
    // subtotal permanece o preço real — desconto do body é ignorado
    expect(input.subtotal).toBe(60)
  })
})

describe("buildOrderInput — F6B-018 agendamento", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyAuth.mockReturnValue(null)
    mockPrisma.establishment.findUnique.mockResolvedValue(
      baseEstablishment({ scheduledMinHours: 2, scheduledMaxAdvanceDays: 30 })
    )
    mockPrisma.product.findMany.mockResolvedValue([product1()])
    mockPrisma.coupon.findUnique.mockResolvedValue(null)
  })

  it("rejeita data no passado", async () => {
    await expectOrderError(
      buildOrderInput(
        makeRequest(),
        baseBody({
          paymentMethod: "cash",
          isScheduled: true,
          deliveryDate: new Date(Date.now() - 3600000).toISOString(),
        })
      ),
      400,
      "scheduled_must_be_future"
    )
  })

  it("rejeita com pouca antecedência", async () => {
    await expectOrderError(
      buildOrderInput(
        makeRequest(),
        baseBody({
          paymentMethod: "cash",
          isScheduled: true,
          deliveryDate: new Date(Date.now() + 30 * 60000).toISOString(), // 30min < 2h
        })
      ),
      400,
      "scheduled_too_soon"
    )
  })

  it("rejeita além da antecedência máxima", async () => {
    await expectOrderError(
      buildOrderInput(
        makeRequest(),
        baseBody({
          paymentMethod: "cash",
          isScheduled: true,
          deliveryDate: new Date(Date.now() + 40 * 24 * 3600000).toISOString(),
        })
      ),
      400,
      "scheduled_too_far"
    )
  })

  it("aceita agendamento válido e pula check de isOpen", async () => {
    mockPrisma.establishment.findUnique.mockResolvedValue(
      baseEstablishment({ isOpenOverride: false, scheduledMinHours: 1 })
    )
    const input = await buildOrderInput(
      makeRequest(),
      baseBody({
        paymentMethod: "cash",
        isScheduled: true,
        deliveryDate: new Date(Date.now() + 3 * 3600000).toISOString(),
      })
    )
    expect(input.isScheduled).toBe(true)
    expect(input.deliveryDate).toBeInstanceOf(Date)
  })
})

describe("buildOrderInput — taxa, mínimo e total server-side", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyAuth.mockReturnValue(null)
    mockPrisma.product.findMany.mockResolvedValue([product1()])
    mockPrisma.coupon.findUnique.mockResolvedValue(null)
  })

  it("recalcula taxa de entrega e ignora body.deliveryFee", async () => {
    mockPrisma.establishment.findUnique.mockResolvedValue(
      baseEstablishment({ deliveryFeeType: "fixed", deliveryFeeAmount: 7.5 })
    )
    const input = await buildOrderInput(
      makeRequest(),
      baseBody({ deliveryFee: 0, paymentMethod: "cash" })
    )
    expect(input.deliveryFee).toBe(7.5)
    expect(input.subtotal).toBe(60)
  })

  it("free_above zera taxa acima do limiar", async () => {
    mockPrisma.establishment.findUnique.mockResolvedValue(
      baseEstablishment({ deliveryFeeType: "free_above", deliveryFreeAbove: 50, deliveryFeeAmount: 10 })
    )
    const input = await buildOrderInput(
      makeRequest(),
      baseBody({ paymentMethod: "cash" })
    )
    expect(input.deliveryFee).toBe(0)
  })

  it("rejeita abaixo do pedido mínimo", async () => {
    mockPrisma.establishment.findUnique.mockResolvedValue(
      baseEstablishment({
        minimumOrderEnabled: true,
        minimumOrderValue: 100,
        minimumOrderApplyToDelivery: true,
      })
    )
    await expectOrderError(
      buildOrderInput(makeRequest(), baseBody({ paymentMethod: "cash" })),
      400,
      "minimum_order_not_reached"
    )
  })

  it("aceita payload do bot sem total (servidor recalcula)", async () => {
    mockPrisma.establishment.findUnique.mockResolvedValue(baseEstablishment())
    const body = baseBody({ method: "bot", paymentMethod: "cash" })
    delete (body as any).total
    const input = await buildOrderInput(makeRequest(), body)
    expect(input.subtotal).toBe(60)
    expect(input.deliveryFee).toBe(5)
  })

  it("ignora changeFor em pagamento online", async () => {
    mockPrisma.establishment.findUnique.mockResolvedValue(baseEstablishment())
    const input = await buildOrderInput(
      makeRequest(),
      baseBody({ paymentMethod: "pix", changeFor: 100 })
    )
    expect(input.changeFor).toBeNull()
  })

  it("aceita changeFor em dinheiro", async () => {
    mockPrisma.establishment.findUnique.mockResolvedValue(baseEstablishment())
    const input = await buildOrderInput(
      makeRequest(),
      baseBody({ paymentMethod: "cash", changeFor: 100 })
    )
    expect(input.changeFor).toBe(100)
  })

  it("normaliza item que usa productId (PDV) em vez de id", async () => {
    mockPrisma.establishment.findUnique.mockResolvedValue(baseEstablishment())
    const input = await buildOrderInput(
      makeRequest(),
      baseBody({
        orderType: "presencial",
        paymentMethod: "pending",
        method: "tablet",
        status: "new",
        items: [{ productId: "prod-1", name: "Hambúrguer", price: 30, quantity: 1 }],
      })
    )
    expect(input.items[0].id).toBe("prod-1")
    expect(input.items[0].productId).toBe("prod-1")
  })

  it("rejeita estabelecimento inexistente", async () => {
    mockPrisma.establishment.findUnique.mockResolvedValue(null)
    await expectOrderError(
      buildOrderInput(makeRequest(), baseBody()),
      404,
      "establishment_not_found"
    )
  })
})
