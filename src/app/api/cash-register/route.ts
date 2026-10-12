import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireEstablishment } from "@/lib/require-auth"

export async function GET(req: NextRequest) {
  const establishmentId = req.nextUrl.searchParams.get("establishmentId")
  if (!establishmentId) return NextResponse.json({ error: "establishmentId required" }, { status: 400 })

  const auth = requireEstablishment(req, establishmentId)
  if (auth.error) return auth.error

  const register = await prisma.cashRegister.findFirst({
    where: { establishmentId, status: "open" },
    include: { movements: { orderBy: { createdAt: "desc" } } },
  })

  return NextResponse.json(register || null)
}

export async function POST(req: NextRequest) {
  const { openingAmount, notes, establishmentId } = await req.json()

  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId required" }, { status: 400 })
  }

  const auth = requireEstablishment(req, establishmentId)
  if (auth.error) return auth.error

  const existing = await prisma.cashRegister.findFirst({
    where: { establishmentId, status: "open" },
  })

  if (existing) {
    return NextResponse.json({ error: "Já existe um caixa aberto" }, { status: 400 })
  }

  const register = await prisma.cashRegister.create({
    data: {
      openingAmount: openingAmount || 0,
      notes,
      establishmentId,
    },
  })

  return NextResponse.json(register)
}
