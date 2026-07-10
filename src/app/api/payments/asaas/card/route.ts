import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const ASAAS_API_URL =
  process.env.ASAAS_ENVIRONMENT === "sandbox"
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3"

export async function POST(req: NextRequest) {
  try {
    const { orderId, creditCard, creditCardHolderInfo } = await req.json()

    if (!orderId || !creditCard || !creditCardHolderInfo) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { establishment: { select: { asaasApiKey: true } } },
    })

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    if (!order.paymentId) {
      return NextResponse.json({ error: "Pedido não possui cobrança" }, { status: 400 })
    }

    if (!order.establishment.asaasApiKey) {
      return NextResponse.json({ error: "API Key não configurada" }, { status: 400 })
    }

    const apiKey = order.establishment.asaasApiKey
    console.log("[Card] Processing payment for order:", order.orderNumber)

    // 1. Get the customer from the existing payment
    const existingPaymentRes = await fetch(`${ASAAS_API_URL}/payments/${order.paymentId}`, {
      headers: { access_token: apiKey },
    })

    let customerId: string | null = null
    let customerName = order.customerName || ""
    let customerPhone = order.customerPhone || ""
    let customerCpf = ""

    if (existingPaymentRes.ok) {
      const existingPayment = await existingPaymentRes.json()
      customerId = existingPayment.customer
      console.log("[Card] Found customer from existing payment:", customerId)
    }

    // If no customer from payment, find/create by CPF
    if (!customerId && creditCardHolderInfo.cpf) {
      customerCpf = creditCardHolderInfo.cpf.replace(/\D/g, "")
      const searchRes = await fetch(`${ASAAS_API_URL}/customers?cpfCnpj=${customerCpf}`, {
        headers: { access_token: apiKey },
      })
      const searchList = await searchRes.json()
      if (searchRes.ok && searchList.data && searchList.data.length > 0) {
        customerId = searchList.data[0].id
      }
    }

    // If still no customer, find by phone
    if (!customerId && customerPhone) {
      const rawPhone = customerPhone.replace(/\D/g, "")
      const formattedPhone = rawPhone.length === 11
        ? `(${rawPhone.slice(0, 2)}) ${rawPhone.slice(2, 7)}-${rawPhone.slice(7)}`
        : rawPhone.length === 10
          ? `(${rawPhone.slice(0, 2)}) ${rawPhone.slice(2, 6)}-${rawPhone.slice(6)}`
          : rawPhone
      const searchRes = await fetch(`${ASAAS_API_URL}/customers?mobilePhone=${encodeURIComponent(formattedPhone)}`, {
        headers: { access_token: apiKey },
      })
      const searchList = await searchRes.json()
      if (searchRes.ok && searchList.data && searchList.data.length > 0) {
        customerId = searchList.data[0].id
      }
    }

    // Last resort: create customer
    if (!customerId) {
      const rawPhone = customerPhone.replace(/\D/g, "")
      const formattedPhone = rawPhone.length === 11
        ? `(${rawPhone.slice(0, 2)}) ${rawPhone.slice(2, 7)}-${rawPhone.slice(7)}`
        : rawPhone.length === 10
          ? `(${rawPhone.slice(0, 2)}) ${rawPhone.slice(2, 6)}-${rawPhone.slice(6)}`
          : rawPhone
      const customerRes = await fetch(`${ASAAS_API_URL}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", access_token: apiKey },
        body: JSON.stringify({
          name: creditCardHolderInfo.name || customerName,
          mobilePhone: formattedPhone,
          cpfCnpj: creditCardHolderInfo.cpf?.replace(/\D/g, "") || "",
        }),
      })
      const customerData = await customerRes.json()
      if (!customerRes.ok || !customerData.id) {
        console.error("[Card] Failed to create customer:", JSON.stringify(customerData))
        return NextResponse.json({ error: `Erro ao criar cliente: ${customerData.errors?.[0]?.description || "desconhecido"}` }, { status: 500 })
      }
      customerId = customerData.id
      console.log("[Card] Created new customer:", customerId)
    }

    // 2. Cancel the old PIX payment (ignore errors if already cancelled)
    await fetch(`${ASAAS_API_URL}/payments/${order.paymentId}/cancel`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", access_token: apiKey },
    }).catch(() => {})
    console.log("[Card] Cancelled old payment:", order.paymentId)

    // 3. Create new CREDIT_CARD payment with card details
    const itemNames = (() => {
      try {
        const items = JSON.parse(order.items)
        return items.map((i: any) => `${i.name} x${i.quantity}`).join(", ")
      } catch { return `Pedido #${order.orderNumber}` }
    })()

    const newPaymentRes = await fetch(`${ASAAS_API_URL}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: apiKey },
      body: JSON.stringify({
        customer: customerId,
        billingType: "CREDIT_CARD",
        value: order.total,
        dueDate: new Date().toISOString().split("T")[0],
        description: `Pedido #${order.orderNumber} - ${itemNames}`.substring(0, 200),
        creditCard: {
          creditCardNumber: creditCard.number.replace(/\s/g, ""),
          creditCardBrand: detectCardBrand(creditCard.number),
          creditCardExpirationMonth: creditCard.expiry.split("/")[0],
          creditCardExpirationYear: `20${creditCard.expiry.split("/")[1]}`,
          creditCardHolder: creditCardHolderInfo.name,
          creditCardCvv: creditCard.cvv,
        },
        creditCardHolderInfo: {
          name: creditCardHolderInfo.name,
          cpfCnpj: creditCardHolderInfo.cpf?.replace(/\D/g, "") || "",
          email: creditCardHolderInfo.email || "",
          phone: creditCardHolderInfo.phone?.replace(/\D/g, "") || "",
          postalCode: creditCardHolderInfo.cep?.replace(/\D/g, "") || "",
          addressNumber: creditCardHolderInfo.number || "",
        },
      }),
    })

    const newPayment = await newPaymentRes.json()
    console.log("[Card] New payment created:", newPayment.id, "status:", newPayment.status, JSON.stringify(newPayment.errors || {}))

    if (!newPaymentRes.ok || !newPayment.id) {
      return NextResponse.json({
        error: newPayment.errors?.[0]?.description || `Erro ao criar cobrança cartão (${newPaymentRes.status})`,
        status: "error",
        details: newPayment,
      })
    }

    // 4. Update order with new paymentId
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentId: newPayment.id },
    })

    // 5. Authorize the payment (may fail in sandbox)
    const isSandbox = process.env.ASAAS_ENVIRONMENT === "sandbox"
    let finalStatus = newPayment.status

    try {
      const authRes = await fetch(`${ASAAS_API_URL}/payments/${newPayment.id}/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", access_token: apiKey },
      })

      if (authRes.ok) {
        const authData = await authRes.json()
        console.log("[Card] Authorized:", authData.status)
        finalStatus = authData.status || finalStatus
      } else {
        const authErr = await authRes.json()
        console.error("[Card] Auth error:", authRes.status, JSON.stringify(authErr))
        // In sandbox, authorization may not be available - treat PENDING as OK
        if (isSandbox && finalStatus === "PENDING") {
          console.log("[Card] Sandbox: treating PENDING as AUTHORIZED")
          finalStatus = "AUTHORIZED"
        }
      }
    } catch (e: any) {
      console.error("[Card] Auth exception:", e.message)
      if (isSandbox && finalStatus === "PENDING") {
        finalStatus = "AUTHORIZED"
      }
    }

    const statusMap: Record<string, string> = {
      PENDING: "pending",
      CONFIRMED: "paid",
      RECEIVED: "paid",
      AUTHORIZED: "paid",
      REFUSED: "refused",
      RECEIVED_IN_CASH: "paid",
    }

    const paymentStatus = statusMap[finalStatus] || "pending"

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus,
        status: paymentStatus === "paid" ? "confirmed" : order.status,
      },
    })

    return NextResponse.json({
      status: finalStatus,
      paymentStatus,
      transactionId: newPayment.transactionReceiptUrl || null,
    })
  } catch (error: any) {
    console.error("[Card] Error:", error.message, error.stack)
    return NextResponse.json({ error: `Erro ao processar pagamento: ${error.message}` }, { status: 500 })
  }
}

function detectCardBrand(number: string): string {
  const num = number.replace(/\s/g, "")
  if (num.startsWith("4")) return "VISA"
  if (/^5[1-5]/.test(num) || /^2[2-7]/.test(num)) return "MASTERCARD"
  if (num.startsWith("37") || num.startsWith("34")) return "AMEX"
  if (num.startsWith("6")) return "ELO"
  if (num.startsWith("38") || num.startsWith("39")) return "HIPERCARD"
  return "MASTERCARD"
}
