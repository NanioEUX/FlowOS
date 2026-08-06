import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const establishmentId = req.nextUrl.searchParams.get("establishmentId")
  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId required" }, { status: 400 })
  }

  const combos = await prisma.dailyCombo.findMany({
    where: { establishmentId, active: true },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, price: true, image: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(combos)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { establishmentId, name, description, price, image, productIds } = body

  if (!establishmentId || !name || !price) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const combo = await prisma.dailyCombo.create({
    data: {
      name,
      description,
      price,
      image,
      establishmentId,
      items: {
        create: productIds?.map((pid: string, idx: number) => ({
          productId: pid,
          quantity: 1,
        })) || [],
      },
    },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, price: true, image: true } } },
      },
    },
  })

  return NextResponse.json(combo)
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, name, description, price, image, active, productIds } = body

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 })
  }

  // If updating products, delete old items and create new ones
  if (productIds) {
    await prisma.dailyComboItem.deleteMany({ where: { comboId: id } })
    await prisma.dailyComboItem.createMany({
      data: productIds.map((pid: string) => ({
        comboId: id,
        productId: pid,
        quantity: 1,
      })),
    })
  }

  const combo = await prisma.dailyCombo.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(price !== undefined && { price }),
      ...(image !== undefined && { image }),
      ...(active !== undefined && { active }),
    },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, price: true, image: true } } },
      },
    },
  })

  return NextResponse.json(combo)
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 })
  }

  await prisma.dailyCombo.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
