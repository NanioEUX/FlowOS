import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"
import { requireEstablishment } from "@/lib/require-auth"
import { normalizePhone } from "@/lib/phone"
import {
  verifyCustomerSession,
  customerSessionRequired,
  type CustomerSession,
} from "@/lib/customer-auth"
import { getRequestId, logger } from "@/lib/logger"

// Campos seguros para consulta pública (pré-OTP / auto-relogin): sem PII
// sensível (address/cep/cpf/birthDate/email) — F7A-006/017. O registro completo
// só sai quando a sessão do cookie pertence ao próprio cliente.
const PUBLIC_SELECT = {
  id: true,
  name: true,
  phone: true,
  whatsappVerified: true,
  verifiedAt: true,
  tier: true,
  loyaltyPoints: true,
  totalOrders: true,
  totalSpent: true,
  cancellationCount: true,
  blockedUntil: true,
} as const

function isOwnSession(session: CustomerSession | null, customerId: string): boolean {
  return !!session && session.customerId === customerId
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const phone = searchParams.get("phone")
  const cpf = searchParams.get("cpf")
  const establishmentId = searchParams.get("establishmentId")

  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId é obrigatório" }, { status: 400 })
  }

  const session = await verifyCustomerSession(req)

  // CPF lookup: público, mas só o subset (F7A-006)
  if (cpf) {
    const cpfDigits = cpf.replace(/\D/g, "")
    if (cpfDigits.length === 11) {
      const customer = await prisma.customer.findFirst({
        where: { cpf: cpfDigits, establishmentId },
        orderBy: { createdAt: "desc" },
      })
      if (!customer) return NextResponse.json({ notFound: true })
      if (isOwnSession(session, customer.id)) return NextResponse.json(customer)
      const { ...subset } = customer as any
      const safe: any = {}
      for (const key of Object.keys(PUBLIC_SELECT)) safe[key] = (subset as any)[key]
      return NextResponse.json(safe)
    }
  }

  // Phone lookup: público (menu usa pré-OTP e no auto-relogin), subset sem PII
  if (phone) {
    const phoneDigits = normalizePhone(phone) || phone.replace(/\D/g, "")
    const customer = await prisma.customer.findFirst({
      where: { phone: phoneDigits, establishmentId },
      orderBy: { createdAt: "desc" },
    })
    if (!customer) return NextResponse.json({ notFound: true })

    // Calculate real totalSpent and totalOrders from delivered orders only
    const deliveredOrders = await prisma.order.aggregate({
      where: {
        customerId: customer.id,
        establishmentId,
        status: { in: ["delivered", "confirmed", "preparing", "ready", "dispatched", "out_for_delivery"] },
      },
      _sum: { total: true },
      _count: true,
    })
    const realTotalSpent = deliveredOrders._sum.total || 0
    const realTotalOrders = deliveredOrders._count || 0

    if (isOwnSession(session, customer.id)) {
      return NextResponse.json({ ...customer, realTotalSpent, realTotalOrders })
    }
    const safe: any = {}
    for (const key of Object.keys(PUBLIC_SELECT)) safe[key] = (customer as any)[key]
    return NextResponse.json({ ...safe, realTotalSpent, realTotalOrders })
  }

  // List all customers: requires auth
  const user = await verifyAuth(req)
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  if (user.establishmentId !== establishmentId) {
    return NextResponse.json({ error: "Estabelecimento não autorizado" }, { status: 403 })
  }

  const customers = await prisma.customer.findMany({
    where: { establishmentId },
    select: {
      id: true,
      name: true,
      phone: true,
      cpf: true,
      email: true,
      address: true,
      cep: true,
      birthDate: true,
      whatsappVerified: true,
      verifiedAt: true,
      loyaltyPoints: true,
      tier: true,
      totalOrders: true,
      totalSpent: true,
      cancellationCount: true,
      blockedUntil: true,
      needsHuman: true,
      needsHumanAt: true,
      createdAt: true,
      updatedAt: true,
    },
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

    // Criação/atualização em massa é operação da equipe (já exigia JWT)
    const { error } = requireEstablishment(req, establishmentId)
    if (error) return error

    const phoneDigits = normalizePhone(phone)
    if (!phoneDigits) {
      return NextResponse.json({ error: "Telefone inválido" }, { status: 400 })
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
        where: { phone: phoneDigits, establishmentId },
      })
    }

    if (existing) {
      const customer = await prisma.customer.update({
        where: { id: existing.id },
        data: {
          name: name || existing.name,
          phone: phoneDigits,
          cpf: cpfDigits?.length === 11 ? cpfDigits : existing.cpf,
          address: address !== undefined ? address : existing.address,
          cep: cep !== undefined ? cep : existing.cep,
        },
      })
      return NextResponse.json(customer)
    }

    const customer = await prisma.customer.create({
      data: { phone: phoneDigits, name, address, cep, cpf: cpfDigits?.length === 11 ? cpfDigits : null, establishmentId },
    })

    return NextResponse.json(customer)
  } catch (error) {
    logger.error("customers", "falha ao operar o cliente", { requestId: getRequestId(req), error: (error as any)?.message })
    return NextResponse.json({ error: "Erro ao criar cliente" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    // Perfil do cliente final: só com sessão do cookie; o id vem do token,
    // nunca do body (F7A-006/F7B-004)
    const session = await verifyCustomerSession(req)
    if (!session) return customerSessionRequired()

    const body = await req.json()
    const { phone, name, cpf, birthDate } = body

    const cpfDigits = cpf?.replace(/\D/g, "")
    const birthDateParsed = birthDate ? new Date(birthDate) : null

    // Troca de número exige re-OTP do número novo (F7A-014): recusamos a
    // troca silenciosa; o front segue gravando o rascunho local.
    if (phone) {
      const newPhone = normalizePhone(phone)
      if (!newPhone || newPhone !== session.phone) {
        return NextResponse.json(
          { error: "Para trocar o telefone, verifique o novo número pelo WhatsApp." },
          { status: 400 }
        )
      }
    }

    const customer = await prisma.customer.update({
      where: { id: session.customerId },
      data: {
        ...(name && { name }),
        ...(cpfDigits?.length === 11 && { cpf: cpfDigits }),
        ...(birthDateParsed && !isNaN(birthDateParsed.getTime()) && { birthDate: birthDateParsed }),
      },
    })

    return NextResponse.json(customer)
  } catch (error) {
    logger.error("customers", "falha ao operar o cliente", { requestId: getRequestId(req), error: (error as any)?.message })
    return NextResponse.json({ error: "Erro ao atualizar cliente" }, { status: 500 })
  }
}
