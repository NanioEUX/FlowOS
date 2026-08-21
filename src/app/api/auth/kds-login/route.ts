import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET!

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha são obrigatórios" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 })
    }

    if (user.role !== "kds") {
      return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 })
    }

    if (!user.establishmentId) {
      return NextResponse.json({ error: "Usuário sem estabelecimento vinculado" }, { status: 403 })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 })
    }

    const establishment = await prisma.establishment.findUnique({
      where: { id: user.establishmentId },
      select: { id: true, name: true, slug: true, logo: true },
    })

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: "kds", establishmentId: user.establishmentId },
      JWT_SECRET,
      { expiresIn: "24h" }
    )

    cookies().set("kds_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    })

    return NextResponse.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: "kds" },
      establishment,
    })
  } catch (error) {
    console.error("[KDS Login]", error)
    return NextResponse.json({ error: "Erro ao fazer login" }, { status: 500 })
  }
}
