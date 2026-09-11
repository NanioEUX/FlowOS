"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { X, ChevronRight, MessageCircle, Send, Loader2, Package, CheckCircle2, Copy, Check } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface OrderItem {
  name: string
  quantity: number
  price: number
  image?: string
  additionalOptions?: any[]
}

interface OrderMessage {
  id: string
  sender: string
  message: string
  read: boolean
  createdAt: string
}

interface Order {
  id: string
  orderNumber: number | null
  trackingToken: string | null
  items: string | OrderItem[]
  total: number
  status: string
  paymentStatus: string
  paymentMethod: string
  paymentLink: string | null
  pixPayload: string | null
  orderType: string
  customerName: string
  customerAddress: string | null
  notes: string | null
  deliveryPerson: string | null
  deliveryCode: string | null
  deliveryFee: number
  method: string
  createdAt: string | Date
  deliveredAt: string | Date | null
  updatedAt: number
  establishment?: { name: string; phone: string; logo: string | null; slug: string }
}

interface Theme {
  bgPage: string
  bgCard: string
  bgModal: string
  bgInput: string
  text: string
  textSubtle: string
  textMuted: string
  textMutedMore: string
  primary: string
  accent: string
  success: string
  borderCard: string
  borderSubtle: string
  borderInput: string
  overlay: string
}

const statusLabels: Record<string, string> = {
  pending: "Pedido Recebido",
  payment_pending: "Aguardando Pagamento",
  confirmed: "Confirmado",
  preparing: "Preparando",
  ready: "Pronto",
  out_for_delivery: "Saiu para Entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
  abandoned: "Pedido expirado",
}

function timeAgo(date: string | Date): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diffMin = Math.floor((now - then) / 60000)
  if (diffMin < 1) return "agora"
  if (diffMin < 60) return `${diffMin}min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD === 1) return "ontem"
  if (diffD < 7) return `${diffD}d`
  return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

function parseItems(items: string | OrderItem[]): OrderItem[] {
  if (typeof items === "string") {
    try { return JSON.parse(items) } catch { return [] }
  }
  return items
}

function getEstimatedTime(order: Order): string | null {
  if (order.status === "delivered" || order.status === "cancelled") return null
  const created = new Date(order.createdAt).getTime()
  const elapsed = (Date.now() - created) / 60000
  const base = order.orderType === "delivery" ? 45 : 25
  const remaining = Math.max(0, base - elapsed)
  if (remaining === 0) return "A qualquer momento"
  if (remaining <= 5) return "Pronto!"
  return `~${Math.ceil(remaining)} min`
}

interface OrdersScreenProps {
  theme: Theme
  orders: Order[]
  loading: boolean
  onClose: () => void
  onOpenTracking: (orderId: string, trackingUrl: string) => void
  onOpenIdentify: () => void
  onRefresh?: () => void
  onReorder?: (order: Order) => void
  hasPhone: boolean
  establishmentSlug: string
  loyaltyConfig?: { enabled?: boolean; pointsPerReal?: number } | null
}

export function OrdersScreen({
  theme,
  orders,
  loading,
  onClose,
  onOpenTracking,
  onOpenIdentify,
  onRefresh,
  onReorder,
  hasPhone,
  establishmentSlug,
  loyaltyConfig,
}: OrdersScreenProps) {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState("")
  const [chatSending, setChatSending] = useState(false)
  const [messages, setMessages] = useState<Record<string, OrderMessage[]>>({})
  const [copiedPixOrderId, setCopiedPixOrderId] = useState<string | null>(null)
  const [cancelModalOrderId, setCancelModalOrderId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelling, setCancelling] = useState(false)
  const [activeTab, setActiveTab] = useState<"active" | "history">("active")
  const chatEndRef = useRef<HTMLDivElement>(null)

  const calcPoints = (total: number) => {
    if (!loyaltyConfig?.enabled || !loyaltyConfig?.pointsPerReal) return 0
    return Math.floor(total / loyaltyConfig.pointsPerReal)
  }

  const activeOrders = orders.filter(o => ["pending", "payment_pending", "accepted", "confirmed", "preparing", "ready", "out_for_delivery"].includes(o.status))
  const historyOrders = orders.filter(o => ["delivered", "cancelled", "abandoned"].includes(o.status) || (o.status === "pending" && o.paymentStatus === "expired"))

  const hasActive = activeOrders.length > 0

  useEffect(() => {
    if (!hasActive && activeTab === "active") {
      setActiveTab("history")
    }
  }, [hasActive])

  const fetchMessages = useCallback(async (orderId: string, token: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/messages?token=${token}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(prev => ({ ...prev, [orderId]: data }))
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!chatOpen) return
    const order = orders.find(o => o.id === chatOpen)
    if (!order?.trackingToken) return
    fetchMessages(order.id, order.trackingToken)
    const interval = setInterval(() => fetchMessages(order.id, order.trackingToken!), 10000)
    return () => clearInterval(interval)
  }, [chatOpen, orders, fetchMessages])

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" })
  }, [messages, chatOpen])

  async function sendChatMessage(orderId: string, token: string) {
    if (!chatInput.trim() || chatSending) return
    setChatSending(true)
    try {
      await fetch(`/api/orders/${orderId}/messages?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: chatInput.trim() }),
      })
      setChatInput("")
      fetchMessages(orderId, token)
    } catch {}
    setChatSending(false)
  }

  function getActiveTimelineSteps(order: Order) {
    if (order.orderType === "pickup") {
      return [
        { key: "accepted", label: "Aceito" },
        { key: "preparing", label: "Preparando" },
        { key: "ready", label: "Pronto para Retirada" },
      ]
    }
    return [
      { key: "accepted", label: "Aceito" },
      { key: "preparing", label: "Preparando" },
      { key: "ready", label: "Pronto" },
      { key: "out_for_delivery", label: "Saiu p/ Entrega" },
    ]
  }

  function getTimelineIdx(order: Order) {
    const isPickup = order.orderType === "pickup"
    const statusOrder = isPickup
      ? ["accepted", "preparing", "ready"]
      : ["accepted", "preparing", "ready", "out_for_delivery", "delivered"]
    // Só marca a partir do "accepted". Se ainda em pending/new/confirmed
    // (auto-aceite OFF), retorna -1 → nenhum step marcado.
    return statusOrder.indexOf(order.status)
  }

  const paymentLabels: Record<string, string> = {
    online: "Online", pix: "PIX", card: "Cartão", cash: "Dinheiro",
    delivery: "Na entrega", pickup: "Na retirada",
    card_delivery: "Cartão na entrega", card_pickup: "Cartão na retirada",
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ backgroundColor: theme.overlay }}>
      <div className="w-full max-w-lg max-h-[85vh] overflow-hidden rounded-t-2xl sm:rounded-2xl flex flex-col" style={{ backgroundColor: theme.bgPage }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: theme.borderCard }}>
          <h1 className="text-lg font-bold" style={{ color: theme.text }}>Meus Pedidos</h1>
          <button onClick={onClose} className="p-1.5 rounded-full hover:opacity-70" style={{ color: theme.textMutedMore }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        {hasPhone && !loading && (
          <div className="flex border-b shrink-0" style={{ borderColor: theme.borderCard }}>
            <button
              onClick={() => setActiveTab("active")}
              className="flex-1 py-2.5 text-xs font-semibold text-center relative transition-colors"
              style={{ color: activeTab === "active" ? theme.primary : theme.textMutedMore }}
            >
              Em Andamento {activeOrders.length > 0 && <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: theme.primary }}>{activeOrders.length}</span>}
              {activeTab === "active" && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: theme.primary }} />}
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className="flex-1 py-2.5 text-xs font-semibold text-center relative transition-colors"
              style={{ color: activeTab === "history" ? theme.primary : theme.textMutedMore }}
            >
              Histórico {historyOrders.length > 0 && <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: theme.textMutedMore }}>{historyOrders.length}</span>}
              {activeTab === "history" && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: theme.primary }} />}
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!hasPhone ? (
            <div className="text-center py-10">
              <p className="text-sm" style={{ color: theme.textMuted }}>Identifique-se para ver seus pedidos</p>
              <button onClick={onOpenIdentify} className="mt-3 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: theme.primary }}>Identificar-se</button>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" style={{ color: theme.primary }} /></div>
          ) : activeTab === "active" ? (
            activeOrders.length === 0 ? (
              <div className="text-center py-10">
                <Package className="mx-auto h-8 w-8 mb-2" style={{ color: theme.textMutedMore }} />
                <p className="text-sm" style={{ color: theme.textMuted }}>Nenhum pedido em andamento</p>
              </div>
            ) : (
            <div className="space-y-3">
                {activeOrders.map(order => {
                  const items = parseItems(order.items)
                  const flowIdx = getTimelineIdx(order)
                  const deliveryCode = order.deliveryCode
                  const isExpanded = expandedOrder === order.id
                  const elapsed = getEstimatedTime(order)
                  const msgs = messages[order.id] || []
                  const unreadCount = msgs.filter(m => m.sender === "establishment" && !m.read).length
                  const isCancelled = order.status === "cancelled"

                  return (
                    <div
                      key={order.id}
                      className="rounded-xl border overflow-hidden"
                      style={{
                        borderColor: isCancelled ? "rgba(239,68,68,0.2)" : theme.borderCard,
                        backgroundColor: theme.bgCard,
                      }}
                    >
                      <div className="p-4">
                        {/* Header: Pedido # + Código + Pontos */}
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold" style={{ color: theme.text }}>
                              Pedido #{order.orderNumber || order.id.slice(0, 8)}
                            </span>
                            {calcPoints(order.total) > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${theme.success}18`, color: theme.success }}>
                                +{calcPoints(order.total)} pts
                              </span>
                            )}
                          </div>
                          {deliveryCode && (
                            <span className="text-sm font-bold px-2 py-0.5 rounded" style={{ backgroundColor: `${theme.primary}12`, color: theme.primary }}>
                              Código {deliveryCode}
                            </span>
                          )}
                        </div>

                        {/* Previsão */}
                        {elapsed && (
                          <p className="text-sm mb-2 font-medium" style={{ color: theme.success }}>
                            Chega em {elapsed}
                          </p>
                        )}

                        {/* Timeline — progresso horizontal */}
                        <div className="my-3">
                          <div className="flex items-center justify-between mb-1">
                            {getActiveTimelineSteps(order).map((step, i) => {
                              const stepIdx = ["accepted", "preparing", "ready", "out_for_delivery"].indexOf(step.key)
                              const isDone = flowIdx >= stepIdx
                              const isCurrent = flowIdx === stepIdx
                              return (
                                <span key={step.key} className="text-[10px] text-center flex-1" style={{ color: isDone ? theme.primary : theme.textMutedMore, fontWeight: isCurrent ? 700 : 400 }}>
                                  {isDone && !isCurrent ? "✓ " : ""}{step.label}
                                </span>
                              )
                            })}
                          </div>
                          <div className="relative h-1.5 w-full rounded-full" style={{ backgroundColor: theme.borderCard }}>
                            <div
                              className="absolute h-1.5 rounded-full transition-all duration-500"
                              style={{
                                backgroundColor: theme.primary,
                                width: `${(() => {
                                  const steps = getActiveTimelineSteps(order)
                                  if (steps.length <= 1) return flowIdx >= 0 ? 100 : 0
                                  const pctPerStep = 100 / (steps.length - 1)
                                  return Math.min(100, flowIdx * pctPerStep)
                                })()}`
                              }}
                            />
                          </div>
                        </div>

                        {/* Items */}
                        <div className="mb-3 space-y-2">
                          {items.slice(0, isExpanded ? items.length : 2).map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2.5">
                              {item.image && (
                                <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: theme.text }}>
                                  {item.quantity}x {item.name}
                                </p>
                              </div>
                            </div>
                          ))}
                          {!isExpanded && items.length > 2 && (
                            <button
                              onClick={() => setExpandedOrder(order.id)}
                              className="text-sm font-medium flex items-center gap-0.5"
                              style={{ color: theme.primary }}
                            >
                              Ver mais detalhes <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {isExpanded && items.length > 2 && (
                            <button
                              onClick={() => setExpandedOrder(null)}
                              className="text-sm font-medium flex items-center gap-0.5"
                              style={{ color: theme.textMutedMore }}
                            >
                              <ChevronRight className="h-3.5 w-3.5 rotate-90" /> Menos detalhes
                            </button>
                          )}
                        </div>

                        {/* Delivery person */}
                        {order.deliveryPerson && (
                          <div className="flex items-center gap-2 mb-3 pb-3 border-b" style={{ borderColor: theme.borderSubtle }}>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${theme.primary}15`, color: theme.primary }}>
                              {order.deliveryPerson.charAt(0)}
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-medium" style={{ color: theme.text }}>{order.deliveryPerson}</p>
                              <p className="text-[10px]" style={{ color: theme.textMutedMore }}>🛵 Moto</p>
                            </div>
                          </div>
                        )}

                        {/* Total */}
                        <div className="mb-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm" style={{ color: theme.textMutedMore }}>Total pago</span>
                            <span className="text-base font-bold" style={{ color: theme.text }}>{formatCurrency(order.total)}</span>
                          </div>
                          {order.paymentMethod && (
                            <p className="text-xs text-right mt-0.5" style={{ color: theme.textMutedMore }}>
                              {paymentLabels[order.paymentMethod] || order.paymentMethod}
                            </p>
                          )}
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="mb-3 pt-3 border-t" style={{ borderColor: theme.borderSubtle }}>
                            {items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-xs mb-1">
                                <span style={{ color: theme.text }}>{item.quantity}x {item.name}</span>
                                <span className="font-medium" style={{ color: theme.text }}>{formatCurrency(item.price * item.quantity)}</span>
                              </div>
                            ))}
                            {order.deliveryFee > 0 && (
                              <div className="flex justify-between text-xs mt-1" style={{ color: theme.textMutedMore }}>
                                <span>Taxa de entrega</span>
                                <span>{formatCurrency(order.deliveryFee)}</span>
                              </div>
                            )}
                            {order.notes && (
                              <p className="text-[11px] italic mt-1" style={{ color: theme.textMutedMore }}>Obs: {order.notes}</p>
                            )}
                            {order.customerAddress && (
                              <p className="text-[11px] mt-1" style={{ color: theme.textMutedMore }}>📍 {order.customerAddress}</p>
                            )}
                            <button
                              onClick={() => setExpandedOrder(null)}
                              className="text-[11px] mt-2 flex items-center gap-0.5"
                              style={{ color: theme.textMutedMore }}
                            >
                              <ChevronRight className="h-3 w-3 rotate-90" /> Menos detalhes
                            </button>
                          </div>
                        )}

                        {/* PIX Copy Button */}
                        {order.paymentStatus === "pending" && order.pixPayload && (
                          <button
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(order.pixPayload!)
                                setCopiedPixOrderId(order.id)
                                setTimeout(() => setCopiedPixOrderId(null), 2000)
                              } catch {
                                alert("Não foi possível copiar. Tente novamente.")
                              }
                            }}
                            className="w-full mb-2 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-opacity hover:opacity-90"
                            style={{ borderColor: theme.primary, color: theme.primary, backgroundColor: `${theme.primary}08` }}
                          >
                            {copiedPixOrderId === order.id ? (
                              <><Check className="h-4 w-4" /> Copiado!</>
                            ) : (
                              <><Copy className="h-4 w-4" /> Copiar código PIX</>
                            )}
                          </button>
                        )}

                        {/* Actions: Ajuda / Chat */}
                        <div className="flex gap-2">
                          {order.trackingToken && (
                            <button
                              onClick={() => setChatOpen(chatOpen === order.id ? null : order.id)}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                              style={{ backgroundColor: theme.primary, color: "#fff" }}
                            >
                              <MessageCircle className="h-4 w-4" />
                              Ajuda / Chat
                              {unreadCount > 0 && (
                                <span className="h-4 min-w-4 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: "#ef4444" }}>
                                  {unreadCount}
                                </span>
                              )}
                            </button>
                          )}
                        </div>

                        {/* Cancelar */}
                        {["pending", "payment_pending", "confirmed"].includes(order.status) && (
                          <button
                            onClick={() => {
                              setCancelModalOrderId(order.id)
                              setCancelReason("")
                            }}
                            className="w-full mt-2 py-2 text-xs font-medium text-center"
                            style={{ color: theme.textMutedMore }}
                          >
                            Cancelar pedido
                          </button>
                        )}
                      </div>

                      {/* Chat inline */}
                      {chatOpen === order.id && order.trackingToken && (
                        <div className="border-t" style={{ borderColor: theme.borderSubtle }}>
                          <div className="p-3 max-h-40 overflow-y-auto space-y-2" style={{ backgroundColor: theme.bgPage }}>
                            {(!messages[order.id] || messages[order.id].length === 0) && (
                              <p className="text-center text-[11px] py-2" style={{ color: theme.textMutedMore }}>Envie uma mensagem ao estabelecimento</p>
                            )}
                            {messages[order.id]?.map(msg => (
                              <div key={msg.id} className={`flex ${msg.sender === "customer" ? "justify-end" : "justify-start"}`}>
                                <div className="max-w-[75%] rounded-lg px-3 py-1.5 text-xs" style={{
                                  backgroundColor: msg.sender === "customer" ? theme.primary : theme.bgCard,
                                  color: msg.sender === "customer" ? "#fff" : theme.text,
                                }}>
                                  <p>{msg.message}</p>
                                  <p className="text-[9px] mt-0.5 opacity-60">
                                    {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                  </p>
                                </div>
                              </div>
                            ))}
                            <div ref={chatEndRef} />
                          </div>
                          <div className="flex items-center gap-2 p-3 border-t" style={{ borderColor: theme.borderCard }}>
                            <input
                              value={chatInput}
                              onChange={e => setChatInput(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") sendChatMessage(order.id, order.trackingToken!) }}
                              placeholder="Digite sua mensagem..."
                              className="flex-1 h-9 rounded-lg border px-3 text-xs"
                              style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput }}
                            />
                            <button
                              onClick={() => sendChatMessage(order.id, order.trackingToken!)}
                              disabled={!chatInput.trim() || chatSending}
                              className="h-9 w-9 rounded-lg flex items-center justify-center text-white disabled:opacity-50"
                              style={{ backgroundColor: theme.primary }}
                            >
                              <Send className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          ) : (
            /* History tab */
            historyOrders.length === 0 ? (
              <div className="text-center py-10">
                <Package className="mx-auto h-8 w-8 mb-2" style={{ color: theme.textMutedMore }} />
                <p className="text-sm" style={{ color: theme.textMuted }}>Nenhum pedido no histórico</p>
              </div>
            ) : (
              <div className="space-y-3">
                {historyOrders.map(order => {
                  const items = parseItems(order.items)
                  const isExpanded = expandedOrder === order.id
                  const isCancelled = order.status === "cancelled"
                  const isAbandoned = order.status === "abandoned"

                  return (
                    <div
                      key={order.id}
                      className="rounded-xl border overflow-hidden"
                      style={{
                        borderColor: isCancelled ? "rgba(239,68,68,0.2)" : isAbandoned ? "rgba(249,115,22,0.2)" : theme.borderCard,
                        backgroundColor: theme.bgCard,
                      }}
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold" style={{ color: theme.text }}>
                              Pedido #{order.orderNumber || order.id.slice(0, 8)}
                            </span>
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{
                              backgroundColor: isCancelled ? "rgba(239,68,68,0.1)" : isAbandoned ? "rgba(249,115,22,0.1)" : "rgba(34,197,94,0.1)",
                              color: isCancelled ? "#ef4444" : isAbandoned ? "#f97316" : "#22c55e",
                            }}>
                              {statusLabels[order.status] || order.status}
                            </span>
                          </div>
                          <span className="text-[10px]" style={{ color: theme.textMutedMore }}>
                            {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-xs truncate flex-1 mr-2" style={{ color: theme.textMutedMore }}>
                            {items.map(it => `${it.quantity}x ${it.name}`).join(", ")}
                          </div>
                          <span className="text-sm font-bold" style={{ color: theme.text }}>
                            {formatCurrency(order.total)}
                          </span>
                        </div>
                        {order.deliveredAt && (
                          <p className="text-[11px] mt-1" style={{ color: theme.textMutedMore }}>
                            Entregue em {new Date(order.deliveredAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        )}
                        {order.notes && (
                          <p className="text-[11px] italic mt-1" style={{ color: theme.textMutedMore }}>Obs: {order.notes}</p>
                        )}
                        {onReorder && !isCancelled && !isAbandoned && (
                          <button
                            onClick={() => onReorder(order)}
                            className="mt-2 w-full py-2 rounded-lg text-sm font-medium text-white transition-colors"
                            style={{ backgroundColor: theme.primary }}
                          >
                            Pedir novamente
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>
      </div>

      {/* Cancel modal */}
      {cancelModalOrderId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4">
            <h3 className="text-base font-bold text-zinc-900">Cancelar pedido?</h3>
            <p className="text-sm text-zinc-500">
              {orders.find(o => o.id === cancelModalOrderId)?.status === "confirmed"
                ? "Este pedido já foi confirmado. Tem certeza que deseja cancelar?"
                : "Deseja cancelar este pedido?"}
            </p>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Motivo (opcional)</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ex: Errei o pedido..."
                maxLength={500}
                rows={3}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setCancelModalOrderId(null); setCancelReason("") }}
                disabled={cancelling}
                className="flex-1 py-2.5 text-sm font-medium rounded-lg border border-zinc-200 text-zinc-700"
              >
                Voltar
              </button>
              <button
                onClick={async () => {
                  if (!cancelModalOrderId) return
                  setCancelling(true)
                  try {
                    const order = orders.find(o => o.id === cancelModalOrderId)
                    await fetch(`/api/orders/${cancelModalOrderId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        status: "cancelled",
                        cancelledBy: "customer",
                        cancellationReason: cancelReason || undefined,
                        trackingToken: order?.trackingToken,
                      }),
                    })
                    setCancelModalOrderId(null)
                    setCancelReason("")
                    onRefresh?.()
                  } catch (e) {
                    console.error("Erro ao cancelar:", e)
                  } finally {
                    setCancelling(false)
                  }
                }}
                disabled={cancelling}
                className="flex-1 py-2.5 text-sm font-medium rounded-lg text-white bg-red-500 hover:bg-red-600 disabled:opacity-50"
              >
                {cancelling ? "Cancelando..." : "Sim, cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
