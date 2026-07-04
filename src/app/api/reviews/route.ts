import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const { rating, comment, phone, tableNumber, orderId, establishmentId } = await req.json()

    if (!establishmentId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    }

    // Find or create customer by phone
    let customerId: string | undefined
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, "")
      let customer = await prisma.customer.findFirst({
        where: { phone: cleanPhone, establishmentId },
      })
      if (!customer) {
        customer = await prisma.customer.create({
          data: { phone: cleanPhone, name: "Cliente Avaliação", establishmentId },
        })
      }
      customerId = customer.id
    }

    const review = await prisma.review.create({
      data: {
        rating,
        comment: comment || null,
        customerId: customerId || null,
        tableNumber: tableNumber || null,
        orderId: orderId || null,
        establishmentId,
      },
    })

    return NextResponse.json(review)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao salvar avaliação" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const establishmentId = searchParams.get("establishmentId")

  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId necessário" }, { status: 400 })
  }

  const reviews = await prisma.review.findMany({
    where: { establishmentId },
    include: { customer: { select: { name: true, phone: true } } },
    orderBy: { createdAt: "desc" },
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
