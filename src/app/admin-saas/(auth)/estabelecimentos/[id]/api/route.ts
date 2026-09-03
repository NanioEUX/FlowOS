import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
