import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getWhatsAppProvider } from "@/lib/whatsapp"

/**
 * GET /api/cron/verify-reminder (Bearer CRON_SECRET)
 * Envia lembrete no WhatsApp para clientes que solicitaram código de
 * verificação e não confirmaram dentro do atraso configurado pelo
 * estabelecimento (verifyReminderDelayMin). Roda de hora em hora.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = Date.now()
  let sent = 0
  let skipped = 0

  // Estabelecimentos com lembrete ativo
  const establishments = await prisma.establishment.findMany({
    where: { verifyReminderEnabled: true },
    select: {
      id: true,
      name: true,
      verifyReminderDelayMin: true,
      verifyReminderMessage: true,
      whatsappProvider: true,
      evolutionBaseUrl: true,
      evolutionApiKey: true,
      evolutionInstanceName: true,
      whatsappNumber: true,
      metaPhoneNumberId: true,
      metaAccessToken: true,
    },
  })

  for (const establishment of establishments) {
    const provider = getWhatsAppProvider({
      whatsappProvider: establishment.whatsappProvider,
      evolutionBaseUrl: establishment.evolutionBaseUrl,
      evolutionApiKey: establishment.evolutionApiKey,
      evolutionInstanceName: establishment.evolutionInstanceName,
      whatsappNumber: establishment.whatsappNumber,
      metaPhoneNumberId: establishment.metaPhoneNumberId,
      metaAccessToken: establishment.metaAccessToken,
    })
    if (!provider) continue

    const delayMs = (establishment.verifyReminderDelayMin || 60) * 60 * 1000

    // Códigos expirados, não usados e sem lembrete, cujo pedido foi feito há
    // pelo menos verifyReminderDelayMin minutos. O lembrete roda depois que o
    // código já venceu (5 min) mas dentro do delay configurado.
    const codes = await prisma.verificationCode.findMany({
      where: {
        used: false,
        reminderSentAt: null,
        expiresAt: { lt: new Date() },
        customer: { establishmentId: establishment.id },
        createdAt: { lt: new Date(now - delayMs) },
      },
      select: {
        id: true,
        customer: { select: { phone: true, name: true } },
      },
      take: 50,
    })

    for (const code of codes) {
      const phoneDigits = code.customer.phone.replace(/\D/g, "")
      const message = (establishment.verifyReminderMessage || "")
        .replace(/\{\{nome\}\}/g, code.customer.name || "cliente")
        .replace(/\{\{estabelecimento\}\}/g, establishment.name)
      try {
        const result = await provider.sendText(phoneDigits, message, { delay: 1000 })
        if (result.success) {
          await prisma.verificationCode.update({
            where: { id: code.id },
            data: { reminderSentAt: new Date() },
          })
          sent++
        } else {
          skipped++
        }
      } catch {
        skipped++
      }
    }
  }

  console.log(`[Verify Reminder] sent=${sent} skipped=${skipped}`)
  return NextResponse.json({ success: true, sent, skipped })
}
