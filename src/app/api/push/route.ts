import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Store push subscription for a delivery person
export async function POST(req: NextRequest) {
  const { subscription, deliveryPersonId, establishmentId } = await req.json()

  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth || !deliveryPersonId) {
    return NextResponse.json({ error: "subscription and deliveryPersonId required" }, { status: 400 })
  }

  try {
    // F3A-050: era raw SQL com CREATE TABLE a cada gravação (e o DDL usava
    // sintaxe SQLite que nem roda no Postgres da prod). Agora usa o modelo
    // Prisma (mesma tabela do push PWA); customerKey guarda o deliveryPersonId
    // — o sender em lib/push.ts busca exatamente por establishmentId+customerKey.
    let estId: string = establishmentId
    if (!estId) {
      const dp = await prisma.deliveryPerson.findUnique({ where: { id: deliveryPersonId }, select: { establishmentId: true } })
      estId = dp?.establishmentId || ""
    }
    if (!estId) {
      return NextResponse.json({ error: "establishment not found for deliveryPerson" }, { status: 400 })
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        establishmentId: estId,
        customerKey: deliveryPersonId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      update: {
        customerKey: deliveryPersonId,
        lastUsedAt: new Date(),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Get VAPID public key
export async function GET() {
  return NextResponse.json({
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  })
}
