import { prisma } from "@/lib/prisma"

interface PagarmeConfig {
  apiKey: string
  webhookKey: string
  environment: string
}

let cached: PagarmeConfig | null = null
let lastFetch = 0

export async function getPagarmeConfig(): Promise<PagarmeConfig> {
  const now = Date.now()
  if (cached && now - lastFetch < 60_000) return cached

  try {
    const config = await prisma.$queryRaw<{ value: string }[]>`
      SELECT "value" FROM "SystemConfig" WHERE "key" = 'pagarme_config' LIMIT 1
    `
    if (config.length > 0) {
      const parsed = JSON.parse(config[0].value)
      cached = {
        apiKey: parsed.apiKey || process.env.PAGARME_API_KEY || "",
        webhookKey: parsed.webhookKey || process.env.PAGARME_WEBHOOK_KEY || "",
        environment: parsed.environment || process.env.PAGARME_ENVIRONMENT || "sandbox",
      }
    }
  } catch {}

  if (!cached) {
    cached = {
      apiKey: process.env.PAGARME_API_KEY || "",
      webhookKey: process.env.PAGARME_WEBHOOK_KEY || "",
      environment: process.env.PAGARME_ENVIRONMENT || "sandbox",
    }
  }

  lastFetch = now
  return cached
}
