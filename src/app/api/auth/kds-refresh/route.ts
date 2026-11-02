import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET!

// F8B-007: o KDS fica aberto o turno inteiro na TV. Quando o access token (24h)
// expira, o front chama esta rota com o cookie de refresh (30d) e continua
// operando — em vez de a tela silenciar e os botões morrerem em 401.
export async function POST(req: NextRequest) {
  try {
    const refreshToken = cookies().get("kds_refresh")?.value
    if (!refreshToken) {
      return NextResponse.json({ error: "Sessão expirada" }, { status: 401 })
    }

    let payload: any
    try {
      payload = jwt.verify(refreshToken, JWT_SECRET)
    } catch {
      return NextResponse.json({ error: "Sessão expirada" }, { status: 401 })
    }

    if (payload?.type !== "refresh" || !payload?.userId) {
      return NextResponse.json({ error: "Token de refresh inválido" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, isActive: true, establishmentId: true },
    })

    if (!user || !user.isActive || user.role !== "kds" || !user.establishmentId) {
      return NextResponse.json({ error: "Sessão expirada" }, { status: 401 })
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: "kds", establishmentId: user.establishmentId },
      JWT_SECRET,
      { expiresIn: "24h" }
    )

    // rotação do refresh: um cookie de refresh por sessão
    const newRefreshToken = jwt.sign(
      { userId: user.id, type: "refresh" },
      JWT_SECRET,
      { expiresIn: "30d" }
    )

    cookies().set("kds_refresh", newRefreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/auth/kds-refresh",
      maxAge: 60 * 60 * 24 * 30,
    })

    return NextResponse.json({ token })
  } catch (error) {
    console.error("[KDS Refresh]", error)
    return NextResponse.json({ error: "Erro ao renovar a sessão" }, { status: 500 })
  }
}
