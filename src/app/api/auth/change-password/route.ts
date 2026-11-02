import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"
import bcrypt from "bcryptjs"
import { getRequestId, logger } from "@/lib/logger"

export async function POST(req: NextRequest) {
  try {
    const authUser = verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Autenticação necessária" }, { status: 401 })
    }

    const { currentPassword, newPassword } = await req.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Senha atual e nova senha são obrigatórias" }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Nova senha deve ter no mínimo 6 caracteres" }, { status: 400 })
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { id: true, password: true },
    })

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    // Verify current password
    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) {
      return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 })
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
      },
    })

    return NextResponse.json({
      message: "Senha alterada com sucesso",
    })
  } catch (error) {
    logger.error("change-password", "falha em CHANGE PASSWORD", { requestId: getRequestId(req), error: (error as any)?.message })
    return NextResponse.json({ error: "Erro ao alterar senha" }, { status: 500 })
  }
}
