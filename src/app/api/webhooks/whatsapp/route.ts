import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getWhatsAppProvider } from "@/lib/whatsapp"
import { getBotConfig, generateBotResponse } from "@/lib/whatsapp/bot"

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()

    const evolutionWebhook = JSON.parse(body)

    if (evolutionWebhook.event !== "messages.upsert") {
      return NextResponse.json({ success: true, ignored: true })
    }

    const data = evolutionWebhook.data
    const instanceName = evolutionWebhook.instance

    if (!data || data.key?.fromMe) {
      return NextResponse.json({ success: true, ignored: true })
    }

    const establishment = await prisma.establishment.findFirst({
      where: {
        evolutionInstanceName: instanceName,
      },
      select: {
        id: true,
        whatsappProvider: true,
        evolutionBaseUrl: true,
        evolutionApiKey: true,
        evolutionInstanceName: true,
        whatsappNumber: true,
        botEnabled: true,
      },
    })

    if (!establishment) {
      console.warn(`[WhatsApp Webhook] Instância não encontrada: ${instanceName}`)
      return NextResponse.json({
        success: false,
        error: "Instância não encontrada",
        hint: "Crie um estabelecimento com esta instanceName via /dashboard/config ou seed-test-establishment.ts",
      }, { status: 404 })
    }

    const provider = getWhatsAppProvider({
      whatsappProvider: establishment.whatsappProvider,
      evolutionBaseUrl: establishment.evolutionBaseUrl,
      evolutionApiKey: establishment.evolutionApiKey,
      evolutionInstanceName: establishment.evolutionInstanceName,
      whatsappNumber: establishment.whatsappNumber,
    })

    if (!provider) {
      return NextResponse.json({ success: false, error: "Provider não configurado" }, { status: 400 })
    }

    const mockReq = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify(evolutionWebhook),
    })

    const parsed = await provider.parseWebhook(mockReq)

    if (!parsed || parsed.fromMe) {
      return NextResponse.json({ success: true, ignored: true })
    }

    console.log(`[WhatsApp] [${establishment.id.slice(0, 8)}] Mensagem de ${parsed.phone}: "${parsed.text}"`)

    const botConfig = await getBotConfig(establishment.id)

    if (!botConfig) {
      console.log(`[WhatsApp] Bot desabilitado para ${establishment.id}`)
      return NextResponse.json({ success: true, botDisabled: true })
    }

    const response = generateBotResponse(parsed.text, botConfig)

    if (!response.shouldRespond || !response.message) {
      console.log(`[WhatsApp] Sem resposta para "${parsed.text}"`)
      return NextResponse.json({ success: true, noResponse: true, receivedText: parsed.text })
    }

    console.log(`[WhatsApp] Respondendo para ${parsed.phone}: "${response.message.substring(0, 50)}..."`)

    const sendResult = await provider.sendText(parsed.phone, response.message, { delay: 2000 })

    if (!sendResult.success) {
      console.error(`[WhatsApp] Erro ao enviar:`, sendResult.error)
      return NextResponse.json({ success: false, error: sendResult.error }, { status: 500 })
    }

    console.log(`[WhatsApp] ✓ Resposta enviada para ${parsed.phone} (messageId: ${sendResult.messageId})`)

    return NextResponse.json({
      success: true,
      messageId: sendResult.messageId,
      receivedText: parsed.text,
      responsePreview: response.message.substring(0, 100),
    })

    return NextResponse.json({ success: true, messageId: sendResult.messageId })
  } catch (error: any) {
    console.error("[WhatsApp Webhook] Erro:", error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok", webhook: "whatsapp" })
}
