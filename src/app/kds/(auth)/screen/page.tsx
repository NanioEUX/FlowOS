"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2, LogOut, Volume2, VolumeX, Clock, ChefHat, Globe, ShoppingBag, Armchair, AlertTriangle, MessageCircle, Send, ChevronDown, ChevronUp } from "lucide-react"

interface OrderMessage {
  id: string
  sender: string
  message: string
  read: boolean
  createdAt: string
}

interface Order {
  id: string
  createdAt: string
  status: string
  notes?: string
  items: any
  customer?: { name?: string; phone?: string }
  tableNumber?: string
  waiterName?: string
  method?: string
  orderType?: string
  messages?: OrderMessage[]
}

type FilterOrigin = "all" | "mesas" | "online"

const columns = [
  { status: "new", label: "Novos", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", btnColor: "bg-blue-600 hover:bg-blue-500" },
  { status: "preparing", label: "Preparando", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", btnColor: "bg-yellow-600 hover:bg-yellow-500" },
  { status: "ready", label: "Prontos", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30", btnColor: "bg-green-600 hover:bg-green-500" },
]

export default function KdsScreen() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [establishment, setEstablishment] = useState<any>(null)
  const lastCountRef = useRef(0)
  const [timers, setTimers] = useState<Record<string, string>>({})
  const [completedItems, setCompletedItems] = useState<Record<string, Record<number, boolean>>>({})
  const [filter, setFilter] = useState<FilterOrigin>("all")
  const estIdRef = useRef<string | null>(null)
  const [orderMessages, setOrderMessages] = useState<Record<string, OrderMessage[]>>({})
  const [expandedChat, setExpandedChat] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState("")
  const [sendingMsg, setSendingMsg] = useState(false)
  const lastMsgCountRef = useRef<Record<string, number>>({})
  const chatScrollRef = useRef<HTMLDivElement>(null)

  // Load establishment data from API (including logo)
  useEffect(() => {
    const est = localStorage.getItem("kds_establishment")
    if (!est) { router.push("/kds"); return }
    const estData = JSON.parse(est)
    estIdRef.current = estData.id
    setEstablishment(estData)

    // Fetch full establishment data with logo from API
    fetch(`/api/kds/establishment?establishmentId=${estData.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.name) {
          setEstablishment((prev: any) => ({ ...prev, name: data.name, logo: data.logo }))
        }
      })
      .catch(() => {})
  }, [router])

  const fetchOrders = useCallback(async () => {
    const token = localStorage.getItem("kds_token")
    if (!token || !estIdRef.current) return

    try {
      const res = await fetch(`/api/orders?establishmentId=${estIdRef.current}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()

      if (res.ok) {
        const all = data.orders || data || []
        const filtered = all.filter((o: Order) => ["new", "pending", "confirmed", "preparing", "ready"].includes(o.status))
        filtered.sort((a: Order, b: Order) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

        const newCount = filtered.filter((o: Order) => o.status === "new" || o.status === "pending").length
        if (newCount > lastCountRef.current && lastCountRef.current >= 0 && soundEnabled && lastCountRef.current > 0) {
          playBeep()
        }
        lastCountRef.current = newCount
        setOrders(filtered)

        // Fetch messages for all orders
        fetchMessages(filtered.map((o: Order) => o.id))
      }
    } catch (err) {
      console.error("[KDS] Fetch error:", err)
    } finally {
      setLoading(false)
    }
  }, [soundEnabled])

  function playBeep() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      osc.type = "sine"
      gain.gain.value = 0.3
      osc.start()
      osc.stop(ctx.currentTime + 0.2)
    } catch {}
  }

  async function updateStatus(orderId: string, newStatus: string) {
    const token = localStorage.getItem("kds_token")
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      })
      fetchOrders()
    } catch (err) {
      console.error("[KDS] Update error:", err)
    }
  }

  function toggleItem(orderId: string, itemIndex: number) {
    setCompletedItems(prev => {
      const orderItems = prev[orderId] || {}
      return { ...prev, [orderId]: { ...orderItems, [itemIndex]: !orderItems[itemIndex] } }
    })
  }

  function handleLogout() {
    localStorage.removeItem("kds_token")
    localStorage.removeItem("kds_establishment")
    router.push("/kds")
  }

  // Fetch messages for all orders
  async function fetchMessages(orderIds: string[]) {
    const token = localStorage.getItem("kds_token")
    if (!token) return
    const msgsMap: Record<string, OrderMessage[]> = {}
    for (const oid of orderIds) {
      try {
        const res = await fetch(`/api/orders/${oid}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          msgsMap[oid] = await res.json()
        }
      } catch {}
    }
    setOrderMessages(msgsMap)

    // Play sound for new customer messages
    if (soundEnabled) {
      for (const oid of orderIds) {
        const msgs = msgsMap[oid] || []
        const unread = msgs.filter(m => m.sender === "customer" && !m.read)
        const prevCount = lastMsgCountRef.current[oid] || 0
        if (unread.length > prevCount && prevCount >= 0 && lastMsgCountRef.current[oid] !== undefined) {
          playBeep()
        }
        lastMsgCountRef.current[oid] = unread.length
      }
    }
  }

  async function sendKdsMessage(orderId: string) {
    if (!chatInput.trim() || sendingMsg) return
    setSendingMsg(true)
    const token = localStorage.getItem("kds_token")
    try {
      const res = await fetch(`/api/orders/${orderId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: chatInput.trim() }),
      })
      if (res.ok) {
        const msg = await res.json()
        setOrderMessages(prev => ({
          ...prev,
          [orderId]: [...(prev[orderId] || []), msg],
        }))
        setChatInput("")
      }
    } catch {} finally {
      setSendingMsg(false)
    }
  }

  function getOrigin(order: Order): "mesa" | "online" {
    if (order.tableNumber || order.waiterName) return "mesa"
    return "online"
  }

  function getOriginIcon(order: Order) {
    if (order.tableNumber) return <Armchair className="w-3.5 h-3.5" />
    if (order.orderType === "pickup") return <ShoppingBag className="w-3.5 h-3.5" />
    return <Globe className="w-3.5 h-3.5" />
  }

  function getOrderTitle(order: Order): string {
    if (order.tableNumber) return `Mesa ${order.tableNumber}`
    return order.customer?.name || "Pedido"
  }

  function isOverdue(dateStr: string): boolean {
    return (Date.now() - new Date(dateStr).getTime()) > 15 * 60 * 1000
  }

  function getOrdersForColumn(colStatus: string): Order[] {
    return orders.filter(o => {
      if (colStatus === "new") return o.status === "new" || o.status === "pending" || o.status === "confirmed"
      return o.status === colStatus
    }).filter(o => {
      if (filter === "all") return true
      if (filter === "mesas") return getOrigin(o) === "mesa"
      if (filter === "online") return getOrigin(o) === "online"
      return true
    })
  }

  function getNextAction(status: string): { label: string; next: string } | null {
    if (status === "new" || status === "pending" || status === "confirmed") return { label: "Iniciar Preparo", next: "preparing" }
    if (status === "preparing") return { label: "Concluir Pedido", next: "ready" }
    return null
  }

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 5000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  useEffect(() => {
    const timerInterval = setInterval(() => {
      const now = Date.now()
      const t: Record<string, string> = {}
      orders.forEach((o) => {
        const diff = Math.floor((now - new Date(o.createdAt).getTime()) / 1000)
        const min = Math.floor(diff / 60)
        const sec = diff % 60
        t[o.id] = `${min}:${sec.toString().padStart(2, "0")}`
      })
      setTimers(t)
    }, 1000)
    return () => clearInterval(timerInterval)
  }, [orders])

  const totalCount = orders.length
  const avgTime = totalCount > 0
    ? Math.round(orders.reduce((acc, o) => acc + (Date.now() - new Date(o.createdAt).getTime()), 0) / totalCount / 60000)
    : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white flex">
      {/* Sidebar */}
      <aside className="w-56 bg-[#111] border-r border-zinc-800 flex flex-col p-4 shrink-0">
        <div className="mb-6">
          <div className="flex items-start gap-3 mb-1">
            {establishment?.logo ? (
              <img src={establishment.logo} alt="" className="h-16 w-16 rounded-xl object-cover shadow-sm shrink-0" />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-amber-600 flex items-center justify-center shrink-0">
                <ChefHat className="w-8 h-8 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-bold text-lg text-white leading-tight" style={{ fontFamily: "serif" }}>
                {establishment?.name || "Cozinha"}
              </h1>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-zinc-300 text-xs">Modo Serviço: Ativo</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-zinc-300 text-[10px] uppercase tracking-wider mb-2 font-semibold">Filtrar por Origem</p>
          <div className="flex flex-col gap-1">
            {([
              { value: "all" as FilterOrigin, label: "Todos" },
              { value: "mesas" as FilterOrigin, label: "Mesas" },
              { value: "online" as FilterOrigin, label: "Online" },
            ]).map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                  filter === f.value
                    ? "bg-amber-600 text-white"
                    : "bg-zinc-800/50 text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1" />

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-zinc-300 hover:text-white text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-[#111] border-b border-zinc-800 px-6 py-3 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-white">Painel Cozinha</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-zinc-800/50 px-3 py-1.5 rounded-lg">
              <ChefHat className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-zinc-200">Total: <strong className="text-white">{totalCount}</strong></span>
            </div>
            <div className="flex items-center gap-2 bg-zinc-800/50 px-3 py-1.5 rounded-lg">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-zinc-200">Média: <strong className="text-white">{avgTime}m</strong></span>
            </div>
            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-lg hover:bg-zinc-800">
              {soundEnabled ? <Volume2 className="w-5 h-5 text-zinc-300" /> : <VolumeX className="w-5 h-5 text-zinc-600" />}
            </button>
          </div>
        </header>

        {/* Kanban Columns */}
        <main className="flex-1 p-4 overflow-hidden">
          <div className="grid grid-cols-3 gap-4 h-full">
            {columns.map(col => {
              const colOrders = getOrdersForColumn(col.status)

              return (
                <div key={col.status} className="flex flex-col min-h-0">
                  {/* Column Header */}
                  <div className={`flex items-center justify-between px-4 py-2.5 rounded-t-xl ${col.bg} border ${col.border} border-b-0`}>
                    <span className={`font-bold text-sm ${col.color}`}>{col.label}</span>
                    <span className={`text-xs font-bold ${col.color} bg-white/10 px-2 py-0.5 rounded-full`}>
                      {colOrders.length}
                    </span>
                  </div>

                  {/* Column Body */}
                  <div className={`flex-1 overflow-y-auto rounded-b-xl border ${col.border} border-t-0 ${col.bg} p-2 space-y-2`}>
                    {colOrders.length === 0 ? (
                      <div className="text-center text-zinc-400 text-sm py-8">
                        Nenhum pedido
                      </div>
                    ) : (
                       colOrders.map(order => {
                        const items = typeof order.items === "string" ? JSON.parse(order.items) : order.items
                        const orderCompleted = completedItems[order.id] || {}
                        const overdue = isOverdue(order.createdAt)
                        const nextAction = getNextAction(order.status)
                        const msgs = orderMessages[order.id] || []
                        const unreadMsgs = msgs.filter(m => m.sender === "customer" && !m.read)
                        const isChatOpen = expandedChat === order.id

                        return (
                          <div
                            key={order.id}
                            className="bg-[#1a1a1a] rounded-lg border border-zinc-700 overflow-hidden"
                          >
                            {/* Card Header */}
                            <div className="px-3 py-2 flex items-center justify-between border-b border-zinc-700/50">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`${overdue ? "text-red-400" : "text-zinc-300"}`}>
                                  {getOriginIcon(order)}
                                </span>
                                <span className="font-bold text-sm text-white truncate">{getOrderTitle(order)}</span>
                                {order.tableNumber && (
                                  <span className="text-[10px] text-zinc-300 bg-zinc-700 px-1.5 py-0.5 rounded">
                                    {order.tableNumber}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {overdue && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                                <span className={`text-xs font-mono ${overdue ? "text-red-400" : "text-zinc-300"}`}>
                                  {timers[order.id] || "0:00"}
                                </span>
                              </div>
                            </div>

                            {/* Items */}
                            <div className="px-3 py-1.5">
                              {items?.map((item: any, i: number) => {
                                const done = orderCompleted[i]
                                return (
                                  <div key={i} className="flex items-start gap-2 py-1">
                                    <button
                                      onClick={() => toggleItem(order.id, i)}
                                      className={`w-4 h-4 mt-0.5 rounded-sm border flex items-center justify-center transition-colors shrink-0 ${
                                        done
                                          ? "bg-green-500 border-green-500"
                                          : "border-zinc-500 hover:border-zinc-300"
                                      }`}
                                    >
                                      {done && <span className="text-white text-[10px]">✓</span>}
                                    </button>
                                    <div className="min-w-0">
                                      <span className={`text-xs font-medium ${done ? "line-through text-zinc-500" : "text-white"}`}>
                                        {item.quantity}x {item.name}
                                      </span>
                                      {item.notes && (
                                        <p className="text-amber-400 text-[10px] mt-0.5">{item.notes}</p>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}

                              {order.notes && (
                                <div className="mt-1.5 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1">
                                  <p className="text-amber-300 text-[10px] font-medium">{order.notes}</p>
                                </div>
                              )}
                            </div>

                            {/* Message indicator + Chat toggle */}
                            <div className="px-3 pb-1">
                              <button
                                onClick={() => setExpandedChat(isChatOpen ? null : order.id)}
                                className={`w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors ${
                                  unreadMsgs.length > 0
                                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                    : msgs.length > 0
                                      ? "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700"
                                      : "bg-zinc-700/50 text-zinc-500 hover:bg-zinc-700"
                                }`}
                              >
                                <div className="flex items-center gap-1.5">
                                  <MessageCircle className="w-3 h-3" />
                                  {unreadMsgs.length > 0 ? (
                                    <span className="animate-pulse">{unreadMsgs.length} msg nova{unreadMsgs.length > 1 ? "s" : ""}</span>
                                  ) : msgs.length > 0 ? (
                                    <span>{msgs.length} msg{msgs.length > 1 ? "s" : ""}</span>
                                  ) : (
                                    <span>Chat</span>
                                  )}
                                </div>
                                {isChatOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            </div>

                            {/* Chat panel */}
                            {isChatOpen && (
                              <div className="border-t border-zinc-700">
                                <div ref={chatScrollRef} className="max-h-40 overflow-y-auto px-3 py-2 space-y-1.5">
                                  {msgs.length === 0 ? (
                                    <p className="text-zinc-500 text-[10px] text-center py-2">Nenhuma mensagem</p>
                                  ) : (
                                    msgs.map(m => (
                                      <div key={m.id} className={`flex ${m.sender === "establishment" ? "justify-end" : "justify-start"}`}>
                                        <div className={`max-w-[85%] rounded-lg px-2 py-1 text-[10px] ${
                                          m.sender === "establishment"
                                            ? "bg-green-600/20 text-green-300"
                                            : "bg-zinc-700 text-zinc-200"
                                        }`}>
                                          <p>{m.message}</p>
                                          <p className="text-[8px] opacity-50 mt-0.5">
                                            {new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                          </p>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                                <div className="px-3 pb-2 flex gap-1.5">
                                  <input
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value.slice(0, 500))}
                                    onKeyDown={e => e.key === "Enter" && sendKdsMessage(order.id)}
                                    placeholder="Responder..."
                                    className="flex-1 bg-zinc-800 text-white text-[10px] rounded px-2 py-1.5 border border-zinc-600 focus:border-green-500 focus:outline-none"
                                  />
                                  <button
                                    onClick={() => sendKdsMessage(order.id)}
                                    disabled={!chatInput.trim() || sendingMsg}
                                    className="bg-green-600 hover:bg-green-500 disabled:opacity-30 text-white rounded px-2 py-1.5 transition-colors"
                                  >
                                    <Send className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Action */}
                            {nextAction && (
                              <div className="px-3 pb-2.5 pt-1">
                                <button
                                  onClick={() => updateStatus(order.id, nextAction.next)}
                                  className={`w-full text-white font-medium py-1.5 rounded-lg text-xs transition-colors ${col.btnColor}`}
                                >
                                  {nextAction.label}
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </main>
      </div>
    </div>
  )
}
