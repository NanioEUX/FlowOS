"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { X, ChevronRight, MessageCircle, Phone, Send, Loader2, Package, Clock, CheckCircle2, Bike, ShoppingBag, Store, RefreshCw } from "lucide-react"
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
  const [chatOpen, setChatOpen] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState("")
  const [chatSending, setChatSending] = useState(false)
  const [messages, setMessages] = useState<Record<string, OrderMessage[]>>({})
  const chatEndRef = useRef<HTMLDivElement>(null)

  const activeOrders = orders.filter(o => ["pending", "payment_pending", "confirmed", "preparing", "ready", "out_for_delivery"].includes(o.status))
  const historyOrders = orders.filter(o => ["delivered", "cancelled", "abandoned"].includes(o.status) || (o.status === "pending" && o.paymentStatus === "expired"))

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

  const activeTimelineSteps = [
    { key: "confirmed", label: "Confirmado" },
    { key: "preparing", label: "Preparando" },
    { key: "ready", label: "Pronto" },
    { key: "out_for_delivery", label: "Saiu" },
  ]

  function getTimelineIdx(order: Order) {
    const statusOrder = ["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered"]
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
          <button
            onClick={() => setActiveTab("active")}
            className="flex-1 py-2.5 text-sm font-semibold text-center relative"
            style={{ color: activeTab === "active" ? theme.primary : theme.textMutedMore }}
          >
            Em Andamento {activeOrders.length > 0 && <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: theme.primary }}>{activeOrders.length}</span>}
            {activeTab === "active" && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: theme.primary }} />}
          </button>
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
                        {/* Header: Pedido # + Código + Preço */}
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold" style={{ color: theme.text }}>
                              Pedido #{order.orderNumber || order.id.slice(0, 8)}
                            </span>
                            {deliveryCode && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: `${theme.primary}12`, color: theme.primary }}>
                                Código {deliveryCode}
                              </span>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold" style={{ color: theme.primary }}>{formatCurrency(order.total)}</p>
                          </div>
                        </div>

                        {/* Previsão */}
                        {elapsed && (
                          <p className="text-xs mb-2" style={{ color: theme.success }}>
                            Chega em {elapsed}
                          </p>
                        )}

                        {/* Timeline — 4 steps: Confirmado, Preparando, Pronto, Saiu */}
                        <div className="flex items-center gap-0 my-3">
                          {activeTimelineSteps.map((step, i) => {
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
                                <span className="text-[8px] mt-1 text-center leading-tight" style={{ color: isDone ? theme.text : theme.textMutedMore }}>
                                  {step.label}
                                </span>
                              </div>
                            )
                          })}
                        </div>

                        {/* Items */}
                        <div className="mb-3">
                          {items.slice(0, 2).map((item, idx) => (
                            <p key={idx} className="text-xs truncate" style={{ color: theme.text }}>
                              {item.quantity}x {item.name}
                            </p>
                          ))}
                          {items.length > 2 && (
                            <p className="text-[11px]" style={{ color: theme.textMutedMore }}>+{items.length - 2} mais</p>
                          )}
                          {!isExpanded && items.length <= 2 && (
                            <button
                              onClick={() => setExpandedOrder(order.id)}
                              className="text-[11px] mt-0.5 flex items-center gap-0.5"
                              style={{ color: theme.textMutedMore }}
                            >
                              <ChevronRight className="h-3 w-3" /> Ver detalhes
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
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs" style={{ color: theme.textMutedMore }}>Total pago</span>
                          <div className="text-right">
                            <span className="text-sm font-bold" style={{ color: theme.text }}>{formatCurrency(order.total)}</span>
                            {order.paymentMethod && (
                              <span className="text-[10px] ml-1" style={{ color: theme.textMutedMore }}>
                                {paymentLabels[order.paymentMethod] || order.paymentMethod}
                              </span>
                            )}
                          </div>
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
                        {["pending", "confirmed", "preparing"].includes(order.status) && (
                          <button
                            onClick={() => {
                              const msg = order.status === "pending" ? "Deseja cancelar este pedido?" : "Tem certeza? O pedido já foi confirmado."
                              if (window.confirm(msg)) {
                                fetch(`/api/orders/${order.id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ status: "cancelled", cancelledBy: "customer" }),
                                }).then(() => window.location.reload())
                              }
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
                          {order.establishment?.logo ? (
                            <img src={order.establishment.logo} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold shrink-0" style={{ backgroundColor: `${theme.primary}15`, color: theme.primary }}>
                              {order.establishment?.name?.charAt(0) || "#"}
                            </div>
                          )}
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
                            <p className="text-xs mt-1.5 truncate" style={{ color: theme.textMuted }}>
                              {items.map((i: any) => i.name).join(" + ")}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <p className="text-sm font-bold" style={{ color: theme.primary }}>{formatCurrency(order.total)}</p>
                              <button
                                onClick={() => onReorder(order)}
                                className="flex items-center gap-1 text-xs font-semibold"
                                style={{ color: theme.primary }}
                              >
                                Pedir novamente <ChevronRight className="h-3.5 w-3.5" />
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
    </div>
  )
}
