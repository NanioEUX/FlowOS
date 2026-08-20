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

export interface SendVerificationOptions {
  establishmentName: string
  code: string
  expiresInMinutes: number
}

export interface WhatsAppProvider {
  sendText(phone: string, text: string, options?: SendTextOptions): Promise<{ success: boolean; messageId?: string; error?: string }>
  sendVerificationCode?(phone: string, options: SendVerificationOptions): Promise<{ success: boolean; messageId?: string; error?: string }>
  parseWebhook(req: Request): Promise<ParsedWhatsAppMessage | null>
  validateConfig(): { valid: boolean; error?: string }
}
