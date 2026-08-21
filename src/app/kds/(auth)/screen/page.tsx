"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2, LogOut, Volume2, VolumeX, Clock, ChefHat } from "lucide-react"

interface Order {
  id: string
  createdAt: string
  status: string
  notes?: string
  items: any
  customer?: { name?: string; phone?: string }
  tableNumber?: string
  waiterName?: string
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: "Novo", color: "text-blue-400", bg: "bg-blue-500/20 border-blue-500/30" },
  preparing: { label: "Preparando", color: "text-yellow-400", bg: "bg-yellow-500/20 border-yellow-500/30" },
  ready: { label: "Pronto", color: "text-green-400", bg: "bg-green-500/20 border-green-500/30" },
}

const statusOrder = ["confirmed", "preparing", "ready"]

export default function KdsScreen() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [establishment, setEstablishment] = useState<any>(null)
  const lastCountRef = useRef(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [timers, setTimers] = useState<Record<string, string>>({})

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
        const filtered = all.filter((o: Order) => ["confirmed", "preparing", "ready"].includes(o.status))
        filtered.sort((a: Order, b: Order) => {
          const ai = statusOrder.indexOf(a.status), bi = statusOrder.indexOf(b.status)
          if (ai !== bi) return ai - bi
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        })

        if (filtered.length > lastCountRef.current && lastCountRef.current > 0 && soundEnabled) {
          playSound()
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

  function playSound() {
    try {
      if (!audioRef.current) {
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
      } else {
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(() => {})
      }
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

  function handleLogout() {
    localStorage.removeItem("kds_token")
    localStorage.removeItem("kds_user")
    localStorage.removeItem("kds_establishment")
    router.push("/kds")
  }

  function updateTimers() {
    const now = Date.now()
    const t: Record<string, string> = {}
    orders.forEach((o) => {
      const diff = Math.floor((now - new Date(o.createdAt).getTime()) / 1000)
      const min = Math.floor(diff / 60)
      const sec = diff % 60
      t[o.id] = `${min}:${sec.toString().padStart(2, "0")}`
    })
    setTimers(t)
  }

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 5000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  useEffect(() => {
    const timerInterval = setInterval(updateTimers, 1000)
    return () => clearInterval(timerInterval)
  }, [orders])

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ChefHat className="w-6 h-6 text-orange-500" />
          <div>
            <h1 className="font-bold text-lg">{establishment?.name || "KDS"}</h1>
            <p className="text-zinc-400 text-xs">Painel da Cozinha</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-orange-500/20 text-orange-400 text-sm font-bold px-3 py-1 rounded-full">
            {orders.length} pedido{orders.length !== 1 ? "s" : ""}
          </span>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-lg hover:bg-zinc-800">
            {soundEnabled ? <Volume2 className="w-5 h-5 text-zinc-400" /> : <VolumeX className="w-5 h-5 text-zinc-600" />}
          </button>
          <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-zinc-800">
            <LogOut className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
      </header>

      <main className="p-4">
        {orders.length === 0 ? (
          <div className="text-center text-zinc-500 mt-20">
            <ChefHat className="w-16 h-16 mx-auto mb-4 text-zinc-700" />
            <p className="text-lg">Nenhum pedido ativo</p>
            <p className="text-sm mt-1">Aguardando novos pedidos...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {orders.map((order) => {
              const config = statusConfig[order.status] || statusConfig.confirmed
              const items = typeof order.items === "string" ? JSON.parse(order.items) : order.items
              const nextStatus = order.status === "confirmed" ? "preparing" : order.status === "preparing" ? "ready" : null
              const nextLabel = order.status === "confirmed" ? "Iniciar Preparo" : order.status === "preparing" ? "Marcar Pronto" : null

              return (
                <div key={order.id} className={`rounded-xl border-2 p-4 ${config.bg} transition-all`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-sm font-bold ${config.color}`}>{config.label}</span>
                    <div className="flex items-center gap-1 text-zinc-400 text-xs">
                      <Clock className="w-3 h-3" />
                      {timers[order.id] || "0:00"}
                    </div>
                  </div>

                  <div className="space-y-1 mb-3">
                    {items?.map((item: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-orange-400 font-bold">{item.quantity}x</span>
                        <div>
                          <span className="text-white">{item.name}</span>
                          {item.notes && <p className="text-zinc-500 text-xs">{item.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {order.notes && (
                    <p className="text-zinc-400 text-xs mb-3 italic">Obs: {order.notes}</p>
                  )}

                  {order.tableNumber && (
                    <p className="text-zinc-400 text-xs mb-1">Mesa: {order.tableNumber}</p>
                  )}
                  {order.customer?.name && (
                    <p className="text-zinc-400 text-xs mb-3">{order.customer.name}</p>
                  )}

                  {nextStatus && nextLabel && (
                    <button
                      onClick={() => updateStatus(order.id, nextStatus)}
                      className="w-full mt-2 bg-white/10 hover:bg-white/20 text-white font-medium py-2 rounded-lg text-sm transition-colors"
                    >
                      {nextLabel}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
