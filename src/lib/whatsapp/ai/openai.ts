import OpenAI from "openai"

const apiKey = process.env.OPENAI_API_KEY

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada")
  }
  if (!client) {
    client = new OpenAI({ apiKey })
  }
  return client
}

export interface AIResponse {
  text: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costCents: number
  toolCalls?: Array<{
    name: string
    arguments: any
    result: any
  }>
}

// Preços gpt-4o-mini (em dólares por 1M tokens)
const PRICE_INPUT_PER_M = 0.15
const PRICE_OUTPUT_PER_M = 0.60
// Câmbio aproximado USD -> BRL
const USD_TO_BRL = 5.0

export const BOT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "create_order",
      description:
        "Cria um pedido no sistema após coletar todos os dados do cliente (nome, telefone, endereço se entrega, itens com ID e quantidade). Se for pedido agendado, calcule a data/hora ISO no futuro respeitando o fuso horário do Brasil e passe em scheduledFor.",
      parameters: {
        type: "object",
        properties: {
          customerName: { type: "string", description: "Nome completo do cliente" },
          customerPhone: { type: "string", description: "Telefone do cliente (com DDD, só números)" },
          customerAddress: { type: "string", description: "Endereço completo (rua)" },
          customerNumber: { type: "string", description: "Número do endereço" },
          customerNeighborhood: { type: "string", description: "Bairro" },
          customerComplement: { type: "string", description: "Complemento (apto, bloco, etc)" },
          customerCep: { type: "string", description: "CEP (só números)" },
          customerReference: { type: "string", description: "Ponto de referência" },
          customerCpf: { type: "string", description: "CPF (só números, se cliente informar)" },
          orderType: {
            type: "string",
            enum: ["delivery", "pickup"],
            description: "delivery = entrega, pickup = retirada no local",
          },
          paymentMethod: {
            type: "string",
            enum: ["online", "cash", "card_delivery", "card_pickup"],
            description: "online = PIX antecipado, cash = dinheiro na entrega, card_delivery = cartão na entrega, card_pickup = cartão na retirada",
          },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                productId: { type: "string", description: "ID do produto no cardápio" },
                quantity: { type: "number", description: "Quantidade" },
                notes: { type: "string", description: "Observações do item (ex: sem cebola)" },
              },
              required: ["productId", "quantity"],
            },
            description: "Itens do pedido com IDs vindos do cardápio",
          },
          notes: { type: "string", description: "Observações gerais do pedido" },
          scheduledFor: {
            type: "string",
            description:
              "ISO datetime no futuro para pedidos agendados/encomendas. Ex: '2026-08-15T14:00:00-03:00'. Deve respeitar antecedência mínima e máxima configuradas.",
          },
        },
        required: ["customerName", "customerPhone", "orderType", "paymentMethod", "items"],
      },
    },
  },
]

export async function generateAIResponse(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [],
  toolsHandler?: {
    create_order: (args: any) => Promise<any>
  }
): Promise<AIResponse> {
  const openai = getClient()

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: userMessage },
  ]

  let completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    max_tokens: 500,
    temperature: 0.7,
    tools: toolsHandler ? BOT_TOOLS : undefined,
    tool_choice: toolsHandler ? "auto" : undefined,
  })

  let totalInput = completion.usage?.prompt_tokens || 0
  let totalOutput = completion.usage?.completion_tokens || 0
  const toolCalls: AIResponse["toolCalls"] = []

  // Loop de tool calls (max 3 iterações pra evitar loop)
  let iterations = 0
  while (completion.choices[0]?.message?.tool_calls && toolsHandler && iterations < 3) {
    iterations++
    const toolMsgs: any[] = []
    for (const toolCall of completion.choices[0].message.tool_calls as any[]) {
      const name = toolCall.function.name
      let args: any = {}
      try { args = JSON.parse(toolCall.function.arguments) } catch {}
      const handler = (toolsHandler as any)[name]
      if (!handler) continue
      const result = await handler(args).catch((e: any) => ({ error: e.message }))
      toolCalls.push({ name, arguments: args, result })
      toolMsgs.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) })
    }
    completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [...messages, completion.choices[0].message, ...toolMsgs],
      max_tokens: 500,
      temperature: 0.7,
      tools: BOT_TOOLS,
      tool_choice: "auto",
    })
    totalInput += completion.usage?.prompt_tokens || 0
    totalOutput += completion.usage?.completion_tokens || 0
  }

  const text = completion.choices[0]?.message?.content?.trim() || ""
  const totalTokens = totalInput + totalOutput

  const costUsd = (totalInput * PRICE_INPUT_PER_M / 1000000) + (totalOutput * PRICE_OUTPUT_PER_M / 1000000)
  const costBrl = costUsd * USD_TO_BRL
  const costCents = Math.ceil(costBrl * 100)

  return {
    text,
    inputTokens: totalInput,
    outputTokens: totalOutput,
    totalTokens,
    costCents,
    toolCalls,
  }
}

export function isAIAvailable(): boolean {
  return !!apiKey
}
