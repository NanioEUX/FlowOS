import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  verifyCustomerSession,
  customerSessionRequired,
  type CustomerSession,
} from "@/lib/customer-auth"

// Todas as operações exigem o cookie de sessão do cliente (F7A-005/F7B-016):
// customerId/establishmentId vêm do token, nunca do request.

async function requireSession(req: NextRequest): Promise<CustomerSession | NextResponse> {
  const session = await verifyCustomerSession(req)
  return session ?? customerSessionRequired()
}

function isResponse(v: any): v is NextResponse {
  return v instanceof NextResponse
}

// GET /api/addresses
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req)
    if (isResponse(session)) return session

    const addresses = await prisma.customerAddress.findMany({
      where: { customerId: session.customerId },
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
    const session = await requireSession(req)
    if (isResponse(session)) return session

    const body = await req.json()
    const { label, street, number, neighborhood, city, state, cep, complement, isDefault } = body

    if (!street || !number || !city || !state || !cep) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

    const customerId = session.customerId

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
    const session = await requireSession(req)
    if (isResponse(session)) return session

    const body = await req.json()
    const { id, label, street, number, neighborhood, city, state, cep, complement, isDefault } = body

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 })
    }

    const customerId = session.customerId

    // O endereço precisa pertencer ao cliente da sessão (o PATCH anterior não
    // checava isso — atualizar qualquer id com customerId próprio passava)
    const existing = await prisma.customerAddress.findFirst({
      where: { id, customerId },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: "Endereço não encontrado" }, { status: 404 })
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

// DELETE /api/addresses?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireSession(req)
    if (isResponse(session)) return session

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 })
    }

    const customerId = session.customerId

    const address = await prisma.customerAddress.findFirst({
      where: { id, customerId },
    })
    if (!address) {
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
