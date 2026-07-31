import webpush from "web-push"
import { prisma } from "@/lib/prisma"

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@flowos.fs.app"

let configured = false

function ensureConfigured() {
  if (configured) return
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.warn("[Push] VAPID keys não configuradas")
    return
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
  configured = true
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  icon?: string
  badge?: string
  tag?: string
}

/**
 * Envia push para todas as subscriptions do cliente/estabelecimento.
 */
export async function sendPush(
  establishmentId: string,
  customerKey: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  ensureConfigured()
  if (!configured) return { sent: 0, failed: 0 }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { establishmentId, customerKey },
  })

  if (subscriptions.length === 0) return { sent: 0, failed: 0 }

  let sent = 0
  let failed = 0

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        )
        sent++
        await prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { lastUsedAt: new Date() },
        })
      } catch (e: any) {
        failed++
        // Subscription expirou: remove
        if (e.statusCode === 404 || e.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        }
      }
    })
  )

  return { sent, failed }
}

export function getVapidPublicKey(): string | null {
  return VAPID_PUBLIC || null
}
