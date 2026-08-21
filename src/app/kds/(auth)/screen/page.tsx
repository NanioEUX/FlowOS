"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2, LogOut, Volume2, VolumeX, Clock, ChefHat, Globe, ShoppingBag, Armchair, AlertTriangle } from "lucide-react"

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
}

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  new: { label: "Novo", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/40" },
  pending: { label: "Pendente", color: "text-blue-300", bg: "bg-blue-400/10", border: "border-blue-400/40" },
  confirmed: { label: "Confirmado", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/40" },
  preparing: { label: "Preparando", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/40" },
  ready: { label: "Pronto", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/40" },
}

const statusOrder = ["new", "pending", "confirmed", "preparing", "ready"]

type FilterOrigin = "all" | "mesas" | "online"

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

  const fetchOrders = useCallback(async () => {
    const token = localStorage.getItem("kds_token")
    const est = localStorage.getItem("kds_establishment")
    if (!token || !est) { router.push("/kds"); return }

    const estData = JSON.parse(est)
    setEstablishment(estData)

    try {
      const res = await fetch(`/api/orders?establishmentId=${estData.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()

      if (res.ok) {
        const all = data.orders || data || []
        const filtered = all.filter((o: Order) => ["new", "pending", "confirmed", "preparing", "ready"].includes(o.status))
        filtered.sort((a: Order, b: Order) => {
          const ai = statusOrder.indexOf(a.status), bi = statusOrder.indexOf(b.status)
          if (ai !== bi) return ai - bi
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        })

        if (filtered.length > lastCountRef.current && lastCountRef.current > 0 && soundEnabled) {
          playBeep()
        }
        lastCountRef.current = filtered.length
        setOrders(filtered)
      }
    } catch (err) {
      console.error("[KDS] Fetch error:", err)
    } finally {
      setLoading(false)
    }
  }, [router, soundEnabled])

  function playBeep() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 800
      osc.type = "sine"
      gain.gain.value = 0.3
      osc.start()
      osc.stop(ctx.currentTime + 0.3)
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
    localStorage.removeItem("kds_user")
    localStorage.removeItem("kds_establishment")
    router.push("/kds")
  }

  function getOrigin(order: Order): "mesa" | "online" {
    if (order.tableNumber || order.waiterName) return "mesa"
    return "online"
  }

  function getOriginIcon(order: Order) {
    if (order.tableNumber) return <Armchair className="w-4 h-4" />
    if (order.orderType === "pickup") return <ShoppingBag className="w-4 h-4" />
    return <Globe className="w-4 h-4" />
  }

  function getOriginLabel(order: Order): string {
    if (order.tableNumber) return `SALAO - MESA ${order.tableNumber}`
    if (order.orderType === "pickup") return "ONLINE - RETIRADA"
    return "ONLINE - DELIVERY"
  }

  function getOrderTitle(order: Order): string {
    if (order.tableNumber) return `M${order.tableNumber}`
    return order.customer?.name || "Pedido"
  }

  function isOverdue(dateStr: string): boolean {
    return (Date.now() - new Date(dateStr).getTime()) > 15 * 60 * 1000
  }

  function getNextAction(status: string): { label: string; next: string } | null {
    const map: Record<string, { label: string; next: string }> = {
      new: { label: "Aceitar Pedido", next: "confirmed" },
      pending: { label: "Aceitar Pedido", next: "confirmed" },
      confirmed: { label: "Iniciar Preparo", next: "preparing" },
      preparing: { label: "Concluir Pedido", next: "ready" },
    }
    return map[status] || null
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
        t[o.id] = `${min}m ${sec.toString().padStart(2, "0")}s`
      })
      setTimers(t)
    }, 1000)
    return () => clearInterval(timerInterval)
  }, [orders])

  const filteredOrders = orders.filter(o => {
    if (filter === "all") return true
    if (filter === "mesas") return getOrigin(o) === "mesa"
    if (filter === "online") return getOrigin(o) === "online"
    return true
  })

  const avgTime = orders.length > 0
    ? Math.round(orders.reduce((acc, o) => acc + (Date.now() - new Date(o.createdAt).getTime()), 0) / orders.length / 60000)
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
          <h1 className="font-bold text-xl text-amber-200 font-serif">{establishment?.name || "Cozinha"}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-zinc-400 text-sm">Modo Serviço: Ativo</span>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2">Filtrar por Origem</p>
          <div className="flex gap-1">
            {([
              { value: "all" as FilterOrigin, label: "Todos" },
              { value: "mesas" as FilterOrigin, label: "Mesas" },
              { value: "online" as FilterOrigin, label: "Online" },
            ]).map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f.value
                    ? "bg-amber-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
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
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-[#111] border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold">Painel Cozinha</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-zinc-800/50 px-3 py-1.5 rounded-lg">
              <ChefHat className="w-4 h-4 text-amber-400" />
              <span className="text-sm">Total Pedidos: <strong>{filteredOrders.length}</strong></span>
            </div>
            <div className="flex items-center gap-2 bg-zinc-800/50 px-3 py-1.5 rounded-lg">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-sm">Tempo Médio: <strong>{avgTime}m</strong></span>
            </div>
            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-lg hover:bg-zinc-800">
              {soundEnabled ? <Volume2 className="w-5 h-5 text-zinc-400" /> : <VolumeX className="w-5 h-5 text-zinc-600" />}
            </button>
          </div>
        </header>

        {/* Orders Grid */}
        <main className="flex-1 p-6 overflow-auto">
          {filteredOrders.length === 0 ? (
            <div className="text-center text-zinc-500 mt-20">
              <ChefHat className="w-16 h-16 mx-auto mb-4 text-zinc-700" />
              <p className="text-lg">Nenhum pedido</p>
              <p className="text-sm mt-1">Aguardando novos pedidos...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredOrders.map((order) => {
                const config = statusConfig[order.status] || statusConfig.new
                const overdue = isOverdue(order.createdAt)
                const items = typeof order.items === "string" ? JSON.parse(order.items) : order.items
                const orderCompleted = completedItems[order.id] || {}
                const nextAction = getNextAction(order.status)
                const title = getOrderTitle(order)

                return (
                  <div
                    key={order.id}
                    className={`rounded-xl border-2 ${config.bg} ${config.border} flex flex-col transition-all`}
                  >
                    {/* Card Header */}
                    <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-800/30">
                      <div className="flex items-center gap-2">
                        {getOriginIcon(order)}
                        <span className="font-bold text-lg">{title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${overdue ? "text-red-400" : "text-zinc-400"}`}>
                          {timers[order.id] || "0m 00s"}
                        </span>
                        {overdue && <AlertTriangle className="w-4 h-4 text-red-400" />}
                      </div>
                    </div>

                    {/* Origin Label */}
                    <div className="px-4 pt-2">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                        {getOriginLabel(order)}
                      </span>
                    </div>

                    {/* Items */}
                    <div className="px-4 py-2 flex-1">
                      {items?.map((item: any, i: number) => {
                        const done = orderCompleted[i]
                        return (
                          <div key={i} className="py-1.5 border-b border-zinc-800/20 last:border-0">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleItem(order.id, i)}
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                                  done
                                    ? "bg-green-500 border-green-500"
                                    : "border-zinc-600 hover:border-zinc-400"
                                }`}
                              >
                                {done && <span className="text-white text-xs">✓</span>}
                              </button>
                              <span className={`text-sm font-medium ${done ? "line-through text-zinc-500" : "text-white"}`}>
                                {item.quantity}x {item.name}
                              </span>
                            </div>
                            {item.notes && (
                              <p className="text-amber-400/80 text-xs ml-7 mt-0.5">{item.notes}</p>
                            )}
                          </div>
                        )
                      })}

                      {order.notes && (
                        <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
                          <p className="text-amber-400 text-xs font-medium">{order.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    {nextAction && (
                      <div className="p-3">
                        <button
                          onClick={() => updateStatus(order.id, nextAction.next)}
                          className="w-full bg-amber-600 hover:bg-amber-500 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
                        >
                          {nextAction.label}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
