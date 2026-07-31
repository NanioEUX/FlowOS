import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { SignJWT } from "jose"

const prisma = new PrismaClient()
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "flowoshub-saas-admin-secret-change-me"
)

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha obrigatórios" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 })
    }

    if (user.role !== "saas_admin") {
      return NextResponse.json({ error: "Acesso negado. Apenas admins SaaS." }, { status: 403 })
    }

    if (!user.isActive) {
      return NextResponse.json({ error: "Conta desativada" }, { status: 403 })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 })
    }

    const token = await new SignJWT({
      userId: user.id,
      email: user.email,
      role: user.role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(JWT_SECRET)

    cookies().set("saas_admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    })

    return NextResponse.json({
      success: true,
      mustChangePassword: user.mustChangePassword,
    })
  } catch (e: any) {
    console.error("[SAAS Admin Login]", e)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
