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
    items: [
      {
        id: orderId,
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
}: {
  apiKey: string
  customerId: string
  amount: number
  description: string
  orderId: string
  cardToken?: string
  creditCard?: { number: string; expiry: string; cvv: string }
  creditCardHolderInfo?: { name: string; cpf: string; email: string; phone?: string; cep?: string; number?: string }
  installments?: number
  splitRules?: SplitRule[]
}): Promise<PagarmeTransactionResponse> {
  // Build credit card object - support both token and raw card data
  const creditCardObj: any = {
    installments: installments || 1,
    statement_descriptor: "FLOWOS",
  }

  if (cardToken) {
    creditCardObj.card_id = cardToken
  } else if (creditCard) {
    const [expMonth, expYear] = creditCard.expiry.split("/")
    creditCardObj.card = {
      number: creditCard.number.replace(/\s/g, ""),
      holder_name: creditCardHolderInfo?.name || "",
      exp_month: expMonth,
      exp_year: expYear.length === 2 ? `20${expYear}` : expYear,
      cvv: creditCard.cvv,
      document: creditCardHolderInfo?.cpf?.replace(/\D/g, "") || "",
    }
  }

  const body: any = {
    items: [
      {
        id: orderId,
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
  if (charge && (charge.status === "failed" || charge.status === " declined")) {
    const reason = charge.last_transaction_status || charge.status
    throw new Error(`Cartão não autorizado: ${reason}`)
  }

  return data as PagarmeTransactionResponse
}

export function mapPagarmeStatus(status: string): { paymentStatus: string; orderStatus?: string } {
  const map: Record<string, { paymentStatus: string; orderStatus?: string }> = {
    pending: { paymentStatus: "pending" },
    waiting: { paymentStatus: "pending" },
    unpaid: { paymentStatus: "pending" },
    paid: { paymentStatus: "paid", orderStatus: "confirmed" },
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
