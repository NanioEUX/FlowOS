"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { X, ChevronRight, MessageCircle, Phone, Send, Loader2, Package, Clock, CheckCircle2, Bike, ShoppingBag, Store } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface OrderItem {
  name: string
  quantity: number
  price: number
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

const statusIcons: Record<string, string> = {
  pending: "📥",
  payment_pending: "⏳",
  confirmed: "✅",
  preparing: "👨‍🍳",
  ready: "📦",
  out_for_delivery: "🛵",
  delivered: "🎉",
  cancelled: "❌",
  abandoned: "⏰",
}

const flowSteps = ["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered"]

interface OrdersScreenProps {
  theme: Theme
  orders: Order[]
  loading: boolean
  onClose: () => void
  onOpenTracking: (orderId: string, trackingUrl: string) => void
  onReorder: (order: Order) => void
  onOpenIdentify: () => void
  hasPhone: boolean
  establishmentSlug: string
}

export function OrdersScreen({
  theme,
  orders,
  loading,
  onClose,
  onOpenTracking,
  onReorder,
  onOpenIdentify,
  hasPhone,
  establishmentSlug,
}: OrdersScreenProps) {
  const [activeTab, setActiveTab] = useState<"active" | "history">("active")
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [trackingData, setTrackingData] = useState<Record<string, any>>({})
  const [messages, setMessages] = useState<Record<string, OrderMessage[]>>({})
  const [chatOpen, setChatOpen] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState("")
  const [chatSending, setChatSending] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const activeOrders = orders.filter(o => ["pending", "payment_pending", "confirmed", "preparing", "ready", "out_for_delivery"].includes(o.status))
  const historyOrders = orders.filter(o => ["delivered", "cancelled", "abandoned"].includes(o.status) || (o.status === "pending" && o.paymentStatus === "expired"))

  const fetchTracking = useCallback(async (order: Order) => {
    if (!order.trackingToken || trackingData[order.id]) return
    try {
      const res = await fetch(`/api/tracking/${order.trackingToken}`)
      if (res.ok) {
        const data = await res.json()
        setTrackingData(prev => ({ ...prev, [order.id]: data }))
      }
    } catch {}
  }, [trackingData])

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
    activeOrders.forEach(order => fetchTracking(order))
  }, [activeOrders.length])

  useEffect(() => {
    if (!chatOpen) return
    const order = orders.find(o => o.id === chatOpen)
    if (!order?.trackingToken) return
    fetchMessages(order.id, order.trackingToken)
    const interval = setInterval(() => fetchMessages(order.id, order.trackingToken!), 10000)
    return () => clearInterval(interval)
  }, [chatOpen, orders])

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
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

  function parseItems(items: string | OrderItem[]): OrderItem[] {
    if (typeof items === "string") {
      try { return JSON.parse(items) } catch { return [] }
    }
    return items
  }

  function getTimelineSteps(order: Order) {
    if (order.orderType === "pickup") {
      return flowSteps.filter(s => s !== "out_for_delivery")
    }
    return flowSteps
  }

  function getElapsedMinutes(createdAt: string | Date): number {
    const created = new Date(createdAt).getTime()
    return Math.floor((Date.now() - created) / 60000)
  }

  const paymentLabels: Record<string, string> = {
    online: "Online",
    pix: "PIX",
    card: "Cartão",
    cash: "Dinheiro",
    delivery: "Na entrega",
    pickup: "Na retirada",
    card_delivery: "Cartão na entrega",
    card_pickup: "Cartão na retirada",
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: theme.bgPage }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: theme.borderCard }}>
        <h1 className="text-xl font-bold" style={{ color: theme.text }}>Meus Pedidos</h1>
        <button onClick={onClose} className="p-2 rounded-full hover:opacity-70" style={{ color: theme.textMutedMore }}>
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: theme.borderCard }}>
        <button
          onClick={() => setActiveTab("active")}
          className="flex-1 py-3 text-sm font-semibold text-center transition-colors relative"
          style={{ color: activeTab === "active" ? theme.primary : theme.textMutedMore }}
        >
          Em Andamento
          {activeOrders.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: theme.primary }}>
              {activeOrders.length}
            </span>
          )}
          {activeTab === "active" && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: theme.primary }} />}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className="flex-1 py-3 text-sm font-semibold text-center transition-colors relative"
          style={{ color: activeTab === "history" ? theme.primary : theme.textMutedMore }}
        >
          Histórico
          {activeTab === "history" && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: theme.primary }} />}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!hasPhone ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: theme.textMuted }}>Identifique-se para ver seus pedidos</p>
            <button onClick={onOpenIdentify} className="mt-3 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: theme.primary }}>
              Identificar-se
            </button>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: theme.primary }} />
          </div>
        ) : activeTab === "active" ? (
          activeOrders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-10 w-10 mb-3" style={{ color: theme.textMutedMore }} />
              <p className="text-sm" style={{ color: theme.textMuted }}>Nenhum pedido em andamento</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeOrders.map(order => {
                const items = parseItems(order.items)
                const tracking = trackingData[order.id]
                const steps = getTimelineSteps(order)
                const flowIdx = steps.indexOf(tracking?.status || order.status)
                const isExpanded = expandedOrder === order.id
                const elapsed = getElapsedMinutes(order.createdAt)
                const deliveryCode = order.deliveryCode || tracking?.deliveryCode
                const msgs = messages[order.id] || []
                const unreadCount = msgs.filter(m => m.sender === "establishment" && !m.read).length

                return (
                  <div
                    key={order.id}
                    className="rounded-xl border overflow-hidden"
                    style={{ borderColor: theme.borderCard, backgroundColor: theme.bgCard }}
                  >
                    {/* Order header */}
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold" style={{ color: theme.text }}>
                              Pedido #{order.orderNumber || order.id.slice(0, 8)}
                            </span>
                            {deliveryCode && order.status !== "delivered" && order.status !== "cancelled" && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: `${theme.primary}15`, color: theme.primary }}>
                                Código {deliveryCode}
                              </span>
                            )}
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: theme.textMutedMore }}>
                            {new Date(order.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold" style={{ color: theme.primary }}>{formatCurrency(order.total)}</p>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${theme.primary}12`, color: theme.primary }}>
                            {paymentLabels[order.paymentMethod] || order.paymentMethod}
                          </span>
                        </div>
                      </div>

                      {/* Timeline */}
                      <div className="flex items-center gap-0 mt-3 mb-2">
                        {steps.map((step, i) => {
                          const isCompleted = i <= flowIdx
                          const isCurrent = i === flowIdx
                          return (
                            <div key={step} className="flex-1 flex flex-col items-center relative">
                              {i > 0 && (
                                <div className="absolute top-[7px] right-1/2 w-full h-0.5 -translate-y-px" style={{ backgroundColor: isCompleted ? theme.primary : theme.borderCard }} />
                              )}
                              <div
                                className="relative z-10 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px]"
                                style={isCompleted
                                  ? { backgroundColor: theme.primary, color: "#fff" }
                                  : { backgroundColor: theme.bgPage, border: `2px solid ${theme.borderCard}` }
                                }
                              >
                                {isCompleted && !isCurrent ? "✓" : ""}
                              </div>
                              <span className="text-[9px] mt-1 text-center leading-tight" style={{ color: isCompleted ? theme.text : theme.textMutedMore }}>
                                {step === "pending" ? "Recebido" : step === "confirmed" ? "Confirmado" : step === "preparing" ? "Preparando" : step === "ready" ? "Pronto" : step === "out_for_delivery" ? "Saiu" : "Entregue"}
                              </span>
                            </div>
                          )
                        })}
                      </div>

                      {/* Items preview */}
                      <div className="mt-2 pt-2 border-t" style={{ borderColor: theme.borderSubtle }}>
                        {items.slice(0, 2).map((item, idx) => (
                          <p key={idx} className="text-xs truncate" style={{ color: theme.text }}>
                            {item.quantity}x {item.name}
                          </p>
                        ))}
                        {items.length > 2 && (
                          <p className="text-[11px] mt-0.5" style={{ color: theme.textMutedMore }}>
                            +{items.length - 2} mais item{items.length - 2 > 1 ? "ns" : ""}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                          className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg"
                          style={{ color: theme.primary, backgroundColor: `${theme.primary}10` }}
                        >
                          {isExpanded ? "Menos detalhes" : "Ver detalhes"}
                          <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                        </button>
                        {order.trackingToken && (
                          <button
                            onClick={() => setChatOpen(chatOpen === order.id ? null : order.id)}
                            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg relative"
                            style={{ color: theme.success, backgroundColor: `${theme.success}10` }}
                          >
                            <MessageCircle className="h-3 w-3" />
                            Ajuda
                            {unreadCount > 0 && (
                              <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: "#ef4444" }}>
                                {unreadCount}
                              </span>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t" style={{ borderColor: theme.borderSubtle }}>
                        <div className="pt-3 space-y-1.5">
                          {items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-xs">
                              <span style={{ color: theme.text }}>{item.quantity}x {item.name}</span>
                              <span className="font-medium" style={{ color: theme.text }}>{formatCurrency(item.price * item.quantity)}</span>
                            </div>
                          ))}
                          {order.deliveryFee > 0 && (
                            <div className="flex justify-between text-xs" style={{ color: theme.textMutedMore }}>
                              <span>Taxa de entrega</span>
                              <span>{formatCurrency(order.deliveryFee)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-xs font-bold pt-1 border-t" style={{ borderColor: theme.borderSubtle, color: theme.text }}>
                            <span>Total</span>
                            <span style={{ color: theme.primary }}>{formatCurrency(order.total)}</span>
                          </div>
                          {order.notes && (
                            <p className="text-[11px] italic pt-1" style={{ color: theme.textMutedMore }}>Obs: {order.notes}</p>
                          )}
                          {order.customerAddress && (
                            <p className="text-[11px]" style={{ color: theme.textMutedMore }}>📍 {order.customerAddress}</p>
                          )}
                          {order.deliveryPerson && (
                            <p className="text-[11px]" style={{ color: theme.textMutedMore }}>🛵 {order.deliveryPerson}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Chat */}
                    {chatOpen === order.id && order.trackingToken && (
                      <div className="border-t" style={{ borderColor: theme.borderSubtle }}>
                        <div className="p-3 max-h-48 overflow-y-auto space-y-2" style={{ backgroundColor: theme.bgPage }}>
                          {messages[order.id]?.length === 0 && (
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
            <div className="text-center py-12">
              <Clock className="mx-auto h-10 w-10 mb-3" style={{ color: theme.textMutedMore }} />
              <p className="text-sm" style={{ color: theme.textMuted }}>Nenhum pedido no histórico</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historyOrders.map(order => {
                const items = parseItems(order.items)
                const isDelivered = order.status === "delivered"
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
                      <div className="flex items-start gap-3">
                        {/* Establishment logo */}
                        {order.establishment?.logo ? (
                          <img src={order.establishment.logo} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold shrink-0" style={{ backgroundColor: `${theme.primary}15`, color: theme.primary }}>
                            {order.establishment?.name?.charAt(0) || "#"}
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-bold truncate" style={{ color: theme.text }}>
                                {order.establishment?.name || `Pedido #${order.orderNumber || order.id.slice(0, 8)}`}
                              </p>
                              <p className="text-xs" style={{ color: theme.textMutedMore }}>
                                Pedido #{order.orderNumber || order.id.slice(0, 8)}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{
                                backgroundColor: isDelivered ? `${theme.success}15` : isCancelled ? "rgba(239,68,68,0.1)" : `${theme.primary}12`,
                                color: isDelivered ? theme.success : isCancelled ? "#ef4444" : theme.primary,
                              }}>
                                {isDelivered ? "Entregue" : isCancelled ? "Cancelado" : statusLabels[order.status] || order.status}
                              </span>
                              <p className="text-[11px] mt-1" style={{ color: theme.textMutedMore }}>{timeAgo(order.createdAt)}</p>
                            </div>
                          </div>

                          {/* Items summary */}
                          <p className="text-xs mt-1.5 truncate" style={{ color: theme.textMuted }}>
                            {items.map((i: any) => i.name).join(" + ")}
                          </p>

                          {/* Price + Reorder */}
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-sm font-bold" style={{ color: theme.primary }}>{formatCurrency(order.total)}</p>
                            <button
                              onClick={() => onReorder(order)}
                              className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-80"
                              style={{ color: theme.primary }}
                            >
                              Pedir novamente
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </div>
  )
}
