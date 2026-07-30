export interface ParsedWhatsAppMessage {
  phone: string
  text: string
  messageId: string
  fromMe: boolean
  timestamp: number
}

export interface SendTextOptions {
  quotedMessageId?: string
  delay?: number
}

export interface WhatsAppProvider {
  sendText(phone: string, text: string, options?: SendTextOptions): Promise<{ success: boolean; messageId?: string; error?: string }>
  parseWebhook(req: Request): Promise<ParsedWhatsAppMessage | null>
  validateConfig(): { valid: boolean; error?: string }
}
