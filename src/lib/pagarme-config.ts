import { prisma } from "@/lib/prisma"

interface PagarmeConfig {
  apiKey: string
  webhookKey: string
  webhookUrl: string
  environment: string
  feePercentage: number
  saasProfitPercentage: number
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
        webhookUrl: parsed.webhookUrl || (process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/pagarme` : ""),
        environment: parsed.environment || process.env.PAGARME_ENVIRONMENT || "sandbox",
        feePercentage: parsed.feePercentage || 1.09,
        saasProfitPercentage: parsed.saasProfitPercentage || 0.41,
      }
    }
  } catch {}

  if (!cached) {
    cached = {
      apiKey: process.env.PAGARME_API_KEY || "",
      webhookKey: process.env.PAGARME_WEBHOOK_KEY || "",
      webhookUrl: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/pagarme` : "",
      environment: process.env.PAGARME_ENVIRONMENT || "sandbox",
      feePercentage: 1.09,
      saasProfitPercentage: 0.41,
    }
  }

  lastFetch = now
  return cached
}
