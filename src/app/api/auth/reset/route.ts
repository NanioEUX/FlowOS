import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { getRequestId, logger } from "@/lib/logger"

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json()

    if (!token || !password) {
      return NextResponse.json({ error: "Token e senha são obrigatórios" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Senha deve ter no mínimo 6 caracteres" }, { status: 400 })
    }

    // Find valid token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!resetToken) {
      return NextResponse.json({ error: "Token inválido" }, { status: 400 })
    }

    if (resetToken.used) {
      return NextResponse.json({ error: "Token já utilizado" }, { status: 400 })
    }

    if (new Date() > resetToken.expiresAt) {
      return NextResponse.json({ error: "Token expirado. Solicite um novo." }, { status: 400 })
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Update user password
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
      },
    })

    // Mark token as used
    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    })

    return NextResponse.json({
      message: "Senha redefinida com sucesso. Você pode fazer login.",
    })
  } catch (error) {
    logger.error("reset-password", "falha em RESET PASSWORD", { requestId: getRequestId(req), error: (error as any)?.message })
    return NextResponse.json({ error: "Erro ao redefinir senha" }, { status: 500 })
  }
}
