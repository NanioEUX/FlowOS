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
  })
}

export async function POST(req: Request) {
  const admin = await getSaasAdmin()
  if (!admin) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const { pagarmeApiKey, pagarmeWebhookKey, pagarmeEnvironment } = await req.json()

    if (!pagarmeApiKey) {
      return NextResponse.json({ error: "API Key é obrigatória" }, { status: 400 })
    }

    // Save to database (SystemConfig table or similar)
    // For now, we'll store in a simple way
    const configKey = "pagarme_config"
    const configValue = JSON.stringify({
      apiKey: pagarmeApiKey,
      webhookKey: pagarmeWebhookKey,
      environment: pagarmeEnvironment,
    })

    // Try to upsert config
    try {
      await prisma.$executeRaw`
        INSERT INTO "SystemConfig" ("key", "value", "updatedAt")
        VALUES (${configKey}, ${configValue}, NOW())
        ON CONFLICT ("key") DO UPDATE SET "value" = ${configValue}, "updatedAt" = NOW()
      `
    } catch {
      // If SystemConfig table doesn't exist, create it
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "SystemConfig" (
          "key" TEXT NOT NULL PRIMARY KEY,
          "value" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL
        )
      `
      await prisma.$executeRaw`
        INSERT INTO "SystemConfig" ("key", "value", "updatedAt")
        VALUES (${configKey}, ${configValue}, NOW())
        ON CONFLICT ("key") DO UPDATE SET "value" = ${configValue}, "updatedAt" = NOW()
      `
    }

    return NextResponse.json({ ok: true, message: "Configuração salva. Reinicie o servidor para aplicar." })
  } catch (error: any) {
    console.error("[SaasAdmin Pagamentos]", error)
    return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 })
  }
}
