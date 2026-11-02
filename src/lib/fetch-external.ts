import { logger } from "@/lib/logger"
// F3A-044/F4A-010: fetch para chamadas EXTERNAS com timeout — provedor mudo
// (iFood/99/Meta/Evolution/gateways) não segura a função serverless até o kill
// da Vercel. Usar só em chamadas fora do próprio app; fetch interno não precisa.
const EXTERNAL_TIMEOUT_MS = 15000

export async function fetchExternal(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const signal = init?.signal ?? AbortSignal.timeout(EXTERNAL_TIMEOUT_MS)
  return fetch(input, init ? { ...init, signal } : { signal })
}

// F4A-011: não existia retry genérico — falha transitória de rede/5xx virava
// falha permanente para o usuário. O retry é feito só em método idempotente
// (GET/HEAD/PUT/DELETE) ou quando o chamador marca explicitamente
// `retryable: true` (POST de criação costuma ser seguro com idempotência).
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])
const DEFAULT_RETRIES = 2

export interface RetryOptions extends RequestInit {
  /** número de novas tentativas (padrão 2) */
  retries?: number
  /** delay inicial do backoff em ms (padrão 300) */
  backoffMs?: number
  /** força retry mesmo em POST (use só com idempotência garantida) */
  retryable?: boolean
}

function isRetryableMethod(method: string | undefined): boolean {
  const m = (method || "GET").toUpperCase()
  return m === "GET" || m === "HEAD" || m === "OPTIONS" || m === "PUT" || m === "DELETE"
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Fetch externo com timeout + retry exponencial em falha transitória.
 *
 * - Erros de rede (TypeError) e status 408/425/429/5xx são retentáveis.
 * - 4xx (exceto 408/425/429) NÃO são retentáveis — não adianta repetir.
 * - O corpo da resposta é bufferizado para poder repetir a requisição.
 */
export async function fetchExternalWithRetry(
  input: RequestInfo | URL,
  options: RetryOptions = {}
): Promise<Response> {
  const { retries = DEFAULT_RETRIES, backoffMs = 300, retryable, ...init } = options
  const attempts = retries + 1
  const canRetry = retryable ?? isRetryableMethod(init.method)

  let lastError: any = null

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const signal = init.signal ?? AbortSignal.timeout(EXTERNAL_TIMEOUT_MS)
      const res = await fetch(input, { ...init, signal })

      if (!canRetry || attempt === attempts || !RETRYABLE_STATUS.has(res.status)) {
        return res
      }

      // Consome o corpo para liberar a conexão antes de repetir
      try {
        await res.arrayBuffer()
      } catch {
        /* body já consumido */
      }
      lastError = new Error(`HTTP ${res.status}`)
      logger.warn("fetch-external", "retry após resposta retryable", {
        method: init.method || "GET",
        url: String(input).slice(0, 120),
        status: res.status,
        attempt,
        maxAttempts: attempts,
      })
    } catch (err: any) {
      lastError = err
      // Timeout/abort explícito do chamador não é retentável
      if (init.signal?.aborted) throw err
      if (!canRetry || attempt === attempts) throw err
      logger.warn("fetch-external", "retry após erro de rede", {
        method: init.method || "GET",
        url: String(input).slice(0, 120),
        error: err?.message,
        attempt,
        maxAttempts: attempts,
      })
    }

    await sleep(backoffMs * Math.pow(2, attempt - 1))
  }

  throw lastError ?? new Error("fetchExternalWithRetry falhou")
}
