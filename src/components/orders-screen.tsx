"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { X, ChevronRight, MessageCircle, Phone, Send, Loader2, Package, Clock, CheckCircle2, Bike, ShoppingBag, Store, RefreshCw, Copy, Check } from "lucide-react"
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
  abandoned: "Expirado",
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
  onReorder: (order: Order) => void
  onOpenIdentify: () => void
  onRefresh?: () => void
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
  onReorder,
  onOpenIdentify,
  onRefresh,
  hasPhone,
  establishmentSlug,
  loyaltyConfig,
}: OrdersScreenProps) {
  const [activeTab, setActiveTab] = useState<"active" | "history">("active")
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState("")
  const [chatSending, setChatSending] = useState(false)
  const [messages, setMessages] = useState<Record<string, OrderMessage[]>>({})
  const [copiedPixOrderId, setCopiedPixOrderId] = useState<string | null>(null)
  const [cancelModalOrderId, setCancelModalOrderId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelling, setCancelling] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const calcPoints = (total: number) => {
    if (!loyaltyConfig?.enabled || !loyaltyConfig?.pointsPerReal) return 0
    return Math.floor(total / loyaltyConfig.pointsPerReal)
  }

  // Poll for order updates every 15s
  useEffect(() => {
    if (!onRefresh) return
    const interval = setInterval(() => onRefresh(), 15000)
    return () => clearInterval(interval)
  }, [onRefresh])

  const activeOrders = orders.filter(o => ["pending", "payment_pending", "confirmed", "preparing", "ready", "out_for_delivery"].includes(o.status))
  const historyOrders = orders.filter(o => ["delivered", "cancelled", "abandoned"].includes(o.status) || (o.status === "pending" && o.paymentStatus === "expired"))

  const hasActive = activeOrders.length > 0

  // Auto-switch to history when no active orders
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
      await fetch(`/api/orders/${orderId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: chatInput.trim(), token }),
      })
      setChatInput("")
      fetchMessages(orderId, token)
    } catch {}
    setChatSending(false)
  }

  function getActiveTimelineSteps(order: Order) {
    if (order.orderType === "pickup") {
      return [
        { key: "confirmed", label: "Confirmado" },
        { key: "preparing", label: "Preparando" },
        { key: "ready", label: "Pronto para Retirada" },
      ]
    }
    return [
      { key: "confirmed", label: "Confirmado" },
      { key: "preparing", label: "Preparando" },
      { key: "ready", label: "Pronto" },
      { key: "out_for_delivery", label: "Saiu p/ Entrega" },
    ]
  }

  function getTimelineIdx(order: Order) {
    const isPickup = order.orderType === "pickup"
    const statusOrder = isPickup
      ? ["pending", "confirmed", "preparing", "ready"]
      : ["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered"]
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
        <div className="flex border-b shrink-0" style={{ borderColor: theme.borderCard }}>
          {hasActive && (
            <button
              onClick={() => setActiveTab("active")}
              className="flex-1 py-2.5 text-sm font-semibold text-center relative"
              style={{ color: activeTab === "active" ? theme.primary : theme.textMutedMore }}
            >
              Em Andamento {activeOrders.length > 0 && <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: theme.primary }}>{activeOrders.length}</span>}
              {activeTab === "active" && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: theme.primary }} />}
            </button>
          )}
          <button
            onClick={() => setActiveTab("history")}
            className="flex-1 py-2.5 text-sm font-semibold text-center relative"
            style={{ color: activeTab === "history" ? theme.primary : theme.textMutedMore }}
          >
            Histórico
            {activeTab === "history" && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: theme.primary }} />}
          </button>
        </div>

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

                        {/* Timeline — 4 steps: Confirmado, Preparando, Pronto, Saiu */}
                        <div className="flex items-center gap-0 my-3">
                          {getActiveTimelineSteps(order).map((step, i) => {
                            const stepIdx = ["pending", "confirmed", "preparing", "ready", "out_for_delivery"].indexOf(step.key)
                            const isCompleted = flowIdx > stepIdx || (flowIdx === stepIdx)
                            const isCurrent = flowIdx === stepIdx + 1 || (step.key === "confirmed" && order.status === "confirmed") || (step.key === "preparing" && order.status === "preparing") || (step.key === "ready" && order.status === "ready") || (step.key === "out_for_delivery" && order.status === "out_for_delivery")
                            const isDone = flowIdx > stepIdx

                            return (
                              <div key={step.key} className="flex-1 flex flex-col items-center relative">
                                {i > 0 && (
                                  <div className="absolute top-[6px] right-1/2 w-full h-[2px]" style={{ backgroundColor: isDone ? theme.primary : theme.borderCard }} />
                                )}
                                <div
                                  className="relative z-10 w-3 h-3 rounded-full flex items-center justify-center"
                                  style={isDone
                                    ? { backgroundColor: theme.primary }
                                    : { backgroundColor: theme.bgPage, border: `2px solid ${theme.borderCard}` }
                                  }
                                >
                                  {isDone && <CheckCircle2 className="absolute -top-0.5 -left-0.5 h-3.5 w-3.5" style={{ color: theme.primary }} />}
                                </div>
                                <span className="text-[10px] mt-1 text-center leading-tight" style={{ color: isDone ? theme.text : theme.textMutedMore }}>
                                  {step.label}
                                </span>
                              </div>
                            )
                          })}
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
                <Clock className="mx-auto h-8 w-8 mb-2" style={{ color: theme.textMutedMore }} />
                <p className="text-sm" style={{ color: theme.textMuted }}>Nenhum pedido no histórico</p>
              </div>
            ) : (() => {
              // Group orders by month
              const monthGroups: Record<string, Order[]> = {}
              historyOrders.forEach(order => {
                const d = new Date(order.createdAt)
                const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`
                const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
                if (!monthGroups[key]) monthGroups[key] = []
                monthGroups[key].push(order)
              })
              const sortedKeys = Object.keys(monthGroups).sort().reverse()

              return (
                <div className="space-y-5">
                  {sortedKeys.map(key => {
                    const monthLabel = monthGroups[key][0].createdAt
                      ? new Date(monthGroups[key][0].createdAt).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
                      : key
                    return (
                      <div key={key}>
                        <h3 className="text-sm font-bold mb-2 capitalize" style={{ color: theme.text }}>{monthLabel}</h3>
                        <div className="space-y-2">
                           {monthGroups[key].map(order => {
                            const items = parseItems(order.items)

                            return (
                              <div
                                key={order.id}
                                className="rounded-xl overflow-hidden border"
                                style={{ backgroundColor: theme.bgCard, borderColor: theme.borderCard }}
                              >
                                <div className="p-3">
                                  {/* Line 1: #number + pts + Dia X */}
                                  <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-bold" style={{ color: theme.text }}>
                                        #{order.orderNumber || order.id.slice(0, 8)}
                                      </span>
                                      {calcPoints(order.total) > 0 && (
                                        <span className="text-[10px] font-bold" style={{ color: theme.success }}>
                                          +{calcPoints(order.total)} pts
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold" style={{ color: theme.text }}>{formatCurrency(order.total)}</span>
                                      <span className="text-[10px]" style={{ color: theme.textMutedMore }}>
                                        Dia {order.createdAt ? new Date(order.createdAt).getDate() : "—"}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Items list */}
                                  <div className="space-y-1.5">
                                    {items.map((item: any, idx: number) => (
                                      <div key={idx} className="flex items-center gap-2.5">
                                        {item.image ? (
                                          <img src={item.image} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                                        ) : (
                                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ backgroundColor: `${theme.primary}15`, color: theme.primary }}>
                                            {item.name?.charAt(0) || "#"}
                                          </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-semibold truncate" style={{ color: theme.text }}>
                                            {item.quantity}x {item.name}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Pedir novamente */}
                                  <div className="flex justify-end mt-2">
                                    <button
                                      onClick={() => onReorder(order)}
                                      className="flex items-center gap-0.5 text-xs font-semibold"
                                      style={{ color: theme.primary }}
                                    >
                                      Pedir novamente <ChevronRight className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()
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
