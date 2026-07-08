const ASAAS_API_URL =
  process.env.ASAAS_ENVIRONMENT === "sandbox"
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3"

interface SplitRule {
  walletId: string
  percentual: number
  description?: string
}

interface AsaasPaymentResponse {
  id: string
  invoiceUrl: string
  bankSlipUrl?: string
  status: string
}

export async function createPaymentLink({
  apiKey,
  customerName,
  customerPhone,
  customerCpf,
  value,
  description,
  billingType,
  dueDate,
  splitRules,
}: {
  apiKey: string
  customerName: string
  customerPhone: string
  customerCpf: string
  value: number
  description: string
  billingType?: "PIX" | "CREDIT_CARD" | "BOLETO" | "UNDEFINED"
  dueDate?: string
  splitRules?: SplitRule[]
}): Promise<AsaasPaymentResponse> {
  const due = dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  const rawPhone = customerPhone.replace(/\D/g, "")
  const formattedPhone = rawPhone.length === 11
    ? `(${rawPhone.slice(0, 2)}) ${rawPhone.slice(2, 7)}-${rawPhone.slice(7)}`
    : rawPhone.length === 10
      ? `(${rawPhone.slice(0, 2)}) ${rawPhone.slice(2, 6)}-${rawPhone.slice(6)}`
      : rawPhone

  const customerBody: any = {
    name: customerName,
    mobilePhone: formattedPhone,
  }
  if (customerCpf) {
    customerBody.cpfCnpj = customerCpf.replace(/\D/g, "")
  }

  console.log("[Asaas] URL:", ASAAS_API_URL)
  console.log("[Asaas] Criando cliente:", { name: customerBody.name, phone: formattedPhone, cpfCnpj: customerBody.cpfCnpj || "NENHUM" })

  // First, try to find existing customer by phone
  let customer: any = null
  const searchRes = await fetch(`${ASAAS_API_URL}/customers?mobilePhone=${encodeURIComponent(formattedPhone)}`, {
    headers: { access_token: apiKey },
  })
  const searchList = await searchRes.json()
  if (searchRes.ok && searchList.data && searchList.data.length > 0) {
    customer = searchList.data[0]
    console.log("[Asaas] Cliente encontrado:", customer.id)

    // Update CPF if provided and customer doesn't have one
    if (customerBody.cpfCnpj && !customer.cpfCnpj) {
      await fetch(`${ASAAS_API_URL}/customers/${customer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", access_token: apiKey },
        body: JSON.stringify({ cpfCnpj: customerBody.cpfCnpj }),
      })
    }
  }

  // If not found, create new
  if (!customer) {
    const customerRes = await fetch(`${ASAAS_API_URL}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: apiKey },
      body: JSON.stringify(customerBody),
    })

    customer = await customerRes.json()
    console.log("[Asaas] Resposta cliente:", JSON.stringify({ ok: customerRes.ok, id: customer.id, errors: customer.errors }))

    if (!customerRes.ok || !customer.id) {
      console.error("[Asaas] FALHA cliente:", JSON.stringify(customer))
      throw new Error(`Falha ao criar cliente: ${customer.errors?.[0]?.description || customer.detail || JSON.stringify(customer)}`)
    }
  }

  const paymentBody: any = {
    customer: customer.id,
    billingType: billingType || "UNDEFINED",
    value,
    dueDate: due,
    description: description.substring(0, 200),
    externalReference: description,
  }

  if (customerCpf) {
    paymentBody.cpfCnpj = customerCpf.replace(/\D/g, "")
  }

  console.log("[Asaas] Criando pagamento:", { customerId: customer.id, value, billingType: billingType || "UNDEFINED" })

  const paymentRes = await fetch(`${ASAAS_API_URL}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: apiKey },
    body: JSON.stringify(paymentBody),
  })

  const payment = await paymentRes.json()
  console.log("[Asaas] Resposta pagamento:", JSON.stringify({ ok: paymentRes.ok, id: payment.id, status: payment.status, errors: payment.errors }))

  if (!paymentRes.ok || !payment.id) {
    console.error("[Asaas] FALHA pagamento:", JSON.stringify(payment))
    throw new Error(`Falha ao criar cobrança: ${payment.errors?.[0]?.description || payment.detail || JSON.stringify(payment)}`)
  }

  return {
    id: payment.id,
    invoiceUrl: payment.invoiceUrl,
    bankSlipUrl: payment.bankSlipUrl,
    status: payment.status,
  }
}
