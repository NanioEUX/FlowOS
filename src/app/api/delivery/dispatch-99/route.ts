import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { despacharCorrida99 } from "@/lib/integrations/nine-nine"

/**
 * Despacha corrida para 99Entrega
 *
 * POST /api/delivery/dispatch-99
 * Body: { orderId: string }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { orderId } = body

    if (!orderId) {
      return NextResponse.json({ error: "orderId é obrigatório" }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { establishment: true },
    })

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    const establishment = order.establishment

    if (establishment.tipoEntregaAtiva !== "99entrega") {
      return NextResponse.json({ error: "Pedido não usa 99Entrega" }, { status: 400 })
    }

    if (!establishment.api99Key || !establishment.api99EmployeeId) {
      return NextResponse.json({ error: "Credenciais 99 não configuradas" }, { status: 400 })
    }

    if (!establishment.addressLat || !establishment.addressLng) {
      return NextResponse.json({ error: "Endereço do estabelecimento não configurado" }, { status: 400 })
    }

    if (!order.customerLat || !order.customerLng) {
      return NextResponse.json({ error: "Endereço do cliente não encontrado" }, { status: 400 })
    }

    const entregaPinCode = String(Math.floor(1000 + Math.random() * 9000))

    const result = await despacharCorrida99(
      establishment.api99Key,
      establishment.api99EmployeeId,
      establishment.addressLat,
      establishment.addressLng,
      order.customerLat,
      order.customerLng,
      order.id,
      entregaPinCode
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Erro ao despachar corrida" }, { status: 500 })
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        entrega99RideId: result.rideId,
        entregaPinCode,
        entregaStatusProvedor: "pending",
      },
    })

    return NextResponse.json({
      success: true,
      rideId: result.rideId,
      pinCode: entregaPinCode,
    })
  } catch (error) {
    console.error("[dispatch-99] error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
