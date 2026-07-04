import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const establishmentId = searchParams.get("establishmentId")

  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId necessário" }, { status: 400 })
  }

  const suppliers = await prisma.supplier.findMany({
    where: { establishmentId },
    include: {
      stockItems: {
        select: { id: true, name: true },
      },
    },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(suppliers)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const supplier = await prisma.supplier.create({
      data: {
        name: body.name,
        phone: body.phone || null,
        cnpj: body.cnpj || null,
        email: body.email || null,
        notes: body.notes || null,
        establishmentId: body.establishmentId,
      },
    })

    return NextResponse.json(supplier)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao criar fornecedor" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...data } = body

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone || null,
        cnpj: data.cnpj || null,
        email: data.email || null,
        notes: data.notes || null,
      },
    })

    return NextResponse.json(supplier)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao atualizar fornecedor" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "ID necessário" }, { status: 400 })
    }

    await prisma.supplier.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao deletar fornecedor" }, { status: 500 })
  }
}
