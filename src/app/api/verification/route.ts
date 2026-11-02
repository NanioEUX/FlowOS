import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getWhatsAppProvider } from "@/lib/whatsapp"
import { normalizePhone, maskPhone } from "@/lib/phone"
import { checkRateLimit } from "@/lib/rate-limit"
import {
  signCustomerSession,
  CUSTOMER_SESSION_COOKIE,
  customerSessionCookieOptions,
  clearCustomerSessionCookieOptions,
} from "@/lib/customer-auth"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { getRequestId, logger } from "@/lib/logger"
import { redactObject } from "@/lib/redact"

const MAX_ATTEMPTS = 3
const CODE_EXPIRY_MINUTES = 5
const REQUEST_COOLDOWN_MS = 60 * 1000
const MAX_REQUESTS_PER_HOUR = 5
const MAX_REQUESTS_PER_DAY = 10
const MAX_VERIFICATIONS_PER_DAY = 5
// Limite best-effort por IP (memória por instância — F7A-009). O limite por
// número continua em banco e é a trava principal.
const MAX_REQUESTS_PER_IP_PER_HOUR = 20
const CODE_RETENTION_DAYS = 7

// Nunca em produção: só o gate explícito do env libera o devCode (F7A-001)
const SHOW_DEV_CODE = process.env.SHOW_DEV_CODE === "true"

// Resposta única para qualquer falha de validação (F7A-011/017):
// errado, expirado, esgotado ou cliente inexistente são indistinguíveis.
const INVALID_CODE_RESPONSE = { error: "Código inválido ou expirado. Solicite um novo." }

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return req.headers.get("x-real-ip") || "unknown"
}

/**
 * POST /api/verification
 * Body: { phone: string, establishmentId: string }
 * Generates a 6-digit code, stores it (hashed), and sends via WhatsApp.
 * Rate limited por número: 60s de cooldown, máx 5/hora e máx 10/dia.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { phone, establishmentId, name } = body

    if (!phone || !establishmentId) {
      return NextResponse.json({ error: "phone e establishmentId são obrigatórios" }, { status: 400 })
    }

    // Normalização única (F7A-010): 55/E.164 → DDD+número, 10-11 dígitos
    const phoneDigits = normalizePhone(phone)
    if (!phoneDigits) {
      return NextResponse.json({ error: "Telefone inválido" }, { status: 400 })
    }

    // ---- Rate limit por IP (best-effort, F7A-009) ----
    const ipLimit = checkRateLimit(`otp-ip:${clientIp(req)}`, MAX_REQUESTS_PER_IP_PER_HOUR, 60 * 60 * 1000)
    if (!ipLimit.allowed) {
      return NextResponse.json({ error: "Muitas solicitações. Tente novamente mais tarde." }, { status: 429 })
    }

    // Poda de códigos antigos (F7A-022) — fire and forget no fluxo
    prisma.verificationCode
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - CODE_RETENTION_DAYS * 24 * 60 * 60 * 1000) } } })
      .catch(() => {})

    // Valida o estabelecimento ANTES de criar Customer/VerificationCode
    // (F7A-018): loja inexistente/cancelada não gera registro nem custo.
    const establishment = await prisma.establishment.findUnique({
      where: { id: establishmentId },
      select: {
        name: true,
        slug: true,
        subscriptionStatus: true,
        messagingLimit: true,
        currentUsage: true,
        whatsappProvider: true,
        evolutionBaseUrl: true,
        evolutionApiKey: true,
        evolutionInstanceName: true,
        whatsappNumber: true,
        metaPhoneNumberId: true,
        metaAccessToken: true,
        metaBusinessAccountId: true,
      },
    })
    if (!establishment) {
      return NextResponse.json({ error: "Estabelecimento não encontrado" }, { status: 404 })
    }
    if (establishment.subscriptionStatus === "cancelled" || establishment.subscriptionStatus === "suspended") {
      return NextResponse.json({ error: "Estabelecimento não disponível" }, { status: 404 })
    }

    // Cota Meta por loja antes do envio (F7A-012): se o consumo já bateu o
    // limite do tier, não gera código nem cobra mensagem.
    if (
      establishment.messagingLimit != null &&
      establishment.currentUsage != null &&
      establishment.currentUsage >= establishment.messagingLimit
    ) {
      return NextResponse.json(
        { error: "Canal de mensagens da loja atingiu o limite. Tente mais tarde ou contate o suporte." },
        { status: 429 }
      )
    }

    // Find or create customer
    let customer = await prisma.customer.findFirst({
      where: { phone: phoneDigits, establishmentId },
    })

    if (!customer) {
      // Customer does NOT exist at this establishment — create a new record here.
      // Each establishment has its own isolated customer record.
      customer = await prisma.customer.create({
        data: {
          phone: phoneDigits,
          establishmentId,
          ...(name ? { name } : {}),
        },
      })
    } else if (name && !customer.name) {
      // Update name if customer exists but doesn't have one yet
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: { name },
      })
    }

    // ---- Rate limits (por número) ----
    const now = Date.now()

    // 1) Cooldown de 60s entre solicitações
    const lastCode = await prisma.verificationCode.findFirst({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
    })
    if (lastCode && now - new Date(lastCode.createdAt).getTime() < REQUEST_COOLDOWN_MS) {
      const wait = Math.ceil((REQUEST_COOLDOWN_MS - (now - new Date(lastCode.createdAt).getTime())) / 1000)
      return NextResponse.json({ error: `Aguarde ${wait}s antes de solicitar outro código.` }, { status: 429 })
    }

    // 2) Máx 5 solicitações/hora
    const hourAgo = new Date(now - 60 * 60 * 1000)
    const requestsLastHour = await prisma.verificationCode.count({
      where: { customerId: customer.id, createdAt: { gte: hourAgo } },
    })
    if (requestsLastHour >= MAX_REQUESTS_PER_HOUR) {
      return NextResponse.json({ error: "Muitas solicitações. Tente novamente mais tarde." }, { status: 429 })
    }

    // 3) Máx 10 solicitações/dia
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000)
    const requestsLastDay = await prisma.verificationCode.count({
      where: { customerId: customer.id, createdAt: { gte: dayAgo } },
    })
    if (requestsLastDay >= MAX_REQUESTS_PER_DAY) {
      return NextResponse.json({ error: "Limite diário de solicitações atingido. Tente novamente amanhã." }, { status: 429 })
    }

    // Rate limit: invalidate previous unused codes
    await prisma.verificationCode.updateMany({
      where: { customerId: customer.id, used: false },
      data: { used: true },
    })

    // Generate code — crypto (F7A-002: nunca Math.random)
    const code = crypto.randomInt(100000, 1000000).toString()
    const codeHash = await bcrypt.hash(code, 10)
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000)

    await prisma.verificationCode.create({
      data: {
        customerId: customer.id,
        codeHash,
        expiresAt,
        purpose: "whatsapp_verify",
      },
    })

    // establishment já foi validado no topo do handler (F7A-018)

    logger.info("verification", "configuração do provedor", { requestId: getRequestId(req), establishmentId, whatsappProvider: establishment.whatsappProvider, metaPhoneNumberId: establishment.metaPhoneNumberId, hasMetaAccessToken: !!establishment.metaAccessToken })

    // Send via WhatsApp (establishment's own or SaaS fallback)
    const provider = getWhatsAppProvider({
      whatsappProvider: establishment.whatsappProvider,
      evolutionBaseUrl: establishment.evolutionBaseUrl,
      evolutionApiKey: establishment.evolutionApiKey,
      evolutionInstanceName: establishment.evolutionInstanceName,
      whatsappNumber: establishment.whatsappNumber,
      metaPhoneNumberId: establishment.metaPhoneNumberId,
      metaAccessToken: establishment.metaAccessToken,
    })

    logger.info("verification", "provedor de WhatsApp criado", { requestId: getRequestId(req), establishmentId, hasProvider: !!provider })

    if (!provider) {
      logger.error("verification", "nenhum provedor de WhatsApp configurado", { requestId: getRequestId(req), establishmentId })
      return NextResponse.json({
        success: true,
        whatsappSent: false,
        whatsappError: "Canal de WhatsApp não configurado. Contate o suporte.",
        // Código nunca volta na resposta em produção (F7A-001)
        ...(SHOW_DEV_CODE ? { devCode: code } : {}),
      })
    }

    // Use template FIRST (works for new numbers), text as fallback
    let result: any = { success: false }

    // 1) Try template message first (works even without prior interaction)
    if ('sendTemplate' in provider) {
      // Find an approved template in the WABA
      let templateName = "atualizacao_suporte_v1" // default fallback

      try {
        const { findApprovedTemplate } = await import("@/lib/whatsapp/meta")
        if (establishment.metaBusinessAccountId && establishment.metaAccessToken) {
          const found = await findApprovedTemplate(establishment.metaBusinessAccountId, establishment.metaAccessToken)
          if (found.found && found.templateName) {
            templateName = found.templateName
            logger.info("verification", "usando template aprovado", { requestId: getRequestId(req), establishmentId, templateName })
          } else {
            logger.info("verification", "nenhum template aprovado — usando o padrão", { requestId: getRequestId(req), establishmentId, templateName })
          }
        }
      } catch (findErr: any) {
        logger.error("verification", "falha ao buscar template aprovado", { requestId: getRequestId(req), establishmentId, error: findErr?.message })
      }

      logger.info("verification", "tentando o template primeiro", { requestId: getRequestId(req), establishmentId, templateName })
      let templateResult = await (provider as any).sendTemplate(
        phoneDigits,
        templateName,
        "pt_BR",
        [code]
      )
      logger.info("verification", "resultado do sendTemplate", { requestId: getRequestId(req), establishmentId, result: redactObject(templateResult) })

      // If template not found, create and retry
      if (!templateResult.success && templateResult.error?.includes("does not exist")) {
        logger.info("verification", "template não encontrado — criando automaticamente", { requestId: getRequestId(req), establishmentId })
        try {
          const { createDefaultVerificationTemplate } = await import("@/lib/whatsapp/meta")
          const est = await prisma.establishment.findUnique({
            where: { id: establishmentId },
            select: { metaBusinessAccountId: true, metaAccessToken: true },
          })
          if (est?.metaBusinessAccountId && est?.metaAccessToken) {
            const createResult = await createDefaultVerificationTemplate(
              est.metaBusinessAccountId,
              est.metaAccessToken
            )
            logger.info("verification", "template criado", { requestId: getRequestId(req), establishmentId, result: redactObject(createResult) })

            if (createResult.success) {
              await new Promise(resolve => setTimeout(resolve, 3000))
              templateResult = await (provider as any).sendTemplate(
                phoneDigits,
                templateName,
                "pt_BR",
                [code]
              )
              logger.info("verification", "resultado do sendTemplate na segunda tentativa", { requestId: getRequestId(req), establishmentId, result: redactObject(templateResult) })
            }
          }
        } catch (createErr: any) {
          logger.error("verification", "falha ao criar template automaticamente", { requestId: getRequestId(req), establishmentId, error: createErr?.message })
        }
      }

      if (templateResult.success) {
        result = templateResult
      }
    }

    // 2) If template failed, try text (only works if customer has messaged before)
    if (!result.success) {
      logger.info("verification", "template falhou — tentando texto", { requestId: getRequestId(req), establishmentId })
      const message = `🔐 *${establishment.name}* - Verificação\n\nSeu código de confirmação é:\n\n*${code}*\n\n1️⃣ Toque e segure no código acima para copiar\n\n⏱️ Expira em ${CODE_EXPIRY_MINUTES} minutos.\n\nSe você não fez esse pedido, ignore esta mensagem.`
      const textResult = await provider.sendText(phoneDigits, message, { delay: 1000 })
      logger.info("verification", "resultado do envio por texto", { requestId: getRequestId(req), establishmentId, result: redactObject(textResult) })
      if (textResult.success) {
        result = textResult
      }
    }

    if (!result.success) {
      logger.error("verification", "falha ao enviar a mensagem no WhatsApp", { requestId: getRequestId(req), establishmentId, error: result?.error })
      return NextResponse.json({
        success: true,
        whatsappSent: false,
        whatsappError: "Não foi possível enviar o código por WhatsApp. Tente novamente em instantes.",
        // Código nunca volta na resposta em produção (F7A-001)
        ...(SHOW_DEV_CODE ? { devCode: code } : {}),
      })
    }

    logger.info("verification", "código enviado via WhatsApp", { requestId: getRequestId(req), establishmentId, phone: maskPhone(phoneDigits) })
    return NextResponse.json({
      success: true,
      whatsappSent: true,
      messageId: result.messageId,
    })
  } catch (error) {
    logger.error("verification", "falha ao iniciar a verificação", { requestId: getRequestId(req), error: (error as any)?.message })
    return NextResponse.json({ error: "Erro ao gerar código" }, { status: 500 })
  }
}

/**
 * PUT /api/verification
 * Body: { phone: string, establishmentId: string, code: string, name?: string }
 * Verifies the code, marks customer as whatsappVerified and issues the
 * customer session cookie (httpOnly, 30 dias — F7A-015).
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { phone, establishmentId, code, name } = body

    if (!phone || !establishmentId || !code) {
      return NextResponse.json({ error: "phone, establishmentId e code são obrigatórios" }, { status: 400 })
    }

    const phoneDigits = normalizePhone(phone)
    if (!phoneDigits) {
      return NextResponse.json(INVALID_CODE_RESPONSE, { status: 400 })
    }

    const customer = await prisma.customer.findFirst({
      where: { phone: phoneDigits, establishmentId },
    })

    // Sem enumeração (F7A-017): cliente inexistente responde igual a código errado
    if (!customer) {
      return NextResponse.json(INVALID_CODE_RESPONSE, { status: 400 })
    }

    // ---- Limite de verificações/logins por número (máx 5/24h) ----
    const now = Date.now()
    if (customer.verificationCount >= MAX_VERIFICATIONS_PER_DAY) {
      const lastVerified = customer.verifiedAt ? new Date(customer.verifiedAt).getTime() : 0
      const windowStart = now - 24 * 60 * 60 * 1000
      if (lastVerified > windowStart) {
        return NextResponse.json({ error: "Limite de verificações diárias atingido. Tente novamente amanhã." }, { status: 429 })
      }
    }

    // Get latest unused code
    const codeRecord = await prisma.verificationCode.findFirst({
      where: {
        customerId: customer.id,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    })

    if (!codeRecord) {
      return NextResponse.json(INVALID_CODE_RESPONSE, { status: 400 })
    }

    // Consome a tentativa ANTES do compare, de forma atômica (F7A-011):
    // no máximo 3 bcrypt.compare por código, mesmo com requisições paralelas.
    const bumped = await prisma.verificationCode.updateMany({
      where: { id: codeRecord.id, used: false, attempts: { lt: MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    })
    if (bumped.count === 0) {
      return NextResponse.json(INVALID_CODE_RESPONSE, { status: 400 })
    }

    const match = await bcrypt.compare(String(code).trim(), codeRecord.codeHash)
    if (!match) {
      // Sem contador de restantes na resposta (F7A-011/017)
      return NextResponse.json(INVALID_CODE_RESPONSE, { status: 400 })
    }

    // Mark code as used
    await prisma.verificationCode.update({
      where: { id: codeRecord.id },
      data: { used: true },
    })

    // Mark customer as verified (and update name if provided)
    const lastVerifiedAt = customer.verifiedAt ? new Date(customer.verifiedAt).getTime() : 0
    const resetCount = now - lastVerifiedAt >= 24 * 60 * 60 * 1000
    const updated = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        whatsappVerified: true,
        verifiedAt: new Date(),
        verificationCount: resetCount ? 1 : { increment: 1 },
        ...(name && !customer.name ? { name } : {}),
      },
    })

    // Sessão de cliente (F7A-015): cookie httpOnly assinado — as rotas de
    // cliente (orders/customer, addresses, customers PUT) passam a exigir ele.
    const sessionToken = await signCustomerSession({
      customerId: updated.id,
      establishmentId,
      phone: phoneDigits,
    })
    const res = NextResponse.json({
      success: true,
      customer: { id: updated.id, whatsappVerified: updated.whatsappVerified, name: updated.name },
    })
    res.cookies.set(CUSTOMER_SESSION_COOKIE, sessionToken, customerSessionCookieOptions())
    return res
  } catch (error) {
    logger.error("verification", "falha ao confirmar a verificação", { requestId: getRequestId(req), error: (error as any)?.message })
    return NextResponse.json({ error: "Erro ao verificar código" }, { status: 500 })
  }
}

/**
 * DELETE /api/verification — logout do cliente final: limpa o cookie de sessão.
 * (Logout é explícito; o token continua expirando sozinho em 30 dias.)
 */
export async function DELETE() {
  const res = NextResponse.json({ success: true })
  res.cookies.set(CUSTOMER_SESSION_COOKIE, "", clearCustomerSessionCookieOptions())
  return res
}
