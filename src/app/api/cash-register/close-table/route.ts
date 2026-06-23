import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { tableNumber, establishmentId, paymentMethod } = await req.json()

    if (!tableNumber || !establishmentId || !paymentMethod) {
      return NextResponse.json({ error: "Dados incompletos (tableNumber, establishmentId, paymentMethod)" }, { status: 400 })
    }

    if (authUser.establishmentId !== establishmentId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
    }

    // Find all orders for this table that are not yet cancelled
    const allOrders = await prisma.order.findMany({
      where: {
        establishmentId,
        tableNumber: parseInt(tableNumber),
        status: { notIn: ["cancelled"] },
      },
      orderBy: { createdAt: "asc" },
    })

    const pendingOrders = allOrders.filter((o) => o.status !== "delivered")

    // If no pending orders but there are delivered orders, just confirm table is closed
    if (pendingOrders.length === 0) {
      if (allOrders.length === 0) {
        return NextResponse.json({ error: "Nenhum pedido para esta mesa" }, { status: 400 })
      }
      // All orders already delivered - just confirm
      return NextResponse.json({
        success: true,
        ordersClosed: 0,
        total: 0,
        message: "Todos os pedidos já foram entregues",
      })
    }

    const totalAmount = pendingOrders.reduce((sum, o) => sum + o.total, 0)

    // Mark all pending orders as delivered
    const orderIds = pendingOrders.map((o) => o.id)
    await prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: {
        status: "delivered",
        paymentMethod,
        deliveredAt: new Date(),
      },
    })

    // Record cash register movement
    const cashRegister = await prisma.cashRegister.findFirst({
      where: { establishmentId, status: "open" },
    })

    if (cashRegister) {
      const paymentLabels: Record<string, string> = {
        cash: "Dinheiro",
        card: "Cartão",
        pix: "Pix",
      }
      await prisma.cashMovement.create({
        data: {
          type: "sale",
          amount: totalAmount,
          description: `Fechamento Mesa ${tableNumber} - ${pendingOrders.length} pedido(s) - ${paymentLabels[paymentMethod] || paymentMethod}`,
          paymentMethod,
          cashRegisterId: cashRegister.id,
        },
      })
    }

    return NextResponse.json({
      success: true,
      ordersClosed: pendingOrders.length,
      total: totalAmount,
    })
  } catch (error) {
    console.error("Error closing table:", error)
    return NextResponse.json({ error: "Erro ao fechar mesa" }, { status: 500 })
  }
}
