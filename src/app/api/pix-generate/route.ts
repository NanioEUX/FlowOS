import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireEstablishment } from "@/lib/require-auth"

export async function POST(req: NextRequest) {
  try {
    const { establishmentId, amount, description } = await req.json()

    if (!establishmentId || !amount) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

    const { user, error } = requireEstablishment(req, establishmentId)
    if (error) return error

    const establishment = await prisma.establishment.findUnique({
      where: { id: user.establishmentId },
      select: { id: true, name: true },
    })

    if (!establishment) {
      return NextResponse.json({ error: "Estabelecimento não encontrado" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: "Pagamento online não disponível. Configure Pagar.me ou Inter.",
      amount,
    })
  } catch (error) {
    console.error("Erro ao gerar Pix:", error)
    return NextResponse.json({ error: "Erro ao gerar pagamento" }, { status: 500 })
  }
}
