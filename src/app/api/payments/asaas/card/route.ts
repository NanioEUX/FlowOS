import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const ASAAS_API_URL =
  process.env.ASAAS_ENVIRONMENT === "sandbox"
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3"

export async function POST(req: NextRequest) {
  try {
    const { orderId, creditCard, creditCardHolderInfo, billingType } = await req.json()

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

    console.log("[Card] Processing payment for order:", order.orderNumber)

    // Update payment with credit card info
    const updateRes = await fetch(`${ASAAS_API_URL}/payments/${order.paymentId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        access_token: order.establishment.asaasApiKey,
      },
      body: JSON.stringify({
        billingType: billingType || "CREDIT_CARD",
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

    if (!updateRes.ok) {
      const err = await updateRes.json()
      console.error("[Card] Asaas error:", JSON.stringify(err))
      return NextResponse.json({
        error: err.errors?.[0]?.description || "Erro ao processar cartão",
        status: "error",
      })
    }

    const payment = await updateRes.json()
    console.log("[Card] Payment updated:", payment.id, payment.status)

    // Now authorize the payment
    const authRes = await fetch(`${ASAAS_API_URL}/payments/${order.paymentId}/authorize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: order.establishment.asaasApiKey,
      },
    })

    let authData: any = null
    if (authRes.ok) {
      authData = await authRes.json()
      console.log("[Card] Authorized:", authData.status)
    } else {
      authData = await authRes.json()
      console.error("[Card] Auth error:", JSON.stringify(authData))
    }

    const statusMap: Record<string, string> = {
      PENDING: "pending",
      CONFIRMED: "paid",
      RECEIVED: "paid",
      AUTHORIZED: "paid",
      REFUSED: "refused",
      RECEIVED_IN_CASH: "paid",
    }

    const finalStatus = authData?.status || payment.status
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
      transactionId: payment.transactionReceiptUrl || null,
    })
  } catch (error: any) {
    console.error("[Card] Error:", error.message)
    return NextResponse.json({ error: "Erro ao processar pagamento" }, { status: 500 })
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
