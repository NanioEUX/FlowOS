const PAGARME_API_URL =
  process.env.PAGARME_ENVIRONMENT === "sandbox"
    ? "https://api.pagar.me/core/v5"
    : "https://api.pagar.me/core/v5"

function getAuthHeaders(apiKey: string) {
  return {
    "Authorization": `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
    "Content-Type": "application/json",
  }
}

interface PagarmeCustomer {
  id: string
  name: string
  email: string
  type: string
}

interface PagarmeTransactionResponse {
  id: string
  status: string
  amount: number
  payment_method: string
  pix_qr_code?: string
  pix_payload?: string
  pix_expiration_date?: string
  boleto_url?: string
  card?: {
    checkout_url?: string
    installments?: number
  }
  charges?: Array<{
    id: string
    status: string
    payment_method: string
    pix_qr_code?: string
    qr_code_url?: string
    pix_payload?: string
    last_transaction_status?: string
    last_transaction?: {
      qr_code_url?: string
      pix_qr_code?: string
      pix_payload?: string
    }
    boleto?: { url?: string }
    card?: { transaction_id?: string }
  }>
}

interface SplitRule {
  recipientId: string
  type: "percentage" | "amount"
  amount: number
  options?: {
    chargeProcessingFee?: boolean
    chargeRemainderFee?: boolean
    liable?: boolean
  }
}

// Tokeniza cartão raw via API Pagar.me (POST /cards).
// Retorna um card_id que pode ser usado em credit_card.card_id.
// Necessário porque a V5 rejeita cartão raw por padrão (PCI-DSS).
export async function createPagarmeCardToken({
  apiKey,
  number,
  holderName,
  expMonth,
  expYear,
  cvv,
  billingAddress,
}: {
  apiKey: string
  number: string
  holderName: string
  expMonth: number
  expYear: number
  cvv: string
  billingAddress: {
    line_1: string
    zip_code: string
    city: string
    state: string
    country: string
    line_2?: string
  }
}): Promise<string> {
  const body = {
    number: number.replace(/\s/g, ""),
    holder_name: holderName,
    exp_month: expMonth,
    exp_year: expYear,
    cvv,
    billing_address: billingAddress,
  }

  const res = await fetch(`${PAGARME_API_URL}/cards`, {
    method: "POST",
    headers: getAuthHeaders(apiKey),
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!res.ok || !data.id) {
    console.error("[Pagar.me] FALHA tokenização:", JSON.stringify(data))
    throw new Error(`Falha ao tokenizar cartão: ${data.message || data.errors?.[0]?.message || JSON.stringify(data)}`)
  }
  return data.id as string
}

// Tokeniza cartão raw via API Pagar.me (POST /cards).
// Retorna um card_id que pode ser usado em credit_card.card_id.
// Necessário porque a V5 rejeita cartão raw por padrão (PCI-DSS).
// NOTA: a V5 NÃO expõe POST /cards para tokenização server-side.
// Use o SDK client-side (pagarme.js CDN → PagarMe.encryptCard) no front.
async function _unused_createPagarmeCardToken_DISABLED() {
  // Mantido apenas como referência; não chamar.
}

export async function createPagarmeCustomer({
  apiKey,
  name,
  email,
  phone,
  document,
}: {
  apiKey: string
  name: string
  email: string
  phone?: string
  document?: string
}): Promise<PagarmeCustomer> {
  const body: any = {
    name,
    email,
    type: "individual",
  }
  if (phone) {
    const raw = phone.replace(/\D/g, "")
    body.phones = {
      mobile_phone: {
        country_code: "55",
        area_code: raw.slice(0, 2),
        number: raw.slice(2),
      },
    }
  }
  const rawDoc = (document || "").replace(/\D/g, "")
  if (rawDoc) {
    body.document = rawDoc
    body.type = rawDoc.length === 11 ? "individual" : "company"
  }

  console.log("[Pagar.me] Criando cliente:", { name, hasEmail: !!email, hasPhone: !!phone })

  const res = await fetch(`${PAGARME_API_URL}/customers`, {
    method: "POST",
    headers: getAuthHeaders(apiKey),
    body: JSON.stringify(body),
  })

  const data = await res.json()
  console.log("[Pagar.me] Resposta cliente:", JSON.stringify({ ok: res.ok, id: data.id, errors: data.errors }))

  if (!res.ok || !data.id) {
    console.error("[Pagar.me] FALHA cliente:", JSON.stringify(data))
    throw new Error(`Falha ao criar cliente Pagar.me: ${data.message || data.errors?.[0]?.message || JSON.stringify(data)}`)
  }

  return { id: data.id, name: data.name, email: data.email, type: data.type }
}

export async function createPixTransaction({
  apiKey,
  customerId,
  amount,
  description,
  orderId,
  expiresIn,
  splitRules,
}: {
  apiKey: string
  customerId: string
  amount: number
  description: string
  orderId: string
  expiresIn?: number
  splitRules?: SplitRule[]
}): Promise<PagarmeTransactionResponse> {
  const body: any = {
    antifraud_enabled: false,
    options: {
      antifraud: { enabled: false },
    },
    items: [
      {
        id: orderId,
        code: orderId.substring(0, 40),
        description: description.substring(0, 200),
        amount: Math.round(amount * 100),
        quantity: 1,
      },
    ],
    payments: [
      {
        payment_method: "pix",
        pix: {
          expires_in: expiresIn || 3600,
        },
      },
    ],
    customer_id: customerId,
  }

  // Add split rules if provided (V5 format)
  if (splitRules && splitRules.length > 0) {
    body.payments[0].split = splitRules.map((rule: any) => ({
      recipient_id: rule.recipientId,
      type: rule.type || "percentage",
      amount: rule.amount,
      options: {
        charge_processing_fee: rule.options?.chargeProcessingFee ?? false,
        charge_remainder_fee: rule.options?.chargeRemainderFee ?? false,
        liable: rule.options?.liable ?? false,
      },
    }))
  }

  console.log("[Pagar.me] Criando transação PIX:", { customerId, amount, orderId })
  console.log("[Pagar.me] Request body:", JSON.stringify(body))

  const res = await fetch(`${PAGARME_API_URL}/orders`, {
    method: "POST",
    headers: getAuthHeaders(apiKey),
    body: JSON.stringify(body),
  })

  const text = await res.text()
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    console.error("[Pagar.me] Resposta não-JSON:", text.substring(0, 500))
    throw new Error(`Pagar.me retornou erro: ${text.substring(0, 200)}`)
  }
  console.log("[Pagar.me] Resposta transação:", JSON.stringify({ ok: res.ok, id: data.id, status: data.status }))

  if (!res.ok || !data.id) {
    console.error("[Pagar.me] FALHA transação:", JSON.stringify(data))
    throw new Error(`Falha ao criar transação PIX: ${data.message || data.errors?.[0]?.message || JSON.stringify(data)}`)
  }

  return data as PagarmeTransactionResponse
}

export async function createCardTransaction({
  apiKey,
  customerId,
  amount,
  description,
  orderId,
  cardToken,
  creditCard,
  creditCardHolderInfo,
  installments,
  splitRules,
  clientIp,
}: {
  apiKey: string
  customerId: string
  amount: number
  description: string
  orderId: string
  cardToken?: string
  creditCard?: { number: string; expiry: string; cvv: string }
  creditCardHolderInfo?: {
    name: string
    cpf: string
    email: string
    phone?: string
    cep?: string
    number?: string
    address?: string
    city?: string
    state?: string
    neighborhood?: string
    street?: string
    complement?: string
    // shipping (entrega) separado do billing
    shippingStreet?: string
    shippingNumber?: string
    shippingNeighborhood?: string
    shippingCity?: string
    shippingState?: string
    shippingCep?: string
    shippingRecipientName?: string
  }
  installments?: number
  splitRules?: SplitRule[]
  clientIp?: string
}): Promise<PagarmeTransactionResponse> {
  // Build credit card object - support both token and raw card data
  const creditCardObj: any = {
    installments: installments || 1,
    statement_descriptor: "FLOWOS",
  }

  const cepDigits = (creditCardHolderInfo?.cep || "").replace(/\D/g, "") || "00000000"
  const shippingCepDigits = (creditCardHolderInfo?.shippingCep || "").replace(/\D/g, "") || cepDigits

  // Billing address estruturado (formato V5 esperado pelo antifraude)
  const billingAddress: any = {
    line_1: [creditCardHolderInfo?.street || creditCardHolderInfo?.address, creditCardHolderInfo?.number].filter(Boolean).join(", ") || "Não informado",
    zip_code: cepDigits,
    city: creditCardHolderInfo?.city || "Não informado",
    state: creditCardHolderInfo?.state || "SP",
    country: "BR",
  }
  if (creditCardHolderInfo?.neighborhood) {
    billingAddress.line_2 = creditCardHolderInfo.neighborhood
  }

  if (cardToken) {
    // Token já veio do front via SDK Pagar.me (PCI-DSS compliant).
    // Usar direto como card_id.
    creditCardObj.card_id = cardToken
  } else if (creditCard) {
    // Fallback legado: cartão raw. Pagar.me V5 rejeita por padrão.
    // Mantido apenas para compatibilidade — prefira sempre o caminho token.
    const [expMonth, expYear] = creditCard.expiry.split("/")
    creditCardObj.recurrence_cycle = "first"
    creditCardObj.card = {
      number: creditCard.number.replace(/\s/g, ""),
      holder_name: creditCardHolderInfo?.name || "",
      exp_month: parseInt(expMonth, 10),
      exp_year: parseInt(expYear.length === 2 ? `20${expYear}` : expYear, 10),
      cvv: creditCard.cvv,
      billing_address: billingAddress,
    }
  }

  const body: any = {
    antifraud_enabled: false,
    options: {
      antifraud: { enabled: false },
    },
    items: [
      {
        id: orderId,
        code: orderId.substring(0, 40),
        description: description.substring(0, 200),
        amount: Math.round(amount * 100),
        quantity: 1,
      },
    ],
    payments: [
      {
        payment_method: "credit_card",
        credit_card: creditCardObj,
      },
    ],
    customer_id: customerId,
  }

  // Shipping separado (antifraude compara cobrança vs entrega).
  // Sempre envia o shipping (mesmo que vazio), pois o Pagar.me exige
  // description + address como objeto no schema da order.
  body.shipping = {
    name: creditCardHolderInfo?.shippingRecipientName || creditCardHolderInfo?.name || "Cliente",
    recipient_name: creditCardHolderInfo?.shippingRecipientName || creditCardHolderInfo?.name || "Cliente",
    description: description || "Entrega de pedido",
    address: {
      street: creditCardHolderInfo?.shippingStreet || creditCardHolderInfo?.street || creditCardHolderInfo?.address || "Não informado",
      number: creditCardHolderInfo?.shippingNumber || creditCardHolderInfo?.number || "s/n",
      zip_code: shippingCepDigits || "00000000",
      neighborhood: creditCardHolderInfo?.shippingNeighborhood || creditCardHolderInfo?.neighborhood || "Não informado",
      city: creditCardHolderInfo?.shippingCity || creditCardHolderInfo?.city || "Não informado",
      state: creditCardHolderInfo?.shippingState || creditCardHolderInfo?.state || "SP",
      country: "BR",
    },
  }

  // IP do cliente vai dentro de device (formato oficial Pagar.me V5).
  // Só envia device se o IP estiver presente (senão Pagar.me rejeita {}).
  if (clientIp) {
    body.device = {
      ip: clientIp,
      user_agent: "Mozilla/5.0",
    }
  }

  // Add split rules if provided (V5 format)
  if (splitRules && splitRules.length > 0) {
    body.payments[0].split = splitRules.map((rule: any) => ({
      recipient_id: rule.recipientId,
      type: rule.type || "percentage",
      amount: rule.amount,
      options: {
        charge_processing_fee: rule.options?.chargeProcessingFee ?? false,
        charge_remainder_fee: rule.options?.chargeRemainderFee ?? false,
        liable: rule.options?.liable ?? false,
      },
    }))
  }

  // Em cartão de crédito, forçar captura automática para evitar ficar
  // preso em "waiting_capture" sem evento order.paid chegar.
  creditCardObj.capture = true

  console.log("[Pagar.me] Criando transação cartão:", { customerId, amount, installments: installments || 1 })

  const res = await fetch(`${PAGARME_API_URL}/orders`, {
    method: "POST",
    headers: getAuthHeaders(apiKey),
    body: JSON.stringify(body),
  })

  const data = await res.json()
  console.log("[Pagar.me] Resposta transação:", JSON.stringify({ ok: res.ok, id: data.id, status: data.status, charges: data.charges?.map((c: any) => ({ id: c.id, status: c.status, last_transaction_status: c.last_transaction_status })) }))

  if (!res.ok || !data.id) {
    console.error("[Pagar.me] FALHA transação:", JSON.stringify(data))
    throw new Error(`Falha ao criar transação cartão: ${data.message || data.errors?.[0]?.message || JSON.stringify(data)}`)
  }

  // Check charge status for card failures
  const charge = data.charges?.[0]
  if (charge && (charge.status === "failed" || charge.status === "declined" || charge.status === "not_authorized")) {
    const acquirerMsg = charge.last_transaction?.acquirer_message || ""
    const lastTxStatus = charge.last_transaction_status || ""
    const gatewayCode = charge.last_transaction?.gateway_response?.code || ""
    const antifraudStatus = charge.last_transaction?.antifraud_response?.status || ""

    // If acquirer approved or transaction was authorized/captured, treat as success
    const isApproved = acquirerMsg.toLowerCase().includes("aprovad") ||
      acquirerMsg.toLowerCase().includes("sucesso") ||
      lastTxStatus === "authorized" ||
      lastTxStatus === "captured" ||
      lastTxStatus === "waiting_capture" ||
      gatewayCode === "200"

    if (!isApproved) {
      const gatewayErrors = charge.last_transaction?.gateway_response?.errors?.map((e: any) => e.message).join(", ")
      let reason = acquirerMsg || gatewayErrors || lastTxStatus || charge.status
      if (antifraudStatus === "reproved") {
        reason = `Antifraude reprovou a transação (score: ${charge.last_transaction?.antifraud_response?.score || "n/a"}). Tente outro cartão ou entre em contato com a operadora.`
      }
      throw new Error(`Cartao nao autorizado: ${reason}`)
    }
    // If approved but charge status is "failed", continue - webhook will update
    console.log("[Pagar.me] Charge status 'failed' but acquirer approved:", acquirerMsg)
  }

  return data as PagarmeTransactionResponse
}

export function mapPagarmeStatus(status: string): { paymentStatus: string; orderStatus?: string } {
  const map: Record<string, { paymentStatus: string; orderStatus?: string }> = {
    pending: { paymentStatus: "pending" },
    waiting: { paymentStatus: "pending" },
    waiting_capture: { paymentStatus: "paid", orderStatus: "confirmed" },
    unpaid: { paymentStatus: "pending" },
    paid: { paymentStatus: "paid", orderStatus: "confirmed" },
    captured: { paymentStatus: "paid", orderStatus: "confirmed" },
    canceled: { paymentStatus: "cancelled", orderStatus: "cancelled" },
    refused: { paymentStatus: "cancelled" },
    refunded: { paymentStatus: "refunded" },
    pending_review: { paymentStatus: "pending" },
    manual_review: { paymentStatus: "pending" },
    automatiically_reviewed: { paymentStatus: "pending" },
  }
  return map[status] || { paymentStatus: "pending" }
}

export function verifyPagarmeSignature(body: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false
  const crypto = require("crypto")
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex")
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}
