import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { getSaasAdmin } from "@/lib/saas-admin-auth"

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // F9A-003: rota era totalmente anônima — fica fora do matcher do middleware
  // (só cobre /api/:path*) e não tinha checagem própria; qualquer visitante
  // alterava saasCommissionPercentage de qualquer establishment.
  const session = await getSaasAdmin()
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const { saasCommissionPercentage } = await req.json()

    const e = await prisma.establishment.update({
      where: { id: params.id },
      data: { saasCommissionPercentage: Number(saasCommissionPercentage) || 10 },
      select: { id: true, saasCommissionPercentage: true },
    })

    return NextResponse.json({ ok: true, commission: e.saasCommissionPercentage })
  } catch (error) {
    console.error("[Admin SaaS] Error updating commission:", error)
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 })
  }
}
