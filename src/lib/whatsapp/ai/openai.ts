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
}

// Preços gpt-4o-mini (em dólares por 1M tokens)
const PRICE_INPUT_PER_M = 0.15
const PRICE_OUTPUT_PER_M = 0.60
// Câmbio aproximado USD -> BRL
const USD_TO_BRL = 5.0

export async function generateAIResponse(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<AIResponse> {
  const openai = getClient()

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: userMessage },
  ]

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    max_tokens: 300,
    temperature: 0.7,
  })

  const text = completion.choices[0]?.message?.content?.trim() || ""
  const inputTokens = completion.usage?.prompt_tokens || 0
  const outputTokens = completion.usage?.completion_tokens || 0
  const totalTokens = completion.usage?.total_tokens || 0

  // Calcula custo em centavos (R$)
  const costUsd = (inputTokens * PRICE_INPUT_PER_M / 1000000) + (outputTokens * PRICE_OUTPUT_PER_M / 1000000)
  const costBrl = costUsd * USD_TO_BRL
  const costCents = Math.ceil(costBrl * 100)

  return { text, inputTokens, outputTokens, totalTokens, costCents }
}

export function isAIAvailable(): boolean {
  return !!apiKey
}
