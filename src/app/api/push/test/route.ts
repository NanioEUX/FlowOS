import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import webpush from "web-push"

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@flowos.fs.app"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { establishmentId, phone, title, body: notifBody } = body

    if (!establishmentId) {
      return NextResponse.json({ error: "establishmentId obrigatório" }, { status: 400 })
    }

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return NextResponse.json({ error: "VAPID keys não configuradas" }, { status: 500 })
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

    const keys = [phone, phone?.replace(/\D/g, "")].filter(
      (k: string, i: number, arr: string[]) => k && arr.indexOf(k) === i
    )
    keys.push("anonymous")

    const subs = await prisma.pushSubscription.findMany({
      where: { establishmentId, customerKey: { in: keys } },
      orderBy: { lastUsedAt: "desc" },
      take: 5,
    })

    if (subs.length === 0) {
      return NextResponse.json({
        error: "Nenhuma subscription encontrada",
        keys,
        totalSubscriptions: await prisma.pushSubscription.count({ where: { establishmentId } }),
      }, { status: 404 })
    }

    const payload = {
      title: title || "Teste de Notificação",
      body: notifBody || "Esta é uma notificação de teste com detalhes do pedido: 2x Burger, 1x Fries · R$ 45,90",
      url: "/",
      tag: "test-" + Date.now(),
    }

    const payloadStr = JSON.stringify(payload)
    console.log(`[Push Test] Payload (${payloadStr.length} bytes): ${payloadStr}`)

    const results: any[] = []
    for (const sub of subs.slice(0, 3)) {
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

    return NextResponse.json({ payload, results, totalSubs: subs.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
