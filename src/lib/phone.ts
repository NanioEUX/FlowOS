/**
 * Normalização única de telefone de cliente (F7A-010).
 * Remove formatação, prefixo internacional 0055/55 e exige 10-11 dígitos
 * (DDD + número), alinhando API, front e números E.164 vindos do WhatsApp/bot.
 * Retorna null quando o número não é válido.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = raw.replace(/\D/g, "")
  if (digits.startsWith("0055")) digits = digits.slice(4)
  else if (digits.length >= 12 && digits.length <= 13 && digits.startsWith("55")) digits = digits.slice(2)
  if (digits.length < 10 || digits.length > 11) return null
  return digits
}

/** Mascara o telefone para logs (ex.: 47999998888 → 47*****888). */
export function maskPhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "")
  if (digits.length < 5) return "***"
  return `${digits.slice(0, 2)}*****${digits.slice(-3)}`
}
