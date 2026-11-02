import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { verifyAuth } from "@/lib/auth"
import { getRequestId, logger } from "@/lib/logger"

export async function POST(req: NextRequest) {
  try {
    const { userId, currentPassword, newPassword } = await req.json()

    if (!userId || !currentPassword || !newPassword) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

    if (newPassword.length < 4) {
      return NextResponse.json({ error: "Nova senha deve ter pelo menos 4 caracteres" }, { status: 400 })
    }

    const user = await verifyAuth(req)
    if (user) {
      if (user.userId !== userId && user.role !== "admin") {
        return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
      }
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } })
    if (!targetUser) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    const valid = await bcrypt.compare(currentPassword, targetUser.password)
    if (!valid) {
      return NextResponse.json({ error: "Senha atual incorreta" }, { status: 401 })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12)

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("users/change-password", "falha na operação", { requestId: getRequestId(req), error: (error as any)?.message })
    return NextResponse.json({ error: "Erro ao alterar senha" }, { status: 500 })
  }
}
