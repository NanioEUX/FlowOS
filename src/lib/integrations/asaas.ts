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
  dueDate,
  splitRules,
}: {
  apiKey: string
  customerName: string
  customerPhone: string
  customerCpf: string
  value: number
  description: string
  dueDate?: string
  splitRules?: SplitRule[]
}): Promise<AsaasPaymentResponse> {
  const due = dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  console.log("[Asaas] URL:", ASAAS_API_URL, "| Criando cliente para:", customerName, "| Valor:", value)

  const customerBody: any = {
    name: customerName,
    mobilePhone: customerPhone.replace(/\D/g, ""),
  }
  if (customerCpf) {
    customerBody.cpfCnpj = customerCpf.replace(/\D/g, "")
  }

  const customerRes = await fetch(`${ASAAS_API_URL}/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: apiKey },
    body: JSON.stringify(customerBody),
  })

  const customer = await customerRes.json()

  if (!customerRes.ok || !customer.id) {
    console.error("Erro ao criar cliente Asaas:", JSON.stringify(customer))
    throw new Error(`Falha ao criar cliente no Asaas: ${customer.errors?.[0]?.description || customer.detail || customerRes.status}`)
  }

  const paymentBody: any = {
    customer: customer.id,
    billingType: "UNDEFINED",
    value,
    dueDate: due,
    description: description.substring(0, 200),
    externalReference: description,
  }

  if (splitRules && splitRules.length > 0) {
    paymentBody.split = splitRules.map((r) => ({
      walletId: r.walletId,
      percentual: r.percentual,
      description: r.description || "Divisão de pagamento",
    }))
  }

  const paymentRes = await fetch(`${ASAAS_API_URL}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: apiKey },
    body: JSON.stringify(paymentBody),
  })

  const payment = await paymentRes.json()

  if (!paymentRes.ok || !payment.id) {
    console.error("Erro ao criar cobrança Asaas:", JSON.stringify(payment))
    throw new Error(`Falha ao criar cobrança no Asaas: ${payment.errors?.[0]?.description || payment.detail || paymentRes.status}`)
  }

  return {
    id: payment.id,
    invoiceUrl: payment.invoiceUrl,
    bankSlipUrl: payment.bankSlipUrl,
    status: payment.status,
  }
}
