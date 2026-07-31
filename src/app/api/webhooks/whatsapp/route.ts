import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getWhatsAppProvider } from "@/lib/whatsapp"
import { generateBotResponse } from "@/lib/whatsapp/bot"
import { generateAIResponse, isAIAvailable } from "@/lib/whatsapp/ai/openai"
import { loadBotContext, buildSystemPrompt } from "@/lib/whatsapp/ai/prompt"
import {
  isOpenNow,
  formatBusinessHoursForMessage,
  parseBusinessHours,
  randomTypingDelay,
  parseTransferKeywords,
  detectTransferIntent,
} from "@/lib/whatsapp/bot-rules"

export async function POST(req: NextRequest) {
  try {
    console.log(`[WhatsApp] [DEBUG-HIT-V3] webhook recebido, url=${req.url}`)
    // Validação de origem: Evolution API envia o header "apikey" com a
    // chave do webhook (não a API key global). Se não bater com nenhuma
    // chave configurada, rejeita.
    const webhookKey = req.headers.get("apikey") || req.headers.get("x-api-key")
    console.log(`[WhatsApp] [DEBUG-HIT-V3] webhookKey presente=${!!webhookKey}`)
    if (webhookKey) {
      const validKey = await prisma.establishment.findFirst({
        where: { evolutionApiKey: webhookKey },
        select: { id: true },
      })
      if (!validKey) {
        console.warn("[WhatsApp Webhook] Chave de webhook inválida")
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      }
    }

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
      where: { evolutionInstanceName: instanceName },
      select: {
        id: true,
        whatsappProvider: true,
        evolutionBaseUrl: true,
        evolutionApiKey: true,
        evolutionInstanceName: true,
        whatsappNumber: true,
        botEnabled: true,
        botUseAI: true,
        botAgentName: true,
        botGreeting: true,
        botMenuOptions: true,
        botTone: true,
        botFAQ: true,
        botSystemPrompt: true,
        businessHours: true,
        whatsappAutomationEnabled: true,
        aiMessagesUsed: true,
        aiMessagesLimit: true,
        aiMessagesResetAt: true,
        // Bot v2
        botInactivityEnabled: true,
        botInactivityMinutes: true,
        botInactivityMessage: true,
        botTransferEnabled: true,
        botTransferKeywords: true,
        botTransferMessage: true,
        botTypingDelayMinMs: true,
        botTypingDelayMaxMs: true,
        botRespectBusinessHours: true,
        botOutsideHoursMode: true,
        botOutsideHoursMessage: true,
        botAcceptsScheduledOrders: true,
        botScheduledOrderMessage: true,
        botFallbackMessage: true,
        botTemplateOrderConfirmed: true,
        botTemplateOrderPreparing: true,
        botTemplateOrderReady: true,
        botTemplateOrderDelivering: true,
        botTemplateOrderDelivered: true,
        botTemplateOrderCancelled: true,
      },
    })

    if (!establishment) {
      console.warn(`[WhatsApp Webhook] Instância não encontrada: ${instanceName}`)
      return NextResponse.json({
        success: false,
        error: "Instância não encontrada",
      }, { status: 404 })
    }

    // ===== MARCADOR VISÍVEL: confirma que código novo está rodando =====
    if (parsed.text?.toLowerCase().includes("ping")) {
      await provider.sendText(parsed.phone, "🏓 PONG V3 - código novo ativo!", { delay: 500 })
      return NextResponse.json({ success: true, pong: true })
    }

    if (!establishment.whatsappAutomationEnabled) {
      console.log(`[WhatsApp] [${establishment.id.slice(0, 8)}] Automação desabilitada (não pagou plano)`)
      return NextResponse.json({
        success: true,
        automationDisabled: true,
      })
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

    if (!establishment.botEnabled) {
      console.log(`[WhatsApp] Bot desabilitado para ${establishment.id}`)
      return NextResponse.json({ success: true, botDisabled: true })
    }

    // ===== Regras Bot v2 =====

    // 1. Auto-transfer humano (palavras-chave)
    if (establishment.botTransferEnabled) {
      const keywords = parseTransferKeywords(establishment.botTransferKeywords)
      if (detectTransferIntent(parsed.text, keywords)) {
        const customer = await prisma.customer.findFirst({
          where: { phone: parsed.phone, establishmentId: establishment.id },
          select: { id: true },
        })
        if (customer) {
          await prisma.customer.update({
            where: { id: customer.id },
            data: { needsHuman: true, needsHumanAt: new Date() },
          })
        }
        const transferMsg =
          establishment.botTransferMessage ||
          "Vou chamar um atendente para te ajudar. Só um momento! 🙏"
        const delay = randomTypingDelay(
          establishment.botTypingDelayMinMs || 1500,
          establishment.botTypingDelayMaxMs || 3500
        )
        await provider.sendText(parsed.phone, transferMsg, { delay })
        console.log(`[WhatsApp] Transferido para humano (keyword detectada em "${parsed.text}")`)
        return NextResponse.json({ success: true, transferred: true })
      }
    }

    // 2. Fora de horário (se ativado)
    if (establishment.botRespectBusinessHours) {
      const hours = parseBusinessHours(establishment.businessHours)
      if (!isOpenNow(hours)) {
        let outsideMsg =
          establishment.botOutsideHoursMessage ||
          "Estamos fechados no momento. Nosso horário de atendimento é:"
        const formatted = formatBusinessHoursForMessage(hours)
        if (formatted) outsideMsg = `${outsideMsg}\n\n${formatted}`
        if (
          establishment.botOutsideHoursMode === "scheduled" &&
          establishment.botAcceptsScheduledOrders
        ) {
          outsideMsg = `${outsideMsg}\n\n${
            establishment.botScheduledOrderMessage ||
            "Aceito pedidos para agendamento! É só me dizer o que quer e pra quando. 😊"
          }`
        }
        const delay = randomTypingDelay(
          establishment.botTypingDelayMinMs || 1500,
          establishment.botTypingDelayMaxMs || 3500
        )
        await provider.sendText(parsed.phone, outsideMsg, { delay })
        console.log(`[WhatsApp] Fora de horário - respondendo com mensagem padrão`)
        return NextResponse.json({ success: true, outsideHours: true })
      }
    }

    // 3. Inatividade: se cliente não respondeu, encerrar
    if (establishment.botInactivityEnabled) {
      const customer = await prisma.customer.findFirst({
        where: { phone: parsed.phone, establishmentId: establishment.id },
        select: { needsHuman: true },
      })
      if (customer?.needsHuman) {
        // cliente pediu humano antes, bot não responde
        return NextResponse.json({ success: true, ignored: "needsHuman" })
      }
    }

    let responseMessage: string | null = null
    let usedAI = false

    console.log(`[WhatsApp] [DEBUG] botUseAI=${establishment.botUseAI} isAIAvailable=${isAIAvailable()} parsed.text="${parsed.text}"`)

    if (establishment.botUseAI && isAIAvailable()) {
      const aiLimitReached = establishment.aiMessagesUsed >= establishment.aiMessagesLimit
      const needsAI = !isMenuOption(parsed.text, establishment.botMenuOptions) && !isGreeting(parsed.text)

      if (aiLimitReached && needsAI) {
        console.log(`[WhatsApp] Limite IA atingido (${establishment.aiMessagesUsed}/${establishment.aiMessagesLimit}) - usando menu fixo`)
        const botConfig = await loadMenuConfig(establishment)
        if (botConfig) {
          const resp = generateBotResponse(parsed.text, botConfig)
          responseMessage = resp.message || `Olá! Você atingiu o limite de IA deste mês. Por favor, escolha uma opção do menu:\n\n${formatMenuText(establishment.botMenuOptions)}`
        }
        usedAI = false
      } else {
        const greetWords = ["oi", "olá", "ola", "hi", "hello", "menu", "start"]
        const isGreetingMatch = greetWords.includes(parsed.text.toLowerCase().trim())

        const menuOption = isGreetingMatch
          ? null
          : parseMenuOptions(establishment.botMenuOptions).find((o) => o.id === parsed.text.trim())

        if (isGreetingMatch && establishment.botGreeting) {
          responseMessage = formatMenuGreeting(establishment.botAgentName || "Atendente", establishment.botGreeting, establishment.botMenuOptions)
          usedAI = false
        } else if (menuOption) {
          const botConfig = await loadMenuConfig(establishment)
          if (botConfig) {
            responseMessage = generateBotResponse(parsed.text, botConfig).message || null
          }
          usedAI = false
        } else {
          try {
            console.log(`[WhatsApp] [DEBUG] Entrando no try da IA...`)
            const context = await loadBotContext(establishment.id, parsed.phone)
            console.log(`[WhatsApp] [DEBUG] loadBotContext retornou: ${context ? 'OK' : 'NULL'}`)
            if (context) {
              const systemPrompt = buildSystemPrompt(context)
              const aiResult = await generateAIResponse(systemPrompt, parsed.text, [], {
                create_order: async (args: any) => {
                  try {
                    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}` || "http://localhost:3000"}/api/bot/create-order`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        establishmentId: establishment.id,
                        ...args,
                      }),
                    })
                    return await res.json()
                  } catch (e: any) {
                    return { error: e.message }
                  }
                },
              })
              responseMessage = aiResult.text
              usedAI = true
              if (aiResult.toolCalls?.length) {
                console.log(`[WhatsApp] IA usou ${aiResult.toolCalls.length} tool call(s):`, aiResult.toolCalls.map((t) => t.name).join(", "))
              }
              console.log(`[WhatsApp] IA respondeu (${aiResult.totalTokens} tokens, R$ ${(aiResult.costCents / 100).toFixed(4)})`)

              await prisma.$transaction([
                prisma.establishment.update({
                  where: { id: establishment.id },
                  data: {
                    aiMessagesUsed: { increment: 1 },
                    aiMessagesResetAt: establishment.aiMessagesResetAt || new Date(),
                  },
                }),
                prisma.aIUsageLog.create({
                  data: {
                    establishmentId: establishment.id,
                    customerPhone: parsed.phone,
                    inputTokens: aiResult.inputTokens,
                    outputTokens: aiResult.outputTokens,
                    totalTokens: aiResult.totalTokens,
                    costCents: aiResult.costCents,
                    model: "gpt-4o-mini",
                    userMessage: parsed.text.substring(0, 500),
                    responseLength: aiResult.text.length,
                  },
                }),
              ])
            }
          } catch (aiErr: any) {
            console.error(`[WhatsApp] Erro na IA:`, aiErr.message)
            if (establishment.botGreeting) {
              responseMessage = establishment.botGreeting
            }
          }
        }
      }
    } else {
      const botConfig = await loadMenuConfig(establishment)
      if (botConfig) {
        const resp = generateBotResponse(parsed.text, botConfig)
        responseMessage = resp.message || null
      }
    }

    if (!responseMessage) {
      console.log(`[WhatsApp] Sem resposta para "${parsed.text}"`)
      // Fallback: pede pro cliente reformular
      if (establishment.botFallbackMessage) {
        const delay = randomTypingDelay(
          establishment.botTypingDelayMinMs || 1500,
          establishment.botTypingDelayMaxMs || 3500
        )
        await provider.sendText(parsed.phone, establishment.botFallbackMessage, { delay })
        console.log(`[WhatsApp] Fallback enviado`)
        return NextResponse.json({ success: true, fallback: true })
      }
      return NextResponse.json({ success: true, noResponse: true, receivedText: parsed.text })
    }

    console.log(`[WhatsApp] Respondendo (${usedAI ? "IA" : "menu"}): "${responseMessage.substring(0, 50)}..."`)

    const sendResult = await provider.sendText(parsed.phone, responseMessage, {
      delay: randomTypingDelay(
        establishment.botTypingDelayMinMs || 1500,
        establishment.botTypingDelayMaxMs || 3500
      ),
    })

    if (!sendResult.success) {
      console.error(`[WhatsApp] Erro ao enviar:`, sendResult.error)
      return NextResponse.json({ success: false, error: sendResult.error }, { status: 500 })
    }

    console.log(`[WhatsApp] ✓ Resposta enviada para ${parsed.phone}`)

    return NextResponse.json({
      success: true,
      messageId: sendResult.messageId,
      receivedText: parsed.text,
      usedAI,
      responsePreview: responseMessage.substring(0, 100),
    })
  } catch (error: any) {
    console.error("[WhatsApp Webhook] Erro:", error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

function parseMenuOptions(json: string | null | undefined): Array<{ id: string; label: string; response: string }> {
  if (!json) return []
  try {
    return JSON.parse(json)
  } catch {
    return []
  }
}

function isMenuOption(text: string, menuJson: string | null | undefined): boolean {
  const options = parseMenuOptions(menuJson)
  return options.some((o) => o.id === text.trim())
}

function isGreeting(text: string): boolean {
  const greetWords = ["oi", "olá", "ola", "hi", "hello", "menu", "start"]
  return greetWords.includes(text.toLowerCase().trim())
}

function formatMenuText(menuJson: string | null | undefined): string {
  const options = parseMenuOptions(menuJson)
  return options.map((opt, idx) => `${idx + 1}. ${opt.label}`).join("\n")
}

async function loadMenuConfig(establishment: any) {
  const { getBotConfig } = await import("@/lib/whatsapp/bot")
  return getBotConfig(establishment.id)
}

function formatMenuGreeting(agentName: string, greeting: string, menuJson: string | null): string {
  const menuOptions = parseMenuOptions(menuJson)
  const menuText = menuOptions.map((opt, idx) => `${idx + 1}. ${opt.label}`).join("\n")
  return `${greeting}\n\n${menuText}\n\nDigite o *número* da opção desejada ou faça sua pergunta livremente.`
}

export async function GET() {
  return NextResponse.json({ status: "ok", webhook: "whatsapp" })
}
