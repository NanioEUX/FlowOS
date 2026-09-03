import { NextResponse } from "next/server"
import { getSaasAdmin } from "@/lib/saas-admin-auth"
import { prisma } from "@/lib/prisma"
import { getPagarmeConfig } from "@/lib/pagarme-config"

export async function GET() {
  const admin = await getSaasAdmin()
  if (!admin) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const config = await getPagarmeConfig()

  return NextResponse.json({
    ok: true,
    pagarmeApiKey: config.apiKey,
    pagarmeWebhookKey: config.webhookKey,
    pagarmeEnvironment: config.environment,
    pagarmeFeePercentage: config.feePercentage || 1.09,
    saasProfitPercentage: config.saasProfitPercentage || 0.41,
  })
}

export async function POST(req: Request) {
  const admin = await getSaasAdmin()
  if (!admin) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const { pagarmeApiKey, pagarmeWebhookKey, pagarmeEnvironment, pagarmeFeePercentage, saasProfitPercentage } = await req.json()

    if (!pagarmeApiKey) {
      return NextResponse.json({ error: "API Key é obrigatória" }, { status: 400 })
    }

    const configKey = "pagarme_config"
    const configValue = JSON.stringify({
      apiKey: pagarmeApiKey,
      webhookKey: pagarmeWebhookKey,
      environment: pagarmeEnvironment,
      feePercentage: pagarmeFeePercentage || 1.09,
      saasProfitPercentage: saasProfitPercentage || 0.41,
    })

    await prisma.$executeRaw`
      INSERT INTO "SystemConfig" ("key", "value", "updatedAt")
      VALUES (${configKey}, ${configValue}, NOW())
      ON CONFLICT ("key") DO UPDATE SET "value" = ${configValue}, "updatedAt" = NOW()
    `

    return NextResponse.json({ ok: true, message: "Configuração salva com sucesso!" })
  } catch (error: any) {
    console.error("[SaasAdmin Pagamentos]", error)
    return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 })
  }
}
