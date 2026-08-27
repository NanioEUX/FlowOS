import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/addresses?customerId=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get("customerId")
    if (!customerId) {
      return NextResponse.json({ error: "customerId required" }, { status: 400 })
    }

    const addresses = await prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    })

    return NextResponse.json({ addresses })
  } catch (error) {
    console.error("[Addresses GET]", error)
    return NextResponse.json({ error: "Erro ao buscar endereços" }, { status: 500 })
  }
}

// POST /api/addresses
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { customerId, label, street, number, neighborhood, city, state, cep, complement, isDefault } = body

    if (!customerId || !street || !number || !city || !state || !cep) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

    // Check limit (max 3 addresses)
    const count = await prisma.customerAddress.count({ where: { customerId } })
    if (count >= 3) {
      return NextResponse.json({ error: "Limite de 3 endereços atingido. Exclua um para adicionar outro." }, { status: 400 })
    }

    // If isDefault, unset other defaults
    if (isDefault) {
      await prisma.customerAddress.updateMany({
        where: { customerId },
        data: { isDefault: false },
      })
    }

    // If first address, make it default
    const isFirst = count === 0

    const address = await prisma.customerAddress.create({
      data: {
        customerId,
        label: label || null,
        street,
        number,
        neighborhood: neighborhood || null,
        city,
        state,
        cep,
        complement: complement || null,
        isDefault: isFirst ? true : isDefault || false,
      },
    })

    return NextResponse.json({ address })
  } catch (error) {
    console.error("[Addresses POST]", error)
    return NextResponse.json({ error: "Erro ao criar endereço" }, { status: 500 })
  }
}

// PATCH /api/addresses
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, customerId, label, street, number, neighborhood, city, state, cep, complement, isDefault } = body

    if (!id || !customerId) {
      return NextResponse.json({ error: "id and customerId required" }, { status: 400 })
    }

    // If setting as default, unset others
    if (isDefault) {
      await prisma.customerAddress.updateMany({
        where: { customerId, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const address = await prisma.customerAddress.update({
      where: { id },
      data: {
        ...(label !== undefined && { label }),
        ...(street !== undefined && { street }),
        ...(number !== undefined && { number }),
        ...(neighborhood !== undefined && { neighborhood }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(cep !== undefined && { cep }),
        ...(complement !== undefined && { complement }),
        ...(isDefault !== undefined && { isDefault }),
      },
    })

    return NextResponse.json({ address })
  } catch (error) {
    console.error("[Addresses PATCH]", error)
    return NextResponse.json({ error: "Erro ao atualizar endereço" }, { status: 500 })
  }
}

// DELETE /api/addresses?id=xxx&customerId=xxx
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    const customerId = searchParams.get("customerId")

    if (!id || !customerId) {
      return NextResponse.json({ error: "id and customerId required" }, { status: 400 })
    }

    const address = await prisma.customerAddress.findUnique({ where: { id } })
    if (!address || address.customerId !== customerId) {
      return NextResponse.json({ error: "Endereço não encontrado" }, { status: 404 })
    }

    await prisma.customerAddress.delete({ where: { id } })

    // If deleted was default, make the most recent one default
    if (address.isDefault) {
      const remaining = await prisma.customerAddress.findFirst({
        where: { customerId },
        orderBy: { createdAt: "desc" },
      })
      if (remaining) {
        await prisma.customerAddress.update({
          where: { id: remaining.id },
          data: { isDefault: true },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Addresses DELETE]", error)
    return NextResponse.json({ error: "Erro ao excluir endereço" }, { status: 500 })
  }
}
