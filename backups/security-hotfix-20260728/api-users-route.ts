import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const establishmentId = searchParams.get("establishmentId")
  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId necessário" }, { status: 400 })
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
    const body = await req.json()
    const { name, email, password, role, permissions, establishmentId, canCloseRegister } = body

    if (!name || !email || !password || !establishmentId) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

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
        role: role || "atendente",
        permissions: JSON.stringify(permissions || ["caixa"]),
        canCloseRegister: canCloseRegister || false,
        mustChangePassword: true,
        establishmentId,
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
