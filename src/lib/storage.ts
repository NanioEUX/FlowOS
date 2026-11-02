/**
 * F8A-010: versionamento do localStorage.
 *
 * Sem versão, uma mudança de formato do dado gravado faz o app ler o valor
 * antigo como se fosse o novo (ex.: carrinho que era array passa a ser objeto)
 * e regrava `[]` — apagando o carrinho do cliente silenciosamente.
 *
 * A migração nunca descarta dado: se a chave versionada ainda não existe, o
 * valor da chave legada é copiado para a nova e só então removido.
 */

export const STORAGE_VERSION = 2

export function storageKey(key: string): string {
  return `flowos:v${STORAGE_VERSION}:${key}`
}

export function readStorage<T>(key: string, legacyKey: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const current = window.localStorage.getItem(storageKey(key))
    if (current !== null) {
      try {
        return JSON.parse(current) as T
      } catch {
        return fallback
      }
    }
    const legacy = window.localStorage.getItem(legacyKey)
    if (legacy !== null) {
      try {
        const parsed = JSON.parse(legacy)
        // só migra quando o valor legado é legível — dado corrompido não é apagado
        window.localStorage.setItem(storageKey(key), legacy)
        window.localStorage.removeItem(legacyKey)
        return parsed as T
      } catch {
        return fallback
      }
    }
  } catch {}
  return fallback
}

export function writeStorage(key: string, value: unknown): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify(value))
  } catch {}
}

export function removeStorage(key: string, legacyKey?: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(storageKey(key))
    if (legacyKey) window.localStorage.removeItem(legacyKey)
  } catch {}
}
