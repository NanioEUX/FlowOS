/**
 * F2-001 — defesa contra mass assignment em `prisma.*.update`.
 *
 * O corpo da requisição nunca deve chegar cru ao Prisma: um campo a mais no
 * body (ou um objeto no lugar do scalar) permitiria (a) gravar colunas fora do
 * escopo da operação (`establishmentId`, `id`, `createdAt`…) e (b) executar
 * *nested writes* do Prisma (`connect`/`create`/`deleteMany`), escrevendo em
 * outras tabelas a partir de uma rota que só deveria atualizar um registro.
 *
 * `pickUpdateData` devolve apenas as chaves da whitelist cujo valor é scalar
 * (string/number/boolean) ou `null`. Objetos e arrays são descartados — nenhum
 * cliente legítimo envia nested write no PATCH destas rotas.
 */
export function pickUpdateData(
  body: unknown,
  allowed: readonly string[]
): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  if (!body || typeof body !== "object" || Array.isArray(body)) return data
  const allowedSet = new Set(allowed)
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (!allowedSet.has(key)) continue
    if (value === undefined) continue
    if (value !== null && typeof value === "object") continue
    data[key] = value
  }
  return data
}
