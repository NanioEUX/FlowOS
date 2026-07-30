import { prisma } from "@/lib/prisma"

export interface BotContext {
  agentName: string
  establishmentName: string
  greeting: string
  tone: string
  faq: string
  customPrompt: string
  menuOptions: Array<{ id: string; label: string; response: string }>
  businessHours?: string
  products?: any[]
}

export async function loadBotContext(establishmentId: string): Promise<BotContext | null> {
  const establishment = await prisma.establishment.findUnique({
    where: { id: establishmentId },
    include: {
      categories: {
        include: {
          products: {
            where: { isAvailable: true },
            orderBy: { order: "asc" },
          },
        },
      },
    },
  })

  if (!establishment || !establishment.botEnabled) return null

  let menuOptions: Array<{ id: string; label: string; response: string }> = []
  if (establishment.botMenuOptions) {
    try {
      menuOptions = JSON.parse(establishment.botMenuOptions)
    } catch {}
  }

  const products = establishment.categories.flatMap((cat) =>
    cat.products.map((p) => ({
      name: p.name,
      description: p.description,
      price: p.price,
      category: cat.name,
    }))
  )

  let businessHours = ""
  if (establishment.businessHours) {
    try {
      const hours = JSON.parse(establishment.businessHours)
      businessHours = hours
        .filter((h: any) => h.active)
        .map((h: any) => `${h.day}: ${h.open}-${h.close}`)
        .join("\n")
    } catch {}
  }

  return {
    agentName: establishment.botAgentName || "Atendente",
    establishmentName: establishment.name,
    greeting: establishment.botGreeting || "",
    tone: establishment.botTone || "casual",
    faq: establishment.botFAQ || "",
    customPrompt: establishment.botSystemPrompt || "",
    menuOptions,
    businessHours,
    products,
  }
}

export function buildSystemPrompt(context: BotContext): string {
  const toneDescriptions: Record<string, string> = {
    formal: "Use linguagem formal e educada. Use 'senhor'/'senhora' quando apropriado.",
    casual: "Use linguagem descontraída e amigável. Use emojis com moderação.",
    direct: "Seja direto e objetivo. Vá direto ao ponto sem enrolação.",
  }

  const menuText = context.menuOptions
    .map((opt) => `- "${opt.id}": ${opt.label}`)
    .join("\n")

  const productsText =
    context.products && context.products.length > 0
      ? context.products
          .slice(0, 30)
          .map((p) => `- ${p.name} (${p.category}): R$ ${p.price.toFixed(2)}${p.description ? ` - ${p.description}` : ""}`)
          .join("\n")
      : ""

  const basePrompt = `Você é ${context.agentName}, atendente virtual da ${context.establishmentName}.

${toneDescriptions[context.tone] || toneDescriptions.casual}

INSTRUÇÕES:
1. Responda de forma curta e clara (máximo 3 parágrafos).
2. Use o cardápio abaixo quando o cliente perguntar sobre produtos.
3. Para fazer pedido, oriente o cliente a acessar o cardápio digital.
4. Se o cliente quiser falar com humano, responda: "Vou chamar um atendente humano. Aguarde um momento!"
5. Nunca confirme pagamentos ou prazos sem informações explícitas.
6. Se não souber responder, diga que vai chamar um humano.

${context.greeting ? `SUA SAUDAÇÃO PADRÃO:\n"${context.greeting}"` : ""}

${context.businessHours ? `HORÁRIO DE FUNCIONAMENTO:\n${context.businessHours}` : ""}

MENU DE OPÇÕES RÁPIDAS:
${menuText}

${productsText ? `CARDÁPIO:\n${productsText}` : ""}

${context.faq ? `REGRAS DA CASA (FAQ):\n${context.faq}` : ""}

${context.customPrompt ? `INSTRUÇÕES CUSTOMIZADAS:\n${context.customPrompt}` : ""}`

  return basePrompt
}
