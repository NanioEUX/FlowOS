import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * POST /api/verify/heartbeat
 * Body: { establishmentId: string }
 * O PWA grava o heartbeat periodicamente para informar que está aberto.
 * A aba do link consulta para decidir se mostra a tela de sucesso sozinha
 * (PWA aberto) ou abre o cardápio (validação direto no navegador).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { establishmentId } = body
    if (!establishmentId) {
      return NextResponse.json({ error: "establishmentId é obrigatório" }, { status: 400 })
    }
    const now = new Date()
    await prisma.establishmentHeartbeat.upsert({
      where: { establishmentId },
      update: { lastActiveAt: now },
      create: { establishmentId, lastActiveAt: now },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Heartbeat POST]", error)
    return NextResponse.json({ error: "Erro ao gravar heartbeat" }, { status: 500 })
  }
}

/**
 * GET /api/verify/heartbeat?establishmentId=xxx
 * Retorna se o PWA esteve ativo nos últimos 30s.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const establishmentId = searchParams.get("establishmentId")
    if (!establishmentId) {
      return NextResponse.json({ error: "establishmentId é obrigatório" }, { status: 400 })
    }
    const record = await prisma.establishmentHeartbeat.findUnique({
      where: { establishmentId },
    })
    const recent = record ? Date.now() - new Date(record.lastActiveAt).getTime() < 30 * 1000 : false
    return NextResponse.json({ active: recent })
  } catch (error) {
    console.error("[Heartbeat GET]", error)
    return NextResponse.json({ error: "Erro ao consultar heartbeat" }, { status: 500 })
  }
}
