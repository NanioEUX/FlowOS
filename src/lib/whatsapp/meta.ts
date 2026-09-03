import type { WhatsAppProvider, ParsedWhatsAppMessage, SendTextOptions, SendVerificationOptions } from "./provider"

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

  private formatPhone(phone: string): string {
    let phoneDigits = phone.replace(/\D/g, "")
    if (phoneDigits.length === 10 || phoneDigits.length === 11) {
      phoneDigits = "55" + phoneDigits
    } else if (phoneDigits.length === 12 && !phoneDigits.startsWith("55")) {
      phoneDigits = "55" + phoneDigits
    }
    return phoneDigits
  }

  async sendText(phone: string, text: string, options?: SendTextOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const phoneDigits = this.formatPhone(phone)
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

  async sendVerificationCode(phone: string, options: SendVerificationOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const phoneDigits = this.formatPhone(phone)
      console.log(`[MetaCloud] Sending verification code to: ${phoneDigits}`)

      const body: any = {
        messaging_product: "whatsapp",
        to: phoneDigits,
        type: "interactive",
        interactive: {
          type: "cta_copy",
          body: {
            text: `🔐 *${options.establishmentName}* - Verificação\n\nSeu código de confirmação é:\n\n*${options.code}*\n\n⏱️ Expira em ${options.expiresInMinutes} minutos.`
          },
          action: {
            display_text: "Copiar Código",
            copy_code_text: options.code,
          },
        },
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
        console.error("[MetaCloud] sendVerificationCode error:", data)
        return { success: false, error: data.error?.message || "Failed to send verification code" }
      }

      return { success: true, messageId: data.messages?.[0]?.id }
    } catch (err: any) {
      console.error("[MetaCloud] sendVerificationCode exception:", err)
      return { success: false, error: err.message }
    }
  }

  async sendInteractiveUrlButton(phone: string, text: string, buttonText: string, url: string, options?: SendTextOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const phoneDigits = this.formatPhone(phone)
      console.log(`[MetaCloud] Sending URL button to: ${phoneDigits}`)

      const body: any = {
        messaging_product: "whatsapp",
        to: phoneDigits,
        type: "interactive",
        interactive: {
          type: "cta_url",
          body: { text },
          action: {
            name: "cta_url",
            parameters: {
              display_text: buttonText,
              url,
            },
          },
        },
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
        console.error("[MetaCloud] sendInteractiveUrlButton error:", data)
        return { success: false, error: data.error?.message || "Failed to send interactive message" }
      }

      return { success: true, messageId: data.messages?.[0]?.id }
    } catch (err: any) {
      console.error("[MetaCloud] sendInteractiveUrlButton exception:", err)
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
