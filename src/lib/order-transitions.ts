// Máquina de estados do pedido no servidor (F5A-002 / F5D-008 / Fase 5 Top 1).
// Hoje o PATCH /api/orders/[id] aceitava qualquer status; este módulo é a
// fonte única de verdade das transições permitidas — o handler valida, o teste
// cobre. Regra: progresso para frente (whitelist), cancelamento a partir de
// qualquer estado não-final, terminais sem volta, e papéis restritos (kds não
// cancela/entrega; motoboy não muta status por aqui).

export const ORDER_STATUSES = [
  "payment_pending",
  "pending",
  "new",
  "confirmed",
  "accepted",
  "preparing",
  "ready",
  "dispatched",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "abandoned",
] as const

// Transições válidas a partir de cada estado (alvos de `status` no PATCH).
// Não listado = terminal. Mesmo-status é idempotente e permitido.
export const ORDER_TRANSITIONS: Record<string, readonly string[]> = {
  payment_pending: ["confirmed", "cancelled", "abandoned"],
  pending: ["payment_pending", "new", "confirmed", "accepted", "preparing", "cancelled", "abandoned"],
  new: ["confirmed", "accepted", "preparing", "cancelled", "abandoned"],
  confirmed: ["accepted", "preparing", "cancelled", "abandoned"],
  accepted: ["preparing", "cancelled", "abandoned"],
  preparing: ["ready", "cancelled"],
  ready: ["dispatched", "out_for_delivery", "delivered", "cancelled"],
  dispatched: ["out_for_delivery", "delivered", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
  abandoned: ["cancelled"],
}

// O que o token `kds` pode gravar (botões do getNextAction do KDS).
export const KDS_ALLOWED_TARGETS = ["accepted", "preparing", "ready"] as const

export function isValidStatus(status: string): boolean {
  return (ORDER_STATUSES as readonly string[]).includes(status)
}

export function canTransition(from: string, to: string): boolean {
  if (from === to) return true
  if (!isValidStatus(to)) return false
  const allowed = ORDER_TRANSITIONS[from]
  if (!allowed) return false
  return allowed.includes(to)
}

/**
 * F4B-035: pagamento que chega DEPOIS do cancelamento/expiração.
 *
 * O cron `expire-orders` marca o pedido como `abandoned` e o cliente ainda
 * pode pagar o PIX minutos depois. O webhook/polling confirmava o pagamento
 * E ressuscitava o pedido (`status: "pending"`), quebrando a regra de
 * terminal. Aqui o dinheiro é registrado como pago, mas o pedido NÃO volta
 * — o reembolso fica como ação manual do lojista (com alerta no log).
 */
export function isClosedOrderStatus(status: string | undefined | null): boolean {
  return status === "cancelled" || status === "abandoned" || status === "delivered"
}

// Regra por papel para mudanças de status via PATCH autenticado.
export function isRoleAllowedToSetStatus(role: string | undefined | null, to: string): boolean {
  if (role === "motoboy") return false
  if (role === "kds") {
    return (KDS_ALLOWED_TARGETS as readonly string[]).includes(to)
  }
  return true
}
