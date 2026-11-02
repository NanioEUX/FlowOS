import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { getRequestId, logger } from "@/lib/logger"

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: "Email é obrigatório" }, { status: 400 })
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, isActive: true },
    })

    // Always return success to prevent email enumeration
    if (!user || !user.isActive) {
      return NextResponse.json({
        message: "Se o email estiver cadastrado, você receberá um link de redefinição.",
      })
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Delete any existing tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    })

    // Create new token
    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    })

    // In production, send email here
    // F4A-016: o link com o token NUNCA vai para o log (quem lê log da
    // Vercel assumia a conta). Só em dev (SHOW_DEV_CODE=true) ele aparece.
    const resetUrl = `${req.nextUrl.origin}/redefinir-senha?token=${token}`
    if (process.env.SHOW_DEV_CODE === "true") {
      console.log(`[PASSWORD RESET] ${user.email}: ${resetUrl}`)
    } else {
      logger.info("forgot-password", "token de redefinição gerado", { requestId: getRequestId(req), userId: user.id })
    }

    // TODO: Send email with Resend/SendGrid
    // await sendEmail({
    //   to: user.email,
    //   subject: "Redefinição de senha - PedeFácil",
    //   html: `<p>Olá ${user.name},</p><p>Clique no link para redefinir sua senha:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Este link expira em 1 hora.</p>`,
    // })

    return NextResponse.json({
      message: "Se o email estiver cadastrado, você receberá um link de redefinição.",
    })
  } catch (error) {
    logger.error("forgot-password", "falha em FORGOT PASSWORD", { requestId: getRequestId(req), error: (error as any)?.message })
    return NextResponse.json({ error: "Erro ao processar solicitação" }, { status: 500 })
  }
}
