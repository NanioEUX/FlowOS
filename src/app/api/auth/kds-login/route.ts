import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { getRequestId, logger } from "@/lib/logger"

const JWT_SECRET = process.env.JWT_SECRET!

export async function POST(req: NextRequest) {
  try {
    // corpo inválido (vazio/malformado) é erro do cliente, não 500 do servidor
    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 })
    }
    const { email, password } = body || {}

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

    // F8B-007: refresh token — o KDS fica aberto horas na TV; sem isso o token
    // de 24h expira e a tela silencia. Cookie httpOnly restrito à rota de refresh.
    const refreshToken = jwt.sign(
      { userId: user.id, type: "refresh" },
      JWT_SECRET,
      { expiresIn: "30d" }
    )

    cookies().set("kds_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    })

    cookies().set("kds_refresh", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/auth/kds-refresh",
      maxAge: 60 * 60 * 24 * 30,
    })

    return NextResponse.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: "kds" },
      establishment,
    })
  } catch (error) {
    logger.error("kds-login", "falha em KDS Login", { requestId: getRequestId(req), error: (error as any)?.message })
    return NextResponse.json({ error: "Erro ao fazer login" }, { status: 500 })
  }
}
