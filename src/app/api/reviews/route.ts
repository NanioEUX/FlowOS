import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const { rating, comment, customerPhone, orderId, establishmentId } = await req.json()

    if (!establishmentId || rating == null || rating < 0 || rating > 5) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    }

    if (orderId) {
      const existing = await prisma.review.findUnique({ where: { orderId } })
      if (existing) {
        return NextResponse.json({ error: "Pedido já avaliado" }, { status: 409 })
      }
    }

    let customerId: string | undefined
    if (customerPhone) {
      const cleanPhone = customerPhone.replace(/\D/g, "")
      let customer = await prisma.customer.findFirst({
        where: { phone: cleanPhone, establishmentId },
      })
      if (!customer) {
        customer = await prisma.customer.create({
          data: { phone: cleanPhone, name: "Cliente", establishmentId },
        })
      }
      customerId = customer.id
    }

    const review = await prisma.review.create({
      data: {
        rating,
        comment: comment || null,
        customerId: customerId || null,
        customerPhone: customerPhone || null,
        orderId: orderId || null,
        establishmentId,
      },
    })

    return NextResponse.json(review)
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Pedido já avaliado" }, { status: 409 })
    }
    console.error("[reviews:POST]", error)
    return NextResponse.json({ error: "Erro ao salvar avaliação" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const establishmentId = searchParams.get("establishmentId")
  const orderId = searchParams.get("orderId")

  if (orderId) {
    const review = await prisma.review.findUnique({ where: { orderId } })
    return NextResponse.json({ reviewed: !!review, review })
  }

  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId necessário" }, { status: 400 })
  }

  const reviews = await prisma.review.findMany({
    where: { establishmentId },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  const avgResult = await prisma.review.aggregate({
    where: { establishmentId },
    _avg: { rating: true },
    _count: { rating: true },
  })

  return NextResponse.json({
    reviews,
    average: avgResult._avg.rating || 0,
    total: avgResult._count.rating,
  })
}
