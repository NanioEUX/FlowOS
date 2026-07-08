import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit"

const JWT_SECRET = process.env.JWT_SECRET!

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (err: any) {
      if (i === retries || !err?.message?.includes("pool") && !err?.code?.includes("P1001") && !err?.message?.includes("Connection")) throw err
      await new Promise((r) => setTimeout(r, 200 * (i + 1)))
    }
  }
  throw new Error("unreachable")
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha são obrigatórios" }, { status: 400 })
    }

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"
    const { allowed } = checkRateLimit(`login-user:${ip}`, 15, 60_000)
    if (!allowed) {
      return NextResponse.json({ error: "Muitas tentativas. Tente novamente em 1 minuto." }, { status: 429 })
    }

    const user = await withRetry(() => prisma.user.findUnique({ where: { email } }))
    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 })
    }

    resetRateLimit(`login-user:${ip}`)

    const establishment = await withRetry(() =>
      prisma.establishment.findUnique({
        where: { id: user.establishmentId },
        select: {
          id: true, name: true, slug: true, logo: true, description: true, defaultTheme: true,
          subscriptionStatus: true, subscriptionPlan: true,
          trialStartsAt: true, trialEndsAt: true, nextPaymentAt: true,
        },
      })
    )

    const permissions = JSON.parse(user.permissions || '["caixa"]')

    let deliveryPerson = null
    if (user.role === "motoboy") {
      const dp = await withRetry(() =>
        prisma.deliveryPerson.findUnique({
          where: { userId: user.id },
          select: { id: true, token: true, name: true },
        })
      )
      if (dp) {
        deliveryPerson = { id: dp.id, token: dp.token, slug: establishment?.slug }
      }
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, permissions, establishmentId: user.establishmentId },
      JWT_SECRET,
      { expiresIn: "24h" }
    )

    const refreshToken = jwt.sign(
      { userId: user.id, type: "refresh" },
      JWT_SECRET + "-refresh",
      { expiresIn: "7d" }
    )

    let subscriptionExpired = false
    if (establishment) {
      const now = new Date()
      if (establishment.subscriptionStatus === "trial" && establishment.trialEndsAt && new Date(establishment.trialEndsAt) < now) {
        subscriptionExpired = true
      } else if (establishment.subscriptionStatus === "expired") {
        subscriptionExpired = true
      }
    }

    return NextResponse.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions,
        canCloseRegister: user.canCloseRegister,
        mustChangePassword: user.mustChangePassword,
        deliveryPerson,
      },
      establishment,
      subscriptionExpired,
    })
  } catch (error: any) {
    console.error("LOGIN ERROR:", error?.message, error?.code, error?.meta)
    return NextResponse.json({ error: "Erro ao fazer login" }, { status: 500 })
  }
}
