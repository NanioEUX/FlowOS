import { prisma } from "@/lib/prisma"
import { getWhatsAppProvider } from "./index"

export interface BotMenuOption {
  id: string
  label: string
  response: string
  message?: string
}

export interface BotConfig {
  agentName: string
  greeting: string
  menuOptions: BotMenuOption[]
  whatsappNumber: string
  slug: string
}

const DEFAULT_MENU_OPTIONS: BotMenuOption[] = [
  {
    id: "1",
    label: "Fazer Pedido",
    response: "menu",
  },
  {
    id: "2",
    label: "Ver Cardápio",
    response: "cardapio",
  },
  {
    id: "3",
    label: "Falar com Atendente",
    response: "atendente",
  },
]

export function parseMenuOptions(json: string | null | undefined): BotMenuOption[] {
  if (!json) return DEFAULT_MENU_OPTIONS
  try {
    const parsed = JSON.parse(json)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
  } catch {}
  return DEFAULT_MENU_OPTIONS
}

export async function getBotConfig(establishmentId: string): Promise<BotConfig | null> {
  const establishment = await prisma.establishment.findUnique({
    where: { id: establishmentId },
    select: {
      id: true,
      name: true,
      slug: true,
      botEnabled: true,
      botAgentName: true,
      botGreeting: true,
      botMenuOptions: true,
      whatsappNumber: true,
      whatsappProvider: true,
      evolutionBaseUrl: true,
      evolutionApiKey: true,
      evolutionInstanceName: true,
    },
  })

  if (!establishment || !establishment.botEnabled) return null

  return {
    agentName: establishment.botAgentName || "Atendente",
    greeting: establishment.botGreeting || "",
    menuOptions: parseMenuOptions(establishment.botMenuOptions),
    whatsappNumber: establishment.whatsappNumber || "",
    slug: establishment.slug,
  }
}

export interface BotResponse {
  shouldRespond: boolean
  message?: string
}

export function generateBotResponse(text: string, config: BotConfig): BotResponse {
  const normalized = text.toLowerCase().trim()

  if (["oi", "olá", "ola", "hi", "hello", "menu", "start", "inicio", "início", "bom dia", "boa tarde", "boa noite", "opa", "eai", "e ai", "hello"].includes(normalized)) {
    return {
      shouldRespond: true,
      message: formatGreeting(config),
    }
  }

  const option = config.menuOptions.find((opt) => opt.id === normalized)

  if (!option) {
    return {
      shouldRespond: false,
    }
  }

  switch (option.response) {
    case "menu":
      return {
        shouldRespond: true,
        message: formatGreeting(config),
      }

    case "cardapio":
      return {
        shouldRespond: true,
        message: `🍴 *Cardápio Digital*\n\nAcesse nosso cardápio completo:\nhttps://flowoshub.com/${config.slug}\n\nOu digite *menu* para voltar ao início.`,
      }

    case "atendente":
      return {
        shouldRespond: true,
        message: `👤 *Atendimento Humano*\n\nUm atendente entrará em contato em breve.\n\nObrigado pela paciência! 🙏`,
      }

    case "mensagem":
      return {
        shouldRespond: true,
        message: option.message || "Mensagem não configurada.",
      }

    default:
      return {
        shouldRespond: true,
        message: option.response,
      }
  }
}

function formatGreeting(config: BotConfig): string {
  const cardapioUrl = config.slug ? `https://flowoshub.com/${config.slug}` : ""
  const greeting = (config.greeting || `Olá! Eu sou ${config.agentName}, em que posso ajudar?`)
    .replace(/\{nome\}/g, config.agentName)
    .replace(/\{link\}/g, cardapioUrl)

  const hasOptionsInGreeting = /\n\s*\d+\s*[-.)]/.test(greeting)

  if (hasOptionsInGreeting) {
    return `${greeting}\n\nDigite o *número* da opção desejada.`
  }

  const menuText = config.menuOptions
    .filter((opt) => opt.label.trim())
    .map((opt, idx) => `${idx + 1} - ${opt.label}`)
    .join("\n")

  return `${greeting}\n\n${menuText}\n\nDigite o *número* da opção desejada.`
}
