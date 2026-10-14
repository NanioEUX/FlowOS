import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { verifyAuth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const establishmentId = searchParams.get("establishmentId") || auth.establishmentId

  // Tenant isolation: a user can only list users from their own establishment
  if (establishmentId !== auth.establishmentId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    where: { establishmentId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      permissions: true,
      canCloseRegister: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  try {
    const auth = verifyAuth(req)
    if (!auth) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Só admin do tenant cria usuários (F1A-002 / H1#7)
    if (auth.role !== "admin" && auth.role !== "saas_admin") {
      return NextResponse.json({ error: "Apenas administradores criam usuários" }, { status: 403 })
    }

    const body = await req.json()
    const { name, email, password, role, permissions, establishmentId, canCloseRegister } = body

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Senha muito curta (mínimo 6 caracteres)" }, { status: 400 })
    }

    // Whitelist server-side: nunca aceitar roles fora do conjunto do tenant
    const ALLOWED_ROLES = ["admin", "atendente", "kds", "motoboy"]
    const finalRole = ALLOWED_ROLES.includes(role) ? role : "atendente"

    // Tenant isolation: users can only be created in their own establishment.
    // Ignore any establishmentId in the body and force the caller's tenant.
    const targetEstablishmentId = auth.establishmentId

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: "Email já cadastrado" }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: finalRole,
        permissions: JSON.stringify(permissions || ["caixa"]),
        canCloseRegister: canCloseRegister || false,
        mustChangePassword: true,
        establishmentId: targetEstablishmentId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        canCloseRegister: true,
        isActive: true,
        createdAt: true,
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao criar usuário" }, { status: 500 })
  }
}
