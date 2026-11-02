import crypto from "crypto"

/**
 * Token de chamada interna (F1A-003/F1B-002).
 *
 * O bot (webhook do WhatsApp) cria pedidos chamando `/api/bot/create-order` por
 * self-fetch. A rota é pública (o middleware deixa passar), então qualquer um
 * poderia POSTar e criar pedido em qualquer loja.
 *
 * Em vez de criar uma env var nova (que o dono precisaria configurar e o bot
 * quebraria), o token é um **HMAC do `JWT_SECRET`** sobre o `establishmentId`:
 * só o servidor (que já tem o secret) consegue gerar.
 */

export const INTERNAL_CALL_HEADER = "x-internal-token"

function secret(): string | null {
  const value = process.env.JWT_SECRET
  return value && value.length > 0 ? value : null
}

export function signInternalCall(establishmentId: string): string | null {
  const key = secret()
  if (!key) return null
  return crypto.createHmac("sha256", key).update(`bot:create-order:${establishmentId}`).digest("hex")
}

export function verifyInternalCall(establishmentId: string, provided: string | null | undefined): boolean {
  const key = secret()
  const expected = signInternalCall(establishmentId)
  if (!key || !expected || !provided) return false

  const a = Buffer.from(expected, "utf8")
  const b = Buffer.from(provided, "utf8")
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
