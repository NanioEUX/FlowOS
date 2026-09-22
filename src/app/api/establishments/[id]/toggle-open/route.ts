import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"
import { getIfoodAuth } from "@/lib/integrations/ifood"
import { createInterruption, deleteInterruption, getInterruptions } from "@/lib/integrations/ifood-catalog-write"

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    if (authUser.establishmentId !== params.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const channel = body.channel as "direto" | "ifood"

    if (channel === "ifood") {
      return await toggleIfood(params.id)
    }

      return await toggleDireto(params.id)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao alterar status" }, { status: 500 })
  }
}

async function toggleDireto(establishmentId: string) {
  const current = await prisma.establishment.findUnique({
    where: { id: establishmentId },
    select: { isOpenOverride: true },
  })

  if (!current) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  }

  const newValue = current.isOpenOverride === true ? false : true

  const updated = await prisma.establishment.update({
    where: { id: establishmentId },
    data: { isOpenOverride: newValue },
    select: { isOpenOverride: true, ifoodPaused: true },
  })

  return NextResponse.json({ isOpenOverride: updated.isOpenOverride, ifoodPaused: updated.ifoodPaused })
}

async function toggleIfood(establishmentId: string) {
  const establishment = await prisma.establishment.findUnique({
    where: { id: establishmentId },
    select: {
      ifoodPaused: true,
      ifoodInterruptionId: true,
      ifoodMerchantId: true,
      ifoodEnabled: true,
      isOpenOverride: true,
    },
  })

  if (!establishment) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  }

  if (!establishment.ifoodEnabled || !establishment.ifoodMerchantId) {
    return NextResponse.json({ error: "iFood não configurado" }, { status: 400 })
  }

  const isPaused = establishment.ifoodPaused === true

  if (isPaused) {
    // Currently paused → OPEN: delete interruption
    if (establishment.ifoodInterruptionId) {
      const ifoodAuth = await getIfoodAuth(
        process.env.IFOOD_CLIENT_ID!,
        process.env.IFOOD_CLIENT_SECRET!
      )
      if (ifoodAuth?.accessToken) {
        await deleteInterruption(ifoodAuth.accessToken, establishment.ifoodMerchantId, establishment.ifoodInterruptionId)
      }
    }

    const updated = await prisma.establishment.update({
      where: { id: establishmentId },
      data: { ifoodPaused: false, ifoodInterruptionId: null },
      select: { isOpenOverride: true, ifoodPaused: true },
    })

    return NextResponse.json({ isOpenOverride: updated.isOpenOverride, ifoodPaused: updated.ifoodPaused })
  } else {
    // Currently open → PAUSE: create interruption
    const ifoodAuth = await getIfoodAuth(
      process.env.IFOOD_CLIENT_ID!,
      process.env.IFOOD_CLIENT_SECRET!
    )

    if (!ifoodAuth?.accessToken) {
      return NextResponse.json({ error: "Falha na autenticação com iFood" }, { status: 502 })
    }

    const now = new Date()
    const end = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24h from now
    const startIso = now.toISOString().replace("Z", "+00:00")
    const endIso = end.toISOString().replace("Z", "+00:00")

    const result = await createInterruption(
      ifoodAuth.accessToken,
      establishment.ifoodMerchantId,
      startIso,
      endIso,
      "Ajuste operacional interno"
    )

    const interruptionId = result?.data?.id || null

    const updated = await prisma.establishment.update({
      where: { id: establishmentId },
      data: { ifoodPaused: true, ifoodInterruptionId: interruptionId },
      select: { isOpenOverride: true, ifoodPaused: true },
    })

    return NextResponse.json({ isOpenOverride: updated.isOpenOverride, ifoodPaused: updated.ifoodPaused })
  }
}
