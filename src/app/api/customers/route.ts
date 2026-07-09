import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const phone = searchParams.get("phone")
  const cpf = searchParams.get("cpf")
  const establishmentId = searchParams.get("establishmentId")

  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId é obrigatório" }, { status: 400 })
  }

  // CPF lookup: public (used by menu page identification)
  if (cpf) {
    const cpfDigits = cpf.replace(/\D/g, "")
    if (cpfDigits.length === 11) {
      const customer = await prisma.customer.findFirst({
        where: { cpf: cpfDigits, establishmentId },
        orderBy: { createdAt: "desc" },
      })
      return NextResponse.json(customer || { notFound: true })
    }
  }

  // Phone lookup: public (used by menu page)
  if (phone) {
    const customer = await prisma.customer.findFirst({
      where: { phone, establishmentId },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(customer || { notFound: true })
  }

  // List all customers: requires auth
  const user = await verifyAuth(req)
  if (!user || user.establishmentId !== establishmentId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const customers = await prisma.customer.findMany({
    where: { establishmentId },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(customers)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { phone, name, address, cep, establishmentId, cpf } = body

    if (!phone || !establishmentId) {
      return NextResponse.json({ error: "phone e establishmentId são obrigatórios" }, { status: 400 })
    }

    // Check by CPF first (unique identifier)
    const cpfDigits = cpf?.replace(/\D/g, "")
    let existing = null

    if (cpfDigits?.length === 11) {
      existing = await prisma.customer.findFirst({
        where: { cpf: cpfDigits, establishmentId },
      })
    }

    // If no CPF match, check by phone
    if (!existing) {
      existing = await prisma.customer.findFirst({
        where: { phone, establishmentId },
      })
    }

    if (existing) {
      const customer = await prisma.customer.update({
        where: { id: existing.id },
        data: {
          name: name || existing.name,
          phone: phone || existing.phone,
          cpf: cpfDigits?.length === 11 ? cpfDigits : existing.cpf,
          address: address !== undefined ? address : existing.address,
          cep: cep !== undefined ? cep : existing.cep,
        },
      })
      return NextResponse.json(customer)
    }

    const customer = await prisma.customer.create({
      data: { phone, name, address, cep, cpf: cpfDigits?.length === 11 ? cpfDigits : null, establishmentId },
    })

    return NextResponse.json(customer)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao criar cliente" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, phone, name, cpf, establishmentId } = body

    if (!id || !establishmentId) {
      return NextResponse.json({ error: "id e establishmentId são obrigatórios" }, { status: 400 })
    }

    const cpfDigits = cpf?.replace(/\D/g, "")

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(phone && { phone }),
        ...(cpfDigits?.length === 11 && { cpf: cpfDigits }),
      },
    })

    return NextResponse.json(customer)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao atualizar cliente" }, { status: 500 })
  }
}
