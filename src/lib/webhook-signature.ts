import crypto from "crypto"

/**
 * Comparação timing-safe que não lança quando os comprimentos diferem
 * (crypto.timingSafeEqual lança RangeError com buffers de tamanhos distintos).
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Verifica assinatura HMAC-SHA256 de um webhook (hex).
 * opts.stripPrefix remove prefixos como "sha256=" (Meta/X-Hub-Signature-256).
 */
export function verifyHmacSha256(
  rawBody: string,
  signature: string,
  secret: string,
  opts?: { stripPrefix?: string }
): boolean {
  if (!signature || !secret) return false
  let sig = signature.trim()
  const prefix = opts?.stripPrefix
  if (prefix && sig.toLowerCase().startsWith(prefix.toLowerCase())) {
    sig = sig.slice(prefix.length)
  }
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
  return timingSafeEqualStr(sig.toLowerCase(), expected.toLowerCase())
}
