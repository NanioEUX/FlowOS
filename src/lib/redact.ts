/**
 * Redação de segredos e PII nos logs (F4A-014/F4A-016/F4A-018).
 *
 * Regra: nenhum token, senha, OTP ou link de reset pode aparecer em log.
 * Estes helpers mantêm o log útil (chave + status) sem vazar o valor.
 */

const SENSITIVE_KEY = /(access[_-]?token|refresh[_-]?token|token|secret|password|passwd|api[_-]?key|apikey|authorization|client[_-]?secret|certificate|webhook[_-]?verify|code|otp|link|url)/i

/**
 * F4A-018: chaves que CASAM com SENSITIVE_KEY ("code", "url", "token") mas
 * carregam apenas diagnóstico — escondê-las tornaria o log inútil (o dev
 * perderia statusCode, eventCode, hasApiKey...).
 *
 * Regra: `has*` é sempre flag booleana; a lista abaixo é fechada e cada item
 * já foi revisado. Qualquer chave nova sensível NÃO entra aqui — o padrão
 * seguro é seguir redigida.
 */
const DIAGNOSTIC_KEY = /^(?:has[A-Z]\w*|statusCode|errorCode|httpCode|eventCode|reasonCode|codeLength|baseUrl|requestUrl|finalUrl|publicUrl)$/

export function redactValue(value: unknown): string {
  if (value === null || value === undefined) return "[null]"
  if (typeof value === "string") return "[redacted]"
  if (typeof value === "number" || typeof value === "boolean") return "[redacted]"
  return "[redacted]"
}

/**
 * Copia um objeto trocando por "[redacted]" o valor de toda chave sensível.
 * Estrutura preservada (chaves visíveis) → o log continua diagnosticável.
 */
export function redactObject<T>(input: T): any {
  if (input === null || input === undefined) return input
  if (Array.isArray(input)) return input.map((item) => redactObject(item))
  if (typeof input !== "object") return input

  const out: Record<string, any> = {}
  for (const [key, value] of Object.entries(input as Record<string, any>)) {
    if (SENSITIVE_KEY.test(key) && !DIAGNOSTIC_KEY.test(key)) {
      out[key] = redactValue(value)
    } else if (value && typeof value === "object") {
      out[key] = redactObject(value)
    } else {
      out[key] = value
    }
  }
  return out
}

/**
 * Loga um link de reset/OTP sem o token: só a origem e o usuário.
 * O link completo só é impresso em ambiente de dev (SHOW_DEV_CODE=true).
 */
export function safeResetLog(email: string, userId: string, origin: string) {
  if (process.env.SHOW_DEV_CODE === "true") {
    return { email, userId, resetUrl: `${origin}/redefinir-senha` }
  }
  return { email: "[redacted]", userId, origin }
}
