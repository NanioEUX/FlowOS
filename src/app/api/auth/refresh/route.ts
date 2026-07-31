import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET!

export async function POST(req: NextRequest) {
  try {
    const { refreshToken } = await req.json()

    if (!refreshToken) {
      return NextResponse.json({ error: "Refresh token obrigatório" }, { status: 400 })
    }

    // Verify refresh token
    let payload: any
    try {
      payload = jwt.verify(refreshToken, JWT_SECRET + "-refresh") as any
    } catch {
      return NextResponse.json({ error: "Refresh token inválido ou expirado" }, { status: 401 })
    }

    // Check if user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, permissions: true, isActive: true, establishmentId: true },
    })

    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Usuário não encontrado ou inativo" }, { status: 401 })
    }

    const permissions = JSON.parse(user.permissions || '["caixa"]')

    // Generate new access token (24h)
    const newToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, permissions, establishmentId: user.establishmentId },
      JWT_SECRET,
      { expiresIn: "24h" }
    )

    // Generate new refresh token (7 days)
    const newRefreshToken = jwt.sign(
      { userId: user.id, type: "refresh" },
      JWT_SECRET + "-refresh",
      { expiresIn: "7d" }
    )

    cookies().set("auth_token", newToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    })

    return NextResponse.json({
      token: newToken,
      refreshToken: newRefreshToken,
    })
  } catch (error) {
    console.error("[refresh-token]", error)
    return NextResponse.json({ error: "Erro ao renovar token" }, { status: 500 })
  }
}
