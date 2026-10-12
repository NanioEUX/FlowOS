import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireEstablishment } from "@/lib/require-auth"

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

    const auth = requireEstablishment(req, establishmentId)
    if (auth.error) return auth.error

    if (!PLAN_PRICES[plan]) {
      return NextResponse.json({ error: "Plano inválido" }, { status: 400 })
    }

    const establishment = await prisma.establishment.findUnique({
      where: { id: establishmentId },
    })

    if (!establishment) {
      return NextResponse.json({ error: "Estabelecimento não encontrado" }, { status: 404 })
    }

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
      message: "Assinatura ativada",
    })
  } catch (error) {
    console.error("Subscription error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
