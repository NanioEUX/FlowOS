import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getWhatsAppProvider } from "@/lib/whatsapp"
import bcrypt from "bcryptjs"
import crypto from "crypto"

const MAX_ATTEMPTS = 3
const CODE_EXPIRY_MINUTES = 5
const REQUEST_COOLDOWN_MS = 60 * 1000
const MAX_REQUESTS_PER_HOUR = 5
const MAX_REQUESTS_PER_DAY = 10
const MAX_VERIFICATIONS_PER_DAY = 5

// Nunca em produção: só o gate explícito do env libera o devCode (F7A-001)
const SHOW_DEV_CODE = process.env.SHOW_DEV_CODE === "true"

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

    const phoneDigits = phone.replace(/\D/g, "")
    if (phoneDigits.length < 10) {
      return NextResponse.json({ error: "Telefone inválido" }, { status: 400 })
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

    // Get establishment for WhatsApp config and name
    const establishment = await prisma.establishment.findUnique({
      where: { id: establishmentId },
      select: {
        name: true,
        slug: true,
        whatsappProvider: true,
        evolutionBaseUrl: true,
        evolutionApiKey: true,
        evolutionInstanceName: true,
        whatsappNumber: true,
        metaPhoneNumberId: true,
        metaAccessToken: true,
      },
    })

    if (!establishment) {
      return NextResponse.json({ error: "Estabelecimento não encontrado" }, { status: 404 })
    }

    console.log(`[VERIFICATION DEBUG] Provider config: whatsappProvider=${establishment.whatsappProvider}, metaPhoneNumberId=${establishment.metaPhoneNumberId}, metaAccessToken=${establishment.metaAccessToken ? "SET" : "NULL"}`)

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

    console.log(`[VERIFICATION DEBUG] Provider created: ${provider ? 'OK (' + provider.constructor.name + ')' : 'NULL'}`)

    if (!provider) {
      console.error(`[VERIFICATION] No provider configured for establishment ${establishmentId}`)
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
        const est = await prisma.establishment.findUnique({
          where: { id: establishmentId },
          select: { metaBusinessAccountId: true, metaAccessToken: true },
        })
        if (est?.metaBusinessAccountId && est?.metaAccessToken) {
          const found = await findApprovedTemplate(est.metaBusinessAccountId, est.metaAccessToken)
          if (found.found && found.templateName) {
            templateName = found.templateName
            console.log(`[VERIFICATION] Using approved template: ${templateName}`)
          } else {
            console.log(`[VERIFICATION] No approved template found, trying default: ${templateName}`)
          }
        }
      } catch (findErr: any) {
        console.error(`[VERIFICATION] findApprovedTemplate failed:`, findErr.message)
      }

      console.log(`[VERIFICATION] Trying template "${templateName}" first...`)
      let templateResult = await (provider as any).sendTemplate(
        phoneDigits,
        templateName,
        "pt_BR",
        [code]
      )
      console.log(`[VERIFICATION] sendTemplate result:`, JSON.stringify(templateResult))

      // If template not found, create and retry
      if (!templateResult.success && templateResult.error?.includes("does not exist")) {
        console.log(`[VERIFICATION] Template not found, creating automatically...`)
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
            console.log(`[VERIFICATION] Template created:`, JSON.stringify(createResult))

            if (createResult.success) {
              await new Promise(resolve => setTimeout(resolve, 3000))
              templateResult = await (provider as any).sendTemplate(
                phoneDigits,
                templateName,
                "pt_BR",
                [code]
              )
              console.log(`[VERIFICATION] Retry sendTemplate result:`, JSON.stringify(templateResult))
            }
          }
        } catch (createErr: any) {
          console.error(`[VERIFICATION] Auto-create template failed:`, createErr.message)
        }
      }

      if (templateResult.success) {
        result = templateResult
      }
    }

    // 2) If template failed, try text (only works if customer has messaged before)
    if (!result.success) {
      console.log(`[VERIFICATION] Template failed, trying text...`)
      const message = `🔐 *${establishment.name}* - Verificação\n\nSeu código de confirmação é:\n\n*${code}*\n\n1️⃣ Toque e segure no código acima para copiar\n\n⏱️ Expira em ${CODE_EXPIRY_MINUTES} minutos.\n\nSe você não fez esse pedido, ignore esta mensagem.`
      const textResult = await provider.sendText(phoneDigits, message, { delay: 1000 })
      console.log(`[VERIFICATION] sendText result:`, JSON.stringify(textResult))
      if (textResult.success) {
        result = textResult
      }
    }

    if (!result.success) {
      console.error("[Verification] WhatsApp send failed:", result.error)
      return NextResponse.json({
        success: true,
        whatsappSent: false,
        whatsappError: "Não foi possível enviar o código por WhatsApp. Tente novamente em instantes.",
        // Código nunca volta na resposta em produção (F7A-001)
        ...(SHOW_DEV_CODE ? { devCode: code } : {}),
      })
    }

    console.log(`[VERIFICATION OK] Code sent via WhatsApp to ${phoneDigits}`)
    return NextResponse.json({
      success: true,
      whatsappSent: true,
      messageId: result.messageId,
    })
  } catch (error) {
    console.error("[Verification POST]", error)
    return NextResponse.json({ error: "Erro ao gerar código" }, { status: 500 })
  }
}

/**
 * PUT /api/verification
 * Body: { phone: string, establishmentId: string, code: string, name?: string }
 * Verifies the code, marks customer as whatsappVerified. Optionally updates name.
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { phone, establishmentId, code, name } = body

    if (!phone || !establishmentId || !code) {
      return NextResponse.json({ error: "phone, establishmentId e code são obrigatórios" }, { status: 400 })
    }

    const phoneDigits = phone.replace(/\D/g, "")

    const customer = await prisma.customer.findFirst({
      where: { phone: phoneDigits, establishmentId },
    })

    if (!customer) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 })
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
      return NextResponse.json({ error: "Código expirado ou não encontrado. Solicite um novo." }, { status: 400 })
    }

    if (codeRecord.attempts >= MAX_ATTEMPTS) {
      return NextResponse.json({ error: "Muitas tentativas. Solicite um novo código." }, { status: 429 })
    }

    const match = await bcrypt.compare(code.trim(), codeRecord.codeHash)

    if (!match) {
      // Increment attempts
      await prisma.verificationCode.update({
        where: { id: codeRecord.id },
        data: { attempts: { increment: 1 } },
      })
      const remaining = MAX_ATTEMPTS - codeRecord.attempts - 1
      return NextResponse.json({ error: `Código incorreto. ${remaining > 0 ? `${remaining} tentativa(s) restante(s).` : "Solicite um novo código."}` }, { status: 400 })
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

    return NextResponse.json({ success: true, customer: { id: updated.id, whatsappVerified: updated.whatsappVerified, name: updated.name } })
  } catch (error) {
    console.error("[Verification PUT]", error)
    return NextResponse.json({ error: "Erro ao verificar código" }, { status: 500 })
  }
}
