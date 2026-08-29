import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getWhatsAppProvider } from "@/lib/whatsapp"
import bcrypt from "bcryptjs"

const MAX_ATTEMPTS = 3
const CODE_EXPIRY_MINUTES = 5
const REQUEST_COOLDOWN_MS = 60 * 1000
const MAX_REQUESTS_PER_HOUR = 5
const MAX_REQUESTS_PER_DAY = 10
const MAX_VERIFICATIONS_PER_DAY = 5

// Números com limite diário dispensado (testes internos)
const BYPASS_PHONES = new Set(["47984118220"])

/**
 * POST /api/verification
 * Body: { phone: string, establishmentId: string }
 * Generates a 6-digit code, stores it (hashed), and sends via WhatsApp.
 * Rate limited por número: 60s de cooldown, máx 5/hora e máx 10/dia
 * (sem limite diário para números em BYPASS_PHONES).
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
    const bypassLimits = BYPASS_PHONES.has(phoneDigits)

    // 1) Cooldown de 60s entre solicitações
    const lastCode = await prisma.verificationCode.findFirst({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
    })
    if (lastCode && now - new Date(lastCode.createdAt).getTime() < REQUEST_COOLDOWN_MS) {
      const wait = Math.ceil((REQUEST_COOLDOWN_MS - (now - new Date(lastCode.createdAt).getTime())) / 1000)
      return NextResponse.json({ error: `Aguarde ${wait}s antes de solicitar outro código.` }, { status: 429 })
    }

    // 2) Máx 5 solicitações/hora (dispensado para números de teste)
    const hourAgo = new Date(now - 60 * 60 * 1000)
    const requestsLastHour = await prisma.verificationCode.count({
      where: { customerId: customer.id, createdAt: { gte: hourAgo } },
    })
    if (!bypassLimits && requestsLastHour >= MAX_REQUESTS_PER_HOUR) {
      return NextResponse.json({ error: "Muitas solicitações. Tente novamente mais tarde." }, { status: 429 })
    }

    // 3) Máx 10 solicitações/dia (dispensado para números de teste)
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000)
    const requestsLastDay = await prisma.verificationCode.count({
      where: { customerId: customer.id, createdAt: { gte: dayAgo } },
    })
    if (!bypassLimits && requestsLastDay >= MAX_REQUESTS_PER_DAY) {
      return NextResponse.json({ error: "Limite diário de solicitações atingido. Tente novamente amanhã." }, { status: 429 })
    }

    // Rate limit: invalidate previous unused codes
    await prisma.verificationCode.updateMany({
      where: { customerId: customer.id, used: false },
      data: { used: true },
    })

    // Generate code
    const code = Math.floor(100000 + Math.random() * 900000).toString()
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

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "https://flowoshub.com"
    const verifyLink = `${appUrl}/${establishment.slug}?code=${code}&phone=${phoneDigits}`

    console.log(`[VERIFICATION DEBUG] Provider config: whatsappProvider=${establishment.whatsappProvider}, metaPhoneNumberId=${establishment.metaPhoneNumberId}, metaAccessToken=${establishment.metaAccessToken ? establishment.metaAccessToken.substring(0, 20) + '...' : 'NULL'}`)

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
      // Sem provider configurado: retorna o código direto na resposta (DEV).
      console.log(`[VERIFICATION FALLBACK] Code for ${phoneDigits}: ${code} - NO PROVIDER`)
      return NextResponse.json({ success: true, devCode: code, verifyLink, message: "Código gerado (sem WhatsApp configurado). Configure provider para envio real." })
    }

    // Use sendText to send verification code
    const message = `🔐 *${establishment.name}* - Verificação\n\nSeu código de confirmação é:\n\n*${code}*\n\n1️⃣ Toque e segure no código acima para copiar\n\n⏱️ Expira em ${CODE_EXPIRY_MINUTES} minutos.\n\nSe você não fez esse pedido, ignore esta mensagem.`
    const result = await provider.sendText(phoneDigits, message, { delay: 1000 })
    console.log(`[VERIFICATION] sendText result:`, JSON.stringify(result))

    const showDevCode =
      !result.success ||
      process.env.SHOW_DEV_CODE === "true" ||
      req.nextUrl.searchParams.get("debug") === "1"

    if (!result.success) {
      console.error("[Verification] WhatsApp send failed:", result.error)
      return NextResponse.json({
        success: true,
        devCode: code,
        verifyLink,
        whatsappSent: false,
        whatsappError: result.error,
        message: "Código gerado (WhatsApp falhou, exibindo código).",
      })
    }

    console.log(`[VERIFICATION OK] Code sent via WhatsApp to ${phoneDigits}: ${code}`)
    return NextResponse.json({
      success: true,
      whatsappSent: true,
      verifyLink,
      messageId: result.messageId,
      devCode: code,
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
    if (!BYPASS_PHONES.has(phoneDigits) && customer.verificationCount >= MAX_VERIFICATIONS_PER_DAY) {
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
