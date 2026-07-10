import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const IS_SANDBOX = process.env.ASAAS_ENVIRONMENT === "sandbox"
const ASAAS_API_URL = IS_SANDBOX
  ? "https://sandbox.asaas.com/api/v3"
  : "https://api.asaas.com/v3"

export async function POST(req: NextRequest) {
  try {
    const { orderId, creditCard, creditCardHolderInfo } = await req.json()
    const remoteIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "127.0.0.1"

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
    console.log("[Card] Processing order:", order.orderNumber)

    // 1. Get customer from existing payment (single call)
    const existingRes = await fetch(`${ASAAS_API_URL}/payments/${order.paymentId}`, {
      headers: { access_token: apiKey },
    })
    const existingPayment = existingRes.ok ? await existingRes.json() : null
    const customerId = existingPayment?.customer

    if (!customerId) {
      return NextResponse.json({ error: "Cliente não encontrado no Asaas" }, { status: 500 })
    }

    // 2. Cancel old payment + Create new CREDIT_CARD payment (parallel)
    const [cancelRes, newPaymentRes] = await Promise.all([
      fetch(`${ASAAS_API_URL}/payments/${order.paymentId}/cancel`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", access_token: apiKey },
      }).catch(() => null),
      fetch(`${ASAAS_API_URL}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", access_token: apiKey },
        body: JSON.stringify({
          customer: customerId,
          billingType: "CREDIT_CARD",
          value: order.total,
          dueDate: new Date().toISOString().split("T")[0],
          description: `Pedido #${order.orderNumber}`.substring(0, 200),
          remoteIp,
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
      }),
    ])

    console.log("[Card] Cancel:", cancelRes?.ok, "| New payment:", newPaymentRes.ok)

    const newPayment = await newPaymentRes.json()
    console.log("[Card] New payment:", newPayment.id, newPayment.status, JSON.stringify(newPayment.errors || {}))

    if (!newPaymentRes.ok || !newPayment.id) {
      return NextResponse.json({
        error: newPayment.errors?.[0]?.description || `Erro ao criar cobrança (${newPaymentRes.status})`,
        status: "error",
      })
    }

    // 3. Update order + try authorize (parallel)
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentId: newPayment.id },
    })

    let finalStatus = newPayment.status
    try {
      const authRes = await fetch(`${ASAAS_API_URL}/payments/${newPayment.id}/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", access_token: apiKey },
      })
      const authText = await authRes.text()
      console.log("[Card] Authorize:", authRes.status, authText.slice(0, 200))
      if (authRes.ok) {
        try { finalStatus = JSON.parse(authText).status || finalStatus } catch {}
      }
    } catch {
      console.log("[Card] Auth failed, keeping:", finalStatus)
    }

    const paymentStatus = ["CONFIRMED", "RECEIVED", "AUTHORIZED"].includes(finalStatus) ? "paid" : "pending"

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus, status: paymentStatus === "paid" ? "confirmed" : order.status },
    })

    return NextResponse.json({ status: finalStatus, paymentStatus })
  } catch (error: any) {
    console.error("[Card] Error:", error.message)
    return NextResponse.json({ error: `Erro: ${error.message}` }, { status: 500 })
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
