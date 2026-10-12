import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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
      select: {
        orderNumber: true,
        total: true,
        status: true,
        createdAt: true,
      },
    })

    const totalPending = activeOrders.reduce((sum, o) => sum + o.total, 0)

    return NextResponse.json({
      open: true,
      establishmentName: establishment.name,
      tableNumber: num,
      tableCount: establishment.tableCount || 10,
      ordersCount: activeOrders.length,
      totalPending,
      orders: activeOrders,
    })
  } catch (error) {
    console.error("Erro ao verificar mesa:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
