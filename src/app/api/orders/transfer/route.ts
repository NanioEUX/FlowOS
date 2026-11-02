import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"
import { getRequestId, logger } from "@/lib/logger"

export async function PATCH(req: NextRequest) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { sourceTable, targetTable } = await req.json()

    if (!sourceTable || !targetTable) {
      return NextResponse.json({ error: "sourceTable e targetTable são obrigatórios" }, { status: 400 })
    }

    if (sourceTable === targetTable) {
      return NextResponse.json({ error: "Mesas não podem ser iguais" }, { status: 400 })
    }

    // Update all orders from source table to target table
    const result = await prisma.order.updateMany({
      where: {
        establishmentId: authUser.establishmentId,
        tableNumber: sourceTable,
        status: { notIn: ["delivered", "cancelled"] },
      },
      data: {
        tableNumber: targetTable,
      },
    })

    return NextResponse.json({ success: true, transferred: result.count })
  } catch (error) {
    logger.error("orders/transfer", "Transfer table error", { requestId: getRequestId(req), error: (error as any)?.message })
    return NextResponse.json({ error: "Erro ao transferir mesa" }, { status: 500 })
  }
}