import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireEstablishment } from "@/lib/require-auth"
import { getRequestId, logger } from "@/lib/logger"

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const auth = requireEstablishment(req, id)
    if (auth.error) return auth.error

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

    logger.info("meta-consumption-reset", "consumo da Meta resetado", { requestId: getRequestId(req), establishmentId: id, periodo })
    return NextResponse.json({ success: true, periodo })
  } catch (error: any) {
    logger.error("meta-consumption-reset", "erro ao resetar o consumo da Meta", { requestId: getRequestId(req), error: error?.message })
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
