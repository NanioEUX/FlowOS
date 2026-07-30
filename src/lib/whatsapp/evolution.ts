import type { WhatsAppProvider, ParsedWhatsAppMessage, SendTextOptions } from "./provider"

interface EvolutionConfig {
  baseUrl: string
  apiKey: string
  instanceName: string
}

export interface ConnectionState {
  state: "open" | "connecting" | "close" | "refused"
  number?: string
  profileName?: string
}

export interface QRCodeResponse {
  pairingCode?: string
  code?: string
  base64?: string
  count?: number
}

export class EvolutionProvider implements WhatsAppProvider {
  private config: EvolutionConfig

  constructor(config: EvolutionConfig) {
    this.config = config
  }

  validateConfig(): { valid: boolean; error?: string } {
    if (!this.config.baseUrl) return { valid: false, error: "baseUrl não configurada" }
    if (!this.config.apiKey) return { valid: false, error: "apiKey não configurada" }
    if (!this.config.instanceName) return { valid: false, error: "instanceName não configurado" }
    return { valid: true }
  }

  private getHeaders() {
    return {
      "Content-Type": "application/json",
      apikey: this.config.apiKey,
    }
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, "")
    if (digits.length <= 11) {
      return `55${digits}`
    }
    return digits
  }

  async getConnectionState(): Promise<ConnectionState> {
    try {
      const url = `${this.config.baseUrl}/instance/connectionState/${this.config.instanceName}`
      const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(),
      })

      if (!response.ok) {
        return { state: "close" }
      }

      const data = await response.json()
      return {
        state: data.instance?.state || "close",
        number: data.instance?.number || undefined,
        profileName: data.instance?.profileName || undefined,
      }
    } catch {
      return { state: "close" }
    }
  }

  async connectInstance(): Promise<{ success: boolean; qrcode?: QRCodeResponse; error?: string }> {
    try {
      const url = `${this.config.baseUrl}/instance/connect/${this.config.instanceName}`
      const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return { success: false, error: `Evolution error: ${response.status} - ${errorText}` }
      }

      const data = await response.json()
      return { success: true, qrcode: data }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async getQRCode(): Promise<{ success: boolean; qrcode?: QRCodeResponse; error?: string }> {
    try {
      const url = `${this.config.baseUrl}/instance/connect/${this.config.instanceName}`
      const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return { success: false, error: `Evolution error: ${response.status} - ${errorText}` }
      }

      const data = await response.json()
      return { success: true, qrcode: data }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async logoutInstance(): Promise<{ success: boolean; error?: string }> {
    try {
      const url = `${this.config.baseUrl}/instance/logout/${this.config.instanceName}`
      const response = await fetch(url, {
        method: "DELETE",
        headers: this.getHeaders(),
      })

      if (!response.ok) {
        return { success: false, error: `Status ${response.status}` }
      }
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async sendText(phone: string, text: string, options?: SendTextOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const normalizedPhone = this.normalizePhone(phone)
      const url = `${this.config.baseUrl}/message/sendText/${this.config.instanceName}`

      const response = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          number: normalizedPhone,
          text,
          ...(options?.delay && { delay: options.delay }),
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return { success: false, error: `Evolution API error: ${response.status} - ${errorText}` }
      }

      const data = await response.json().catch(() => null)
      return {
        success: true,
        messageId: data?.key?.id || data?.messageId,
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async parseWebhook(req: Request): Promise<ParsedWhatsAppMessage | null> {
    try {
      const body = await req.json()

      if (body.event !== "messages.upsert") return null

      const data = body.data
      if (!data || data.key?.fromMe) return null

      const remoteJid = data.key?.remoteJid
      if (!remoteJid) return null

      const phone = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "")

      const messageType = data.messageType
      let text = ""

      if (messageType === "conversation") {
        text = data.message?.conversation || ""
      } else if (messageType === "extendedTextMessage") {
        text = data.message?.extendedTextMessage?.text || ""
      } else if (messageType === "buttonsResponseMessage") {
        text = data.message?.buttonsResponseMessage?.selectedButtonId || ""
      } else if (messageType === "listResponseMessage") {
        text = data.message?.listResponseMessage?.title || ""
      }

      if (!text) return null

      return {
        phone,
        text: text.trim(),
        messageId: data.key?.id || "",
        fromMe: false,
        timestamp: data.messageTimestamp || Date.now(),
      }
    } catch {
      return null
    }
  }
}
