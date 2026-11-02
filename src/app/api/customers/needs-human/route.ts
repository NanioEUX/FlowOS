import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getRequestId, logger } from "@/lib/logger"

export async function POST(req: NextRequest) {
  try {
    const { phone, establishmentId, needsHuman } = await req.json()

    if (!phone || !establishmentId) {
      return NextResponse.json({ error: "phone e establishmentId são obrigatórios" }, { status: 400 })
    }

    const customer = await prisma.customer.findFirst({
      where: { phone, establishmentId },
    })

    if (!customer) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 })
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: { needsHuman: Boolean(needsHuman) },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error("needs-human", "falha em needs-human", { requestId: getRequestId(req), error: (error as any)?.message })
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 })
  }
}