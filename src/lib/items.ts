import { logger } from "@/lib/logger"
/**
 * Parse seguro da coluna `Order.items` (F4A-025).
 *
 * `Order.items` é uma string JSON. Um `items` corrompido (edição manual,
 * migração, dado antigo) derrubava a tela inteira — o `JSON.parse` estourava
 * dentro do render e matava o KDS, o painel de pedidos, o tracking e a API
 * de dashboard.
 *
 * `parseOrderItems` nunca lança: devolve `[]` e registra o erro.
 */

export interface OrderItemLike {
  quantity?: number
  name?: string
  price?: number
  [key: string]: any
}

// Retorna `any[]` de propósito: os consumidores já tratavam `items` como
// `any` (o shape real depende do canal que criou o pedido).
export function parseOrderItems(raw: unknown): any[] {
  if (raw === null || raw === undefined) return []
  if (Array.isArray(raw)) return raw as OrderItemLike[]
  if (typeof raw !== "string") return []

  const trimmed = raw.trim()
  if (!trimmed) return []

  try {
    const parsed = JSON.parse(trimmed)
    return Array.isArray(parsed) ? parsed : []
  } catch (err: any) {
    logger.error("items", "items inválido (JSON corrompido)", { error: err?.message })
    return []
  }
}
