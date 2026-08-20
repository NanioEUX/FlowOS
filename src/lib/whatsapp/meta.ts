import type { WhatsAppProvider, ParsedWhatsAppMessage, SendTextOptions } from "./provider"

interface MetaCloudConfig {
  phoneNumberId: string
  accessToken: string
  apiVersion?: string
}

export class MetaCloudProvider implements WhatsAppProvider {
  private phoneNumberId: string
  private accessToken: string
  private apiVersion: string

  constructor(config: MetaCloudConfig) {
    this.phoneNumberId = config.phoneNumberId
    this.accessToken = config.accessToken
    this.apiVersion = config.apiVersion || "v21.0"
  }

  private get baseUrl(): string {
    return `https://graph.facebook.com/${this.apiVersion}`
  }

  async sendText(phone: string, text: string, options?: SendTextOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      let phoneDigits = phone.replace(/\D/g, "")

      // Ensure international format with country code (55 for Brazil)
      if (phoneDigits.length === 10 || phoneDigits.length === 11) {
        // Local number without country code: 47984118220 or 984118220
        phoneDigits = "55" + phoneDigits
      } else if (phoneDigits.length === 12 && !phoneDigits.startsWith("55")) {
        // 12 digits without country code prefix
        phoneDigits = "55" + phoneDigits
      }

      console.log(`[MetaCloud] Sending to: ${phoneDigits} (original: ${phone})`)

      const body: any = {
        messaging_product: "whatsapp",
        to: phoneDigits,
        type: "text",
        text: { body: text },
      }

      if (options?.quotedMessageId) {
        body.context = { message_id: options.quotedMessageId }
      }

      const res = await fetch(`${this.baseUrl}/${this.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        console.error("[MetaCloud] sendText error:", data)
        return { success: false, error: data.error?.message || "Failed to send message" }
      }

      return { success: true, messageId: data.messages?.[0]?.id }
    } catch (err: any) {
      console.error("[MetaCloud] sendText exception:", err)
      return { success: false, error: err.message }
    }
  }

  async parseWebhook(req: Request): Promise<ParsedWhatsAppMessage | null> {
    try {
      const body = await req.json()

      const entry = body.entry?.[0]
      const changes = entry?.changes?.[0]
      const value = changes?.value

      if (!value?.messages?.[0]) return null

      const msg = value.messages[0]
      const contact = value.contacts?.[0]

      if (msg.type !== "text") return null

      return {
        phone: msg.from,
        text: msg.text?.body || "",
        messageId: msg.id,
        fromMe: false,
        timestamp: parseInt(msg.timestamp || "0", 10),
      }
    } catch {
      return null
    }
  }

  validateConfig(): { valid: boolean; error?: string } {
    if (!this.phoneNumberId) return { valid: false, error: "Phone Number ID não configurado" }
    if (!this.accessToken) return { valid: false, error: "Access Token não configurado" }
    return { valid: true }
  }

  async testConnection(): Promise<{ connected: boolean; error?: string; phoneInfo?: any }> {
    try {
      const res = await fetch(`${this.baseUrl}/${this.phoneNumberId}`, {
        headers: { "Authorization": `Bearer ${this.accessToken}` },
      })
      const data = await res.json()

      if (!res.ok) {
        return { connected: false, error: data.error?.message || "Falha ao conectar" }
      }

      return {
        connected: true,
        phoneInfo: {
          displayPhoneNumber: data.display_phone_number,
          verifiedName: data.verified_name,
          qualityRating: data.quality_rating,
        },
      }
    } catch (err: any) {
      return { connected: false, error: err.message }
    }
  }

  static verifyWebhook(searchParams: URLSearchParams, verifyToken: string): string | null {
    const mode = searchParams.get("hub.mode")
    const token = searchParams.get("hub.verify_token")
    const challenge = searchParams.get("hub.challenge")

    if (mode === "subscribe" && token === verifyToken && challenge) {
      return challenge
    }
    return null
  }
}
