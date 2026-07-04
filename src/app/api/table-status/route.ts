import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Short cache: 5s (table status changes frequently but doesn't need real-time)
export const revalidate = 5

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const slug = searchParams.get("slug")
    const tableNumber = searchParams.get("table")

    if (!slug || !tableNumber) {
      return NextResponse.json({ error: "Parâmetros slug e table são obrigatórios" }, { status: 400 })
    }

    const num = parseInt(tableNumber)
    if (isNaN(num) || num < 1) {
      return NextResponse.json({ error: "Número de mesa inválido" }, { status: 400 })
    }

    const establishment = await prisma.establishment.findUnique({
      where: { slug },
      select: { id: true, name: true, tableCount: true },
    })

    if (!establishment) {
      return NextResponse.json({ error: "Estabelecimento não encontrado" }, { status: 404 })
    }

    if (num > (establishment.tableCount || 10)) {
      return NextResponse.json({ error: "Mesa não existe" }, { status: 404 })
    }

    // Check for active (non-delivered, non-cancelled) orders on this table
    const activeOrders = await prisma.order.findMany({
      where: {
        establishmentId: establishment.id,
        tableNumber: num,
        orderType: "presencial",
        status: { notIn: ["delivered", "cancelled"] },
      },
      orderBy: { createdAt: "asc" },
    })

    const totalPending = activeOrders.reduce((sum, o) => sum + o.total, 0)

    return NextResponse.json({
      open: true,
      establishmentId: establishment.id,
      establishmentName: establishment.name,
      tableNumber: num,
      tableCount: establishment.tableCount || 10,
      ordersCount: activeOrders.length,
      totalPending,
      orders: activeOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        items: o.items,
        total: o.total,
        status: o.status,
        createdAt: o.createdAt,
      })),
    })
  } catch (error) {
    console.error("Erro ao verificar mesa:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
