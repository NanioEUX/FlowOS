import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { establishmentId, customerKey, subscription } = await req.json()

    if (!establishmentId || !customerKey || !subscription) {
      return NextResponse.json({ error: "Dados faltando" }, { status: 400 })
    }

    const { endpoint, keys } = subscription
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Subscription inválida" }, { status: 400 })
    }

    const userAgent = req.headers.get("user-agent")

    // Cada re-registro de push no iOS/Android gera um endpoint novo e os antigos
    // ficam órfãos no banco, recebendo push duplicado mesmo com a flag desativada.
    // Antes de gravar a nova, remove as subscriptions antigas do MESMO dispositivo
    // (userAgent) e estabelecimento, mantendo sempre apenas a mais recente.
    if (establishmentId && userAgent) {
      await prisma.pushSubscription.deleteMany({
        where: { establishmentId, userAgent, endpoint: { not: endpoint } },
      })
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        establishmentId,
        customerKey,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
      },
      update: {
        customerKey,
        lastUsedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { endpoint, establishmentId } = await req.json()
    if (!endpoint) {
      return NextResponse.json({ error: "endpoint obrigatório" }, { status: 400 })
    }

    // Remove a subscription atual
    await prisma.pushSubscription.deleteMany({ where: { endpoint } })

    // Cada re-registro de push no iOS/Android gera um endpoint novo; os antigos
    // ficam órfãos no banco e continuam recebendo push mesmo com a flag desativada.
    // Remove também as demais subscriptions do MESMO dispositivo (userAgent) e
    // estabelecimento, para o toggle OFF desativar todas de uma vez.
    const userAgent = req.headers.get("user-agent")
    if (establishmentId && userAgent) {
      await prisma.pushSubscription.deleteMany({ where: { establishmentId, userAgent } })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
