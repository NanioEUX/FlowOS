import { prisma } from "@/lib/prisma"

// Meta Brazil pricing per conversation (BRL)
const META_PRICING = {
  marketing: 0.34,   // Disparos em massa, campanhas
  utility: 0.04,     // Notificações de sistema, código Pix
  service: 0.0,      // Cliente inicia a conversa (grátis)
}

const TIER_LIMITS: Record<string, number> = {
  TIER_250: 250,
  TIER_1K: 1000,
  TIER_10K: 10000,
  TIER_100K: 100000,
  TIER_UNLIMITED: 999999,
}

interface QuotaInfo {
  messagingLimit: number
  currentUsage: number
  usagePercent: number
  tier: string
  estimatedCost: number
  isBlocked: boolean
  needsVerification: boolean
}

export async function getQuotaInfo(establishmentId: string): Promise<QuotaInfo | null> {
  const est = await prisma.establishment.findUnique({
    where: { id: establishmentId },
    select: {
      metaBusinessAccountId: true,
      metaAccessToken: true,
      whatsappProvider: true,
      messagingLimit: true,
      currentUsage: true,
      estimatedCostMonth: true,
      lastQuotaCheck: true,
    },
  })

  if (!est || est.whatsappProvider !== "meta" || !est.metaBusinessAccountId || !est.metaAccessToken) {
    return null
  }

  const limit = est.messagingLimit || 250
  const usage = est.currentUsage || 0
  const usagePercent = limit > 0 ? Math.round((usage / limit) * 100) : 0

  return {
    messagingLimit: limit,
    currentUsage: usage,
    usagePercent,
    tier: getTierName(limit),
    estimatedCost: est.estimatedCostMonth || 0,
    isBlocked: usagePercent >= 100,
    needsVerification: usagePercent >= 80,
  }
}

export async function refreshQuotaFromMeta(establishmentId: string): Promise<QuotaInfo | null> {
  const est = await prisma.establishment.findUnique({
    where: { id: establishmentId },
    select: {
      metaBusinessAccountId: true,
      metaAccessToken: true,
      whatsappProvider: true,
    },
  })

  if (!est || est.whatsappProvider !== "meta" || !est.metaBusinessAccountId || !est.metaAccessToken) {
    return null
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${est.metaBusinessAccountId}?fields=messaging_limit_tier`,
      { headers: { Authorization: `Bearer ${est.metaAccessToken}` } }
    )
    const data = await res.json()

    if (!res.ok || !data.messaging_limit_tier) {
      console.error("[Meta Quota] Failed to fetch:", data.error?.message)
      return null
    }

    const tier = data.messaging_limit_tier // e.g. "TIER_250"
    const limit = TIER_LIMITS[tier] || 250

    // Also fetch current usage from conversations endpoint
    const since = Math.floor(Date.now() / 1000) - 86400 // last 24h
    const convRes = await fetch(
      `https://graph.facebook.com/v21.0/${est.metaBusinessAccountId}/conversations?since=${since}&limit=0`,
      { headers: { Authorization: `Bearer ${est.metaAccessToken}` } }
    )
    const convData = await convRes.json()
    const usage = convData.data?.length || 0

    // Get current month's cost estimate
    const cost = await getMonthCost(establishmentId)

    await prisma.establishment.update({
      where: { id: establishmentId },
      data: {
        messagingLimit: limit,
        currentUsage: usage,
        estimatedCostMonth: cost,
        lastQuotaCheck: new Date(),
      },
    })

    const usagePercent = limit > 0 ? Math.round((usage / limit) * 100) : 0

    return {
      messagingLimit: limit,
      currentUsage: usage,
      usagePercent,
      tier,
      estimatedCost: cost,
      isBlocked: usagePercent >= 100,
      needsVerification: usagePercent >= 80,
    }
  } catch (err: any) {
    console.error("[Meta Quota] Error:", err.message)
    return null
  }
}

export async function trackMessageCost(
  establishmentId: string,
  messageType: "marketing" | "utility" | "service"
): Promise<void> {
  const price = META_PRICING[messageType]
  if (price === 0) return

  await prisma.establishment.update({
    where: { id: establishmentId },
    data: {
      estimatedCostMonth: { increment: price },
    },
  })
}

async function getMonthCost(establishmentId: string): Promise<number> {
  const est = await prisma.establishment.findUnique({
    where: { id: establishmentId },
    select: { estimatedCostMonth: true },
  })
  return est?.estimatedCostMonth || 0
}

function getTierName(limit: number): string {
  if (limit >= 100000) return "ILIMITADO"
  if (limit >= 10000) return "10K"
  if (limit >= 1000) return "1K"
  return "250"
}

export function getMetaManagerUrl(wabaId: string): string {
  return `https://business.facebook.com/waba/${wabaId}/overview`
}

export { META_PRICING, TIER_LIMITS }
