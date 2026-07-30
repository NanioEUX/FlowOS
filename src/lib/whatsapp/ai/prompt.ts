import { prisma } from "@/lib/prisma"

export interface BotContext {
  agentName: string
  establishmentName: string
  establishmentSlug?: string
  greeting: string
  tone: string
  faq: string
  customPrompt: string
  menuOptions: Array<{ id: string; label: string; response: string }>
  businessHours?: string
  products?: any[]
  customerLastOrder?: {
    orderNumber: number
    status: string
    paymentStatus: string
    total: number
    items: string
    trackingUrl: string
    createdAt: string
  } | null
  acceptsScheduledOrders?: boolean
  scheduledOrderMessage?: string
  scheduledMinHours?: number
  scheduledMaxAdvanceDays?: number
}

export async function loadBotContext(
  establishmentId: string,
  customerPhone?: string
): Promise<BotContext | null> {
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
      id: p.id,
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

  let customerLastOrder: BotContext["customerLastOrder"] = null
  if (customerPhone) {
      const lastOrder = await prisma.order.findFirst({
      where: {
        establishmentId,
        customerPhone,
        status: { notIn: ["cancelled"] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        total: true,
        items: true,
        trackingToken: true,
        createdAt: true,
      },
    })
    if (lastOrder) {
      customerLastOrder = {
        orderNumber: lastOrder.orderNumber || 0,
        status: lastOrder.status,
        paymentStatus: lastOrder.paymentStatus,
        total: lastOrder.total,
        items: lastOrder.items,
        trackingUrl: `https://flowoshub.com/${establishment.slug}/pedido/${lastOrder.id}?token=${lastOrder.trackingToken}`,
        createdAt: lastOrder.createdAt.toISOString(),
      }
    }
  }

  return {
    agentName: establishment.botAgentName || "Atendente",
    establishmentName: establishment.name,
    establishmentSlug: establishment.slug,
    greeting: establishment.botGreeting || "",
    tone: establishment.botTone || "casual",
    faq: establishment.botFAQ || "",
    customPrompt: establishment.botSystemPrompt || "",
    menuOptions,
    businessHours,
    products,
    customerLastOrder,
    acceptsScheduledOrders: establishment.botAcceptsScheduledOrders ?? false,
    scheduledOrderMessage: establishment.botScheduledOrderMessage || "",
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
          .slice(0, 50)
          .map((p: any) => `- id="${p.id}" ${p.name} (${p.category}): R$ ${p.price.toFixed(2)}${p.description ? ` - ${p.description}` : ""}`)
          .join("\n")
      : ""

  const lastOrderBlock = context.customerLastOrder
    ? `ÚLTIMO PEDIDO DO CLIENTE:
- Pedido #${context.customerLastOrder.orderNumber}
- Status: ${context.customerLastOrder.status}
- Pagamento: ${context.customerLastOrder.paymentStatus}
- Total: R$ ${context.customerLastOrder.total.toFixed(2)}
- Link de acompanhamento: ${context.customerLastOrder.trackingUrl}
Quando o cliente perguntar "onde está meu pedido", "qual o status", ou similar, use essas informações. NÃO invente status. Se não souber, peça o número do pedido.`
    : ""

  const schedulingBlock = context.acceptsScheduledOrders
    ? `AGENDAMENTO DE PEDIDOS:
Este estabelecimento aceita pedidos agendados (encomendas para eventos/datas futuras).
${context.scheduledOrderMessage ? `Mensagem padrão: "${context.scheduledOrderMessage}"` : ""}
Quando o cliente quiser fazer um pedido grande ou para outra data, conduza a conversa coletando: produtos, quantidades, data/hora desejada, endereço (se entrega).
Use a tool create_order passando scheduledFor (ISO datetime no futuro) quando o cliente confirmar data e itens.`
    : ""

  const basePrompt = `Você é ${context.agentName}, atendente virtual da ${context.establishmentName}.

${toneDescriptions[context.tone] || toneDescriptions.casual}

INSTRUÇÕES:
1. Responda de forma curta e clara (máximo 3 parágrafos).
2. Use o cardápio abaixo quando o cliente perguntar sobre produtos. Cada produto tem um "id" que você DEVE usar ao criar pedidos via tool.
3. Para FAZER PEDIDO: colete nome, telefone, endereço (se entrega), itens (com IDs e quantidades), tipo (entrega/retirada), forma de pagamento. Quando tiver TUDO confirmado, use a tool create_order. NÃO calcule valores — o servidor recalcula.
4. Para PEDIDOS AGENDADOS: além dos dados acima, pergunte data/hora desejada. Calcule o ISO datetime (fuso -03:00 Brasília). Se o cliente pedir pra menos de ${context.scheduledMinHours || 24}h ou mais de ${context.scheduledMaxAdvanceDays || 30}dias, explique educadamente que precisa de mais antecedência.
5. Se o cliente quiser falar com humano, responda: "Vou chamar um atendente humano. Aguarde um momento!"
6. Nunca confirme pagamentos ou prazos sem informações explícitas.
7. Se não souber responder, diga que vai chamar um humano.

${context.greeting ? `SUA SAUDAÇÃO PADRÃO:\n"${context.greeting}"` : ""}

${context.businessHours ? `HORÁRIO DE FUNCIONAMENTO:\n${context.businessHours}` : ""}

MENU DE OPÇÕES RÁPIDAS:
${menuText}

${productsText ? `CARDÁPIO (com IDs para criar pedido):\n${productsText}` : ""}

${lastOrderBlock}

${schedulingBlock}

${context.faq ? `REGRAS DA CASA (FAQ):\n${context.faq}` : ""}

${context.customPrompt ? `INSTRUÇÕES CUSTOMIZADAS:\n${context.customPrompt}` : ""}`

  return basePrompt
}
