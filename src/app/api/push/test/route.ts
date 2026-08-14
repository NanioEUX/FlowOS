import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import webpush from "web-push"

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@flowos.fs.app"

async function sendTestPush(establishmentId: string, phone?: string, title?: string, notifBody?: string) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return { error: "VAPID keys não configuradas" }
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

  let where: any = { establishmentId }
  if (phone) {
    const keys = [phone, phone?.replace(/\D/g, "")].filter(
      (k, i, arr) => k && arr.indexOf(k) === i
    ) as string[]
    keys.push("anonymous")
    where.customerKey = { in: keys }
  }

  const subs = await prisma.pushSubscription.findMany({
    where,
    orderBy: { lastUsedAt: "desc" },
    take: 5,
  })

  if (subs.length === 0) {
    return {
      error: "Nenhuma subscription encontrada",
      totalSubscriptions: await prisma.pushSubscription.count({ where: { establishmentId } }),
    }
  }

  const payload = {
    title: title || "Pedido #99 · Teste",
    body: notifBody || "Olá! Este é um teste com detalhes: 2x Casquinha Dupla, 1x Sorvete · R$ 25,00",
    url: "/",
    tag: "test-" + Date.now(),
  }

  const payloadStr = JSON.stringify(payload)
  console.log(`[Push Test] Payload (${payloadStr.length} bytes): ${payloadStr}`)

  const results: any[] = []
  for (const sub of subs.slice(0, 5)) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payloadStr
      )
      results.push({ customerKey: sub.customerKey, status: "OK", endpoint: sub.endpoint.slice(0, 60) })
    } catch (e: any) {
      results.push({
        customerKey: sub.customerKey,
        status: "FAIL",
        statusCode: e?.statusCode ?? null,
        error: e?.body ? JSON.stringify(e.body).slice(0, 200) : e?.message || null,
      })
    }
  }

  return { payload, results, totalSubs: subs.length }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const establishmentId = url.searchParams.get("establishmentId") || "cmqpcbz3p00009mts6law5jms"
    const phone = url.searchParams.get("phone") || undefined

    const result = await sendTestPush(establishmentId, phone)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { establishmentId, phone, title, body: notifBody } = body

    if (!establishmentId) {
      return NextResponse.json({ error: "establishmentId obrigatório" }, { status: 400 })
    }

    const result = await sendTestPush(establishmentId, phone, title, notifBody)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
