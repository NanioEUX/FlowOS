import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const periodo = new Date().toISOString().slice(0, 7) // "2026-09"

    await prisma.establishment.update({
      where: { id },
      data: {
        consumoMarketing: 0,
        consumoUtility: 0,
        consumoAuthentication: 0,
        consumoService: 0,
        consumoPeriodo: periodo,
      },
    })

    console.log(`[Meta Consumption] Reset for ${id}, period: ${periodo}`)
    return NextResponse.json({ success: true, periodo })
  } catch (error: any) {
    console.error("[Meta Consumption] Reset error:", error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
