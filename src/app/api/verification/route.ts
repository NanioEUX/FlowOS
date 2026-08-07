import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getWhatsAppProvider } from "@/lib/whatsapp"
import bcrypt from "bcryptjs"

const MAX_ATTEMPTS = 3
const CODE_EXPIRY_MINUTES = 5

/**
 * POST /api/verification
 * Body: { phone: string, establishmentId: string }
 * Generates a 6-digit code, stores it (hashed), and sends via WhatsApp.
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
        whatsappProvider: true,
        evolutionBaseUrl: true,
        evolutionApiKey: true,
        evolutionInstanceName: true,
        whatsappNumber: true,
      },
    })

    if (!establishment) {
      return NextResponse.json({ error: "Estabelecimento não encontrado" }, { status: 404 })
    }

    // Send via WhatsApp (establishment's own or SaaS fallback)
    const provider = getWhatsAppProvider({
      whatsappProvider: establishment.whatsappProvider,
      evolutionBaseUrl: establishment.evolutionBaseUrl,
      evolutionApiKey: establishment.evolutionApiKey,
      evolutionInstanceName: establishment.evolutionInstanceName,
      whatsappNumber: establishment.whatsappNumber,
    })

    const message = `🔐 *${establishment.name}* - Verificação\n\nSeu código de confirmação é: *${code}*\n\n⏱️ Expira em ${CODE_EXPIRY_MINUTES} minutos.\n\nSe você não fez esse pedido, ignore esta mensagem.`

    if (!provider) {
      // Sem Evolution configurada: retorna o código direto na resposta (DEV).
      // Quando configurar Evolution (SaaS ou do restaurante), o código vai pelo WhatsApp.
      console.log(`[VERIFICATION] Code for ${phoneDigits}: ${code}`)
      return NextResponse.json({ success: true, devCode: code, message: "Código gerado (sem WhatsApp configurado). Configure Evolution para envio real." })
    }

    const result = await provider.sendText(phoneDigits, message, { delay: 1000 })

    const showDevCode =
      !result.success ||
      process.env.SHOW_DEV_CODE === "true" ||
      req.nextUrl.searchParams.get("debug") === "1"

    if (!result.success) {
      console.error("[Verification] WhatsApp send failed:", result.error)
      return NextResponse.json({
        success: true,
        devCode: code,
        whatsappSent: false,
        whatsappError: result.error,
        message: "Código gerado (WhatsApp falhou, exibindo código).",
      })
    }

    console.log(`[VERIFICATION OK] Code sent via WhatsApp to ${phoneDigits}: ${code}`)
    return NextResponse.json({
      success: true,
      whatsappSent: true,
      messageId: result.messageId,
      ...(showDevCode ? { devCode: code } : {}),
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
    const updated = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        whatsappVerified: true,
        verifiedAt: new Date(),
        ...(name && !customer.name ? { name } : {}),
      },
    })

    return NextResponse.json({ success: true, customer: { id: updated.id, whatsappVerified: updated.whatsappVerified, name: updated.name } })
  } catch (error) {
    console.error("[Verification PUT]", error)
    return NextResponse.json({ error: "Erro ao verificar código" }, { status: 500 })
  }
}
