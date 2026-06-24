import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const ASAAS_API_URL =
  process.env.ASAAS_ENVIRONMENT === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3"

const PLATFORM_API_KEY = process.env.ASAAS_API_KEY || ""

const PLAN_PRICES: Record<string, number> = {
  starter: 49,
  pro: 99,
  enterprise: 199,
}

export async function POST(req: NextRequest) {
  try {
    const { establishmentId, plan } = await req.json()

    if (!establishmentId || !plan) {
      return NextResponse.json({ error: "Dados obrigatórios não informados" }, { status: 400 })
    }

    if (!PLAN_PRICES[plan]) {
      return NextResponse.json({ error: "Plano inválido" }, { status: 400 })
    }

    const establishment = await prisma.establishment.findUnique({
      where: { id: establishmentId },
    })

    if (!establishment) {
      return NextResponse.json({ error: "Estabelecimento não encontrado" }, { status: 404 })
    }

    if (!PLATFORM_API_KEY) {
      // Sandbox mode — activate directly
      const nextPayment = new Date()
      nextPayment.setMonth(nextPayment.getMonth() + 1)

      await prisma.establishment.update({
        where: { id: establishmentId },
        data: {
          subscriptionPlan: plan,
          subscriptionStatus: "active",
          nextPaymentAt: nextPayment,
        },
      })

      return NextResponse.json({
        paid: true,
        message: "Assinatura ativada (sandbox mode)",
      })
    }

    // Production: create payment via Asaas
    // 1. Find or create customer in Asaas
    let asaasCustomerId = establishment.asaasCustomerId

    if (!asaasCustomerId) {
      const customerRes = await fetch(`${ASAAS_API_URL}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: PLATFORM_API_KEY,
        },
        body: JSON.stringify({
          name: establishment.name,
          email: establishment.email,
          mobilePhone: establishment.phone?.replace(/\D/g, "") || "",
          cpfCnpj: "00000000000",
        }),
      })

      const customer = await customerRes.json()

      if (customer.errors) {
        return NextResponse.json({ error: "Erro ao criar cliente no Asaas" }, { status: 500 })
      }

      asaasCustomerId = customer.id

      await prisma.establishment.update({
        where: { id: establishmentId },
        data: { asaasCustomerId },
      })
    }

    // 2. Create payment
    const dueDate = new Date().toISOString().split("T")[0]

    const paymentRes = await fetch(`${ASAAS_API_URL}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: PLATFORM_API_KEY,
      },
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: "UNDEFINED",
        value: PLAN_PRICES[plan],
        dueDate,
        description: `PedeFácil - Plano ${plan.charAt(0).toUpperCase() + plan.slice(1)} - ${establishment.name}`,
        externalReference: establishmentId,
      }),
    })

    const payment = await paymentRes.json()

    if (payment.errors) {
      return NextResponse.json({ error: "Erro ao criar cobrança" }, { status: 500 })
    }

    // 3. Update establishment with pending subscription
    await prisma.establishment.update({
      where: { id: establishmentId },
      data: {
        subscriptionPlan: plan,
        subscriptionStatus: "pending_payment",
        asaasSubscriptionId: payment.id,
      },
    })

    return NextResponse.json({
      paid: false,
      paymentUrl: payment.invoiceUrl,
      paymentId: payment.id,
    })
  } catch (error) {
    console.error("Subscription error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
