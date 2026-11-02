import { redactObject } from "@/lib/redact"

/**
 * Logger estruturado com request-id (F4A-018).
 *
 * Antes: 586 `console.*` soltos, sem correlação — era impossível reconstruir
 * uma requisição ou medir taxa de erro por integração.
 *
 * O request-id é gerado no middleware (`x-request-id`) e repassado ao route
 * handler; o logger o inclui em toda linha. Contexto (orderId,
 * establishmentId, etc.) é redigido automaticamente — token/segredo não vai
 * para o log.
 */

export type LogLevel = "info" | "warn" | "error"

export interface LogContext {
  requestId?: string | null
  orderId?: string | null
  establishmentId?: string | null
  [key: string]: any
}

function emit(level: LogLevel, scope: string, message: string, context?: LogContext) {
  const payload = {
    level,
    scope,
    message,
    time: new Date().toISOString(),
    ...(context ? redactObject(context) : {}),
  }

  const line = JSON.stringify(payload)

  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.log(line)
}

export const logger = {
  info: (scope: string, message: string, context?: LogContext) => emit("info", scope, message, context),
  warn: (scope: string, message: string, context?: LogContext) => emit("warn", scope, message, context),
  error: (scope: string, message: string, context?: LogContext) => emit("error", scope, message, context),
}

/** Lê o request-id de uma requisição (header propagation no middleware). */
export function getRequestId(req: { headers: { get(name: string): string | null } }): string | undefined {
  return req.headers.get("x-request-id") || undefined
}
