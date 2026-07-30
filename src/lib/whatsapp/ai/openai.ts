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
  tokensUsed: number
}

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
  const tokensUsed = completion.usage?.total_tokens || 0

  return { text, tokensUsed }
}

export function isAIAvailable(): boolean {
  return !!apiKey
}
