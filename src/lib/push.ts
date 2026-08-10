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
 * Normaliza um telefone/key para somente dígitos.
 */
function normalizeKey(key: string): string {
  return key.replace(/\D/g, "")
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
  if (!configured) {
    await logPush(establishmentId, customerKey, payload, "error", 0, 0, "VAPID keys não configuradas")
    return { sent: 0, failed: 0 }
  }

  // Payload push tem limite de ~4096 bytes criptografado. Icon/badge como
  // data URI (logo em base64) estouram esse limite e o servidor devolve 413.
  // Remove icon/badge acima de ~1KB (o sw.js usa fallback local).
  const safePayload: PushPayload = { ...payload }
  if ((safePayload.icon || "").length > 1024) safePayload.icon = undefined
  if ((safePayload.badge || "").length > 1024) safePayload.badge = undefined
  if (JSON.stringify(safePayload).length > 3500) {
    safePayload.icon = undefined
    safePayload.badge = undefined
    safePayload.body = (safePayload.body || "").slice(0, 500)
  }

  const keys = [customerKey, normalizeKey(customerKey)].filter(
    (k, i, arr) => k && arr.indexOf(k) === i
  )
  // Fallback: subscription registrada sem identificação do cliente ("anonymous").
  // Sem isso, um pedido feito com telefone real nunca encontra a subscription.
  keys.push("anonymous")

  let subscriptions = await prisma.pushSubscription.findMany({
    where: { establishmentId, customerKey: { in: keys } },
  })

  if (subscriptions.length === 0) {
    console.log(`[Push] Nenhuma subscription p/ establishment=${establishmentId} keys=${JSON.stringify(keys)}`)
    await logPush(establishmentId, customerKey, payload, "no_subs", 0, 0, `keys=${JSON.stringify(keys)}`)
    return { sent: 0, failed: 0 }
  }

  // Cada re-registro de push gera um endpoint novo; subs antigas do mesmo
  // dispositivo (userAgent) podem ter sobrado no banco e causariam push
  // duplicado. Mantém apenas a mais recente por dispositivo.
  const byDevice = new Map<string, (typeof subscriptions)[number]>()
  for (const sub of subscriptions) {
    const device = sub.userAgent || sub.endpoint
    const current = byDevice.get(device)
    if (!current || sub.lastUsedAt > current.lastUsedAt) byDevice.set(device, sub)
  }
  const deduped = Array.from(byDevice.values())
  if (deduped.length !== subscriptions.length) {
    const stale = subscriptions.filter((s) => !deduped.includes(s))
    await prisma.pushSubscription
      .deleteMany({ where: { id: { in: stale.map((s) => s.id) } } })
      .catch(() => {})
  }
  subscriptions = deduped

  let sent = 0
  let failed = 0
  const errors: string[] = []

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(safePayload)
        )
        sent++
        await prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { lastUsedAt: new Date() },
        })
      } catch (e: any) {
        failed++
        const sc = e?.statusCode ?? "?"
        const body = e?.body ? JSON.stringify(e.body).slice(0, 200) : e?.message || ""
        errors.push(`sc=${sc} ${body}`.slice(0, 180))
        console.log(`[Push] Envio falhou (${sc}) p/ ${sub.endpoint.slice(0, 50)}... body=${body}`)
        // Subscription expirou: remove
        if (sc === 404 || sc === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        }
      }
    })
  )

  await logPush(
    establishmentId,
    customerKey,
    safePayload,
    failed > 0 && sent === 0 ? "failed" : "ok",
    sent,
    failed,
    errors.length > 0 ? errors.join(" | ") : undefined
  )

  return { sent, failed }
}

async function logPush(
  establishmentId: string,
  customerKey: string,
  payload: PushPayload,
  status: string,
  sent: number,
  failed: number,
  detail?: string
) {
  try {
    await prisma.pushLog.create({
      data: {
        establishmentId,
        customerKey,
        status,
        sent,
        failed,
        detail: detail || `${payload.title || ""} - ${payload.body || ""}`.slice(0, 200),
      },
    })
  } catch {}
}

export function getVapidPublicKey(): string | null {
  return VAPID_PUBLIC || null
}
