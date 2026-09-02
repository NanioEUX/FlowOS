import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getWhatsAppProvider } from "@/lib/whatsapp"
import { generateBotResponse } from "@/lib/whatsapp/bot"
import { generateAIResponse, isAIAvailable } from "@/lib/whatsapp/ai/openai"
import { loadBotContext, buildSystemPrompt } from "@/lib/whatsapp/ai/prompt"
import { matchGlobalQuickReply, fillQuickReplyPlaceholders } from "@/lib/whatsapp/quick-replies"
import {
  isOpenNow,
  formatBusinessHoursForMessage,
  parseBusinessHours,
  randomTypingDelay,
  parseTransferKeywords,
  detectTransferIntent,
} from "@/lib/whatsapp/bot-rules"

const META_WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || "flowos-meta-verify"

const ESTABLISHMENT_SELECT = {
  id: true,
  whatsappProvider: true,
  evolutionBaseUrl: true,
  evolutionApiKey: true,
  evolutionInstanceName: true,
  metaPhoneNumberId: true,
  metaAccessToken: true,
  metaWebhookVerifyToken: true,
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
} as const

// GET — Meta Cloud API webhook verification
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === META_WEBHOOK_VERIFY_TOKEN && challenge) {
    console.log("[WhatsApp Webhook] Meta verification OK")
    return new Response(challenge, { status: 200 })
  }

  return NextResponse.json({ status: "ok", webhook: "whatsapp" })
}

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text()
    let parsed: any = null
    let establishment: any = null
    let isMetaWebhook = false

    // Detect provider from body
    let jsonBody: any
    try {
      jsonBody = JSON.parse(bodyText)
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    if (jsonBody.object === "whatsapp_business_account") {
      // ===== META CLOUD API =====
      isMetaWebhook = true
      const entry = jsonBody.entry?.[0]
      const changes = entry?.changes?.[0]
      const value = changes?.value

      // Handle status updates (delivery, read, errors)
      if (value?.statuses?.[0]) {
        const status = value.statuses[0]
        const phoneNumberId = value.metadata?.phone_number_id

        // Track consumption if billable
        if (status.pricing?.billable && status.pricing?.category && phoneNumberId) {
          try {
            const category = status.pricing.category
            const periodo = new Date().toISOString().slice(0, 7) // "2026-09"
            const fieldMap: Record<string, string> = {
              marketing: "consumoMarketing",
              utility: "consumoUtility",
              authentication: "consumoAuthentication",
              authentication_international: "consumoAuthentication",
              service: "consumoService",
            }
            const field = fieldMap[category]
            if (field) {
              await prisma.$executeRawUnsafe(
                `UPDATE "Establishment" 
                 SET "${field}" = "${field}" + 1, "consumoPeriodo" = $1
                 WHERE "metaPhoneNumberId" = $2 AND ("consumoPeriodo" = $1 OR "consumoPeriodo" IS NULL OR "consumoPeriodo" = '')`,
                periodo,
                phoneNumberId
              )
              console.log(`[Meta Webhook] Consumption tracked: ${category} for ${phoneNumberId}`)
            }
          } catch (e: any) {
            console.error("[Meta Webhook] Consumption tracking error:", e.message)
          }
        }

        // Error 131048: messaging limit reached
        if (status.errors?.[0]?.code === 131048 && phoneNumberId) {
          console.warn(`[Meta Webhook] Quota limit error 131048 for phone ${phoneNumberId}`)
          // Find establishment and update usage status
          const est = await prisma.establishment.findFirst({
            where: { metaPhoneNumberId: phoneNumberId },
            select: { id: true },
          })
          if (est) {
            await prisma.establishment.update({
              where: { id: est.id },
              data: { messagingLimit: 250, currentUsage: 250 },
            })
          }
        }
        return NextResponse.json({ success: true, statusHandled: true })
      }

      if (!value?.messages?.[0]) {
        return NextResponse.json({ success: true, ignored: true })
      }

      const msg = value.messages[0]
      if (msg.type !== "text") {
        return NextResponse.json({ success: true, ignored: true })
      }

      parsed = {
        phone: msg.from,
        text: msg.text?.body || "",
        messageId: msg.id,
        fromMe: false,
      }

      const phoneNumberId = value.metadata?.phone_number_id
      if (!phoneNumberId) {
        return NextResponse.json({ success: true, ignored: true })
      }

      establishment = await prisma.establishment.findFirst({
        where: { metaPhoneNumberId: phoneNumberId },
        select: ESTABLISHMENT_SELECT,
      })

      if (!establishment) {
        console.warn(`[WhatsApp Webhook] Meta: establishment not found for phone_number_id=${phoneNumberId}`)
        return NextResponse.json({ success: false, error: "Establishment not found" }, { status: 404 })
      }
    } else {
      // ===== EVOLUTION API =====
      if (jsonBody.event !== "messages.upsert") {
        return NextResponse.json({ success: true, ignored: true })
      }

      const data = jsonBody.data
      const instanceName = jsonBody.instance

      if (!data || data.key?.fromMe) {
        return NextResponse.json({ success: true, ignored: true })
      }

      // Validate webhook key
      const webhookKey = req.headers.get("apikey") || req.headers.get("x-api-key")
      if (webhookKey) {
        const validKey = await prisma.establishment.findFirst({
          where: { evolutionApiKey: webhookKey },
          select: { id: true },
        })
        if (!validKey) {
          console.warn("[WhatsApp Webhook] Invalid webhook key")
          return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
        }
      }

      establishment = await prisma.establishment.findFirst({
        where: { evolutionInstanceName: instanceName },
        select: ESTABLISHMENT_SELECT,
      })

      if (!establishment) {
        console.warn(`[WhatsApp Webhook] Instance not found: ${instanceName}`)
        return NextResponse.json({ success: false, error: "Instance not found" }, { status: 404 })
      }

      // Parse via provider to normalize message format
      const provider = getWhatsAppProvider({
        whatsappProvider: establishment.whatsappProvider,
        evolutionBaseUrl: establishment.evolutionBaseUrl,
        evolutionApiKey: establishment.evolutionApiKey,
        evolutionInstanceName: establishment.evolutionInstanceName,
        whatsappNumber: establishment.whatsappNumber,
        metaPhoneNumberId: establishment.metaPhoneNumberId,
        metaAccessToken: establishment.metaAccessToken,
      })

      if (!provider) {
        return NextResponse.json({ success: false, error: "Provider not configured" }, { status: 400 })
      }

      const mockReq = new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify(jsonBody),
      })

      parsed = await provider.parseWebhook(mockReq)
      if (!parsed || parsed.fromMe) {
        return NextResponse.json({ success: true, ignored: true })
      }
    }

    // ===== SHARED BOT LOGIC (works for both providers) =====

    if (!establishment) {
      return NextResponse.json({ success: false, error: "No establishment" }, { status: 400 })
    }

    console.log(`[WhatsApp] [${establishment.id.slice(0, 8)}] Message from ${parsed.phone}: "${parsed.text}"`)

    if (!establishment.whatsappAutomationEnabled) {
      console.log(`[WhatsApp] [${establishment.id.slice(0, 8)}] Automation disabled`)
      return NextResponse.json({ success: true, automationDisabled: true })
    }

    if (!establishment.botEnabled) {
      console.log(`[WhatsApp] Bot disabled for ${establishment.id}`)
      return NextResponse.json({ success: true, botDisabled: true })
    }

    // Get provider for sending replies
    const provider = getWhatsAppProvider({
      whatsappProvider: establishment.whatsappProvider,
      evolutionBaseUrl: establishment.evolutionBaseUrl,
      evolutionApiKey: establishment.evolutionApiKey,
      evolutionInstanceName: establishment.evolutionInstanceName,
      whatsappNumber: establishment.whatsappNumber,
      metaPhoneNumberId: establishment.metaPhoneNumberId,
      metaAccessToken: establishment.metaAccessToken,
    })

    if (!provider) {
      return NextResponse.json({ success: false, error: "Provider not configured" }, { status: 400 })
    }

    // 1. Auto-transfer (keywords)
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
        console.log(`[WhatsApp] Transferred to human (keyword in "${parsed.text}")`)
        return NextResponse.json({ success: true, transferred: true })
      }
    }

    // 2. Outside business hours
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
        console.log(`[WhatsApp] Outside hours - sent default message`)
        return NextResponse.json({ success: true, outsideHours: true })
      }
    }

    // Look up customer by phone (used for inactivity, greeting, etc.)
    const customer = await prisma.customer.findFirst({
      where: { phone: parsed.phone, establishmentId: establishment.id },
      select: { id: true, name: true, needsHuman: true },
    })

    // 3. Inactivity: customer asked for human
    if (establishment.botInactivityEnabled && customer?.needsHuman) {
      return NextResponse.json({ success: true, ignored: "needsHuman" })
    }

    let responseMessage: string | null = null
    let usedAI = false

    // Quick reply before AI (saves tokens)
    const quickReply = await matchGlobalQuickReply(parsed.text, establishment.id)
    if (quickReply) {
      const filledText = await fillQuickReplyPlaceholders(quickReply.text, establishment.id)
      responseMessage = filledText
      usedAI = false
      console.log(`[WhatsApp] Quick reply: ${quickReply.label}`)
    } else if (establishment.botUseAI && isAIAvailable()) {
      const aiLimitReached = establishment.aiMessagesUsed >= establishment.aiMessagesLimit
      const needsAI = !isMenuOption(parsed.text, establishment.botMenuOptions) && !isGreeting(parsed.text)

      if (aiLimitReached && needsAI) {
        console.log(`[WhatsApp] AI limit reached (${establishment.aiMessagesUsed}/${establishment.aiMessagesLimit})`)
        const botConfig = await loadMenuConfig(establishment)
        if (botConfig) {
          const resp = generateBotResponse(parsed.text, botConfig)
          responseMessage = resp.message || `Olá! Você atingiu o limite de IA deste mês. Por favor, escolha uma opção do menu:\n\n${formatMenuText(establishment.botMenuOptions)}`
        }
        usedAI = false
      } else {
        const greetWords = ["oi", "olá", "ola", "hi", "hello", "menu", "start", "bom dia", "boa tarde", "boa noite", "opa", "eai", "e ai"]
        const isGreetingMatch = greetWords.includes(parsed.text.toLowerCase().trim())

        const menuOption = isGreetingMatch
          ? null
          : parseMenuOptions(establishment.botMenuOptions).find((o) => o.id === parsed.text.trim())

        if (isGreetingMatch && establishment.botGreeting) {
          responseMessage = formatMenuGreeting(establishment.botAgentName || "Atendente", establishment.botGreeting, establishment.botMenuOptions, establishment.slug, customer?.name)
          usedAI = false
        } else if (menuOption) {
          const botConfig = await loadMenuConfig(establishment)
          if (botConfig) {
            responseMessage = generateBotResponse(parsed.text, botConfig).message || null
          }
          usedAI = false
        } else {
          try {
            const context = await loadBotContext(establishment.id, parsed.phone)
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
                console.log(`[WhatsApp] AI used ${aiResult.toolCalls.length} tool call(s):`, aiResult.toolCalls.map((t) => t.name).join(", "))
              }
              console.log(`[WhatsApp] AI responded (${aiResult.totalTokens} tokens, R$ ${(aiResult.costCents / 100).toFixed(4)})`)

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
            console.error(`[WhatsApp] AI error:`, aiErr.message)
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
      console.log(`[WhatsApp] No response for "${parsed.text}"`)
      if (establishment.botFallbackMessage) {
        const delay = randomTypingDelay(
          establishment.botTypingDelayMinMs || 1500,
          establishment.botTypingDelayMaxMs || 3500
        )
        await provider.sendText(parsed.phone, establishment.botFallbackMessage, { delay })
        console.log(`[WhatsApp] Fallback sent`)
        return NextResponse.json({ success: true, fallback: true })
      }
      return NextResponse.json({ success: true, noResponse: true, receivedText: parsed.text })
    }

    console.log(`[WhatsApp] Responding (${usedAI ? "AI" : "menu"}): "${responseMessage.substring(0, 50)}..."`)

    const sendResult = await provider.sendText(parsed.phone, responseMessage, {
      delay: randomTypingDelay(
        establishment.botTypingDelayMinMs || 1500,
        establishment.botTypingDelayMaxMs || 3500
      ),
    })

    if (!sendResult.success) {
      console.error(`[WhatsApp] Send error:`, sendResult.error)
      return NextResponse.json({ success: false, error: sendResult.error }, { status: 500 })
    }

    console.log(`[WhatsApp] ✓ Response sent to ${parsed.phone}`)

    return NextResponse.json({
      success: true,
      messageId: sendResult.messageId,
      receivedText: parsed.text,
      usedAI,
      responsePreview: responseMessage.substring(0, 100),
    })
  } catch (error: any) {
    console.error("[WhatsApp Webhook] Error:", error.message)
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
  const greetWords = ["oi", "olá", "ola", "hi", "hello", "menu", "start", "bom dia", "boa tarde", "boa noite", "opa", "eai", "e ai"]
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

function formatMenuGreeting(agentName: string, greeting: string, menuJson: string | null, slug?: string, customerName?: string | null): string {
  const replaced = greeting
    .replace(/\{nome\}/g, agentName)
    .replace(/\{link\}/g, slug ? `https://flowoshub.com/${slug}` : "")
    .replace(/\{cliente\}/g, customerName || "")

  const hasOptionsInGreeting = /\n\s*\d+\s*[-.)]/.test(replaced)
  if (hasOptionsInGreeting) {
    return `${replaced}\n\nDigite o *número* da opção desejada.`
  }

  const menuOptions = parseMenuOptions(menuJson)
  const menuText = menuOptions.map((opt, idx) => `${idx + 1}. ${opt.label}`).join("\n")
  return `${replaced}\n\n${menuText}\n\nDigite o *número* da opção desejada.`
}
