/**
 * F4B-019 — idempotência do `POST /api/orders`.
 *
 * O cardápio (e o bot) podem reenviar o mesmo pedido: duplo clique, retry de
 * rede, retry do proxy. Sem chave de idempotência, cada reenvio cria um pedido
 * novo — e, se for pagamento online, **cobra o cliente duas vezes**.
 *
 * O padrão adotado (Stripe/PayPal): o cliente gera um `Idempotency-Key` por
 * tentativa de pedido e a reenvia no header `Idempotency-Key`. O servidor
 * persiste essa chave junto do pedido; se a mesma chave chegar de novo para o
 * mesmo estabelecimento, devolve o pedido já criado em vez de criar outro.
 *
 * ## Por que este arquivo existe separado
 *
 * A coluna `Order.clientRequestId` **ainda não está no banco de produção**
 * (decisão do dono — ver `docs/DB-CHANGES-PENDENTES.md`). Enquanto ela não
 * existir, o Prisma Client não pode referenciá-la: mudar o `schema.prisma`
 * quebraria **todas** as queries de `Order` em produção.
 *
 * Então este módulo cuida só da parte que dá para testar sem banco:
 * normalizar/validar a chave. A busca no banco (1 linha de `findFirst`) e o
 * replay da resposta ficam documentados em `docs/DB-CHANGES-PENDENTES.md`,
 * prontos para o dev aplicar depois do `db push`.
 */

/** Header padrão de idempotência (mesmo nome do Stripe). */
export const IDEMPOTENCY_HEADER = "idempotency-key"

/** Comprimento máximo aceito — evita chave gigante ocupando o índice. */
export const MAX_CLIENT_REQUEST_ID_LENGTH = 100

/**
 * Charset aceito: letras, números, ponto, hífen, underscore e dois-pontos.
 * Rejeita espaço, barra e acento (a chave vai para URL/índice).
 */
const CLIENT_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/

/**
 * Normaliza a chave de idempotência.
 *
 * Devolve `null` quando a chave é ausente ou inválida — nesse caso o pedido é
 * processado **sem** idempotência (comportamento atual, preservado).
 */
export function normalizeClientRequestId(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const value = raw.trim()
  if (!value) return null
  if (value.length > MAX_CLIENT_REQUEST_ID_LENGTH) return null
  if (!CLIENT_REQUEST_ID_PATTERN.test(value)) return null
  return value
}

/**
 * Lê a chave de idempotência do request (header `Idempotency-Key`).
 *
 * Aceita também o header `x-idempotency-key` — alguns proxies/clientes
 * legados usam o prefixo `x-`.
 */
export function extractClientRequestId(req: {
  headers: { get(name: string): string | null }
}): string | null {
  return (
    normalizeClientRequestId(req.headers.get(IDEMPOTENCY_HEADER)) ??
    normalizeClientRequestId(req.headers.get(`x-${IDEMPOTENCY_HEADER}`))
  )
}

/**
 * Monta o par de filtros para buscar um pedido já criado com a mesma chave.
 * Devolve `null` quando não há chave (não há o que buscar).
 */
export function idempotencyLookup(establishmentId: string, clientRequestId: string | null): {
  establishmentId: string
  clientRequestId: string
} | null {
  if (!clientRequestId) return null
  return { establishmentId, clientRequestId }
}
