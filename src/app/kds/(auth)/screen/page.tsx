"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2, LogOut, Clock, ChefHat, Globe, ShoppingBag, Armchair, AlertTriangle, MessageCircle, Send, ChevronDown, ChevronUp, Printer, Tv } from "lucide-react"
import { SoundControl, playKitchenBeep } from "@/components/sound-control"
import { useVisibilityRefresh } from "@/hooks/use-visibility-refresh"
import { printHtmlPopup } from "@/lib/print-html"
import { useToast } from "@/components/toast"
import { parseOrderItems } from "@/lib/items"

interface OrderMessage {
  id: string
  sender: string
  message: string
  read: boolean
  createdAt: string
}

interface Order {
  id: string
  orderNumber: number
  createdAt: string
  status: string
  notes?: string
  items: any
  total?: number
  deliveryFee?: number
  customer?: { name?: string; phone?: string }
  customerName?: string
  customerPhone?: string
  customerAddress?: string
  tableNumber?: string
  waiterName?: string
  method?: string
  orderType?: string
  paymentMethod?: string
  deliveryPerson?: string
  deliveryCode?: string
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
  const { toast } = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") return true
    try {
      const stored = localStorage.getItem("kds_sound")
      if (stored) {
        const parsed = JSON.parse(stored)
        if (typeof parsed.enabled === "boolean") return parsed.enabled
      }
    } catch {}
    // F5D-005: ligado por padrão — kiosk/tablet que abre direto precisa bipar
    return true
  })
  const [soundVolume, setSoundVolume] = useState(() => {
    if (typeof window === "undefined") return 0.7
    try {
      const stored = localStorage.getItem("kds_sound")
      if (stored) {
        const parsed = JSON.parse(stored)
        if (typeof parsed.volume === "number") return parsed.volume
      }
    } catch {}
    return 0.7
  })
  const [establishment, setEstablishment] = useState<any>(null)
  // F5D-010: null = ainda não há baseline (primeira carga não bipa; o primeiro
  // pedido real — inclusive saindo de fila zerada — passa a bipar).
  const lastCountRef = useRef<number | null>(null)
  // F8C-012: timers comparavam o relógio do tablet com o createdAt do servidor —
  // tablet com relógio errado marcava atraso falso ou sumia com atraso real.
  const serverOffsetRef = useRef(0)
  const serverNow = useCallback(() => Date.now() + serverOffsetRef.current, [])
  // F5D-002: JWT expirou no meio do turno → overlay de sessão + polling para.
  const [sessionExpired, setSessionExpired] = useState(false)
  // F5D-003: estado real de conexão (último poll com sucesso).
  const [online, setOnline] = useState(true)
  // F5D-006: pedidos que estavam ativos e ficaram cancelled → aviso vermelho.
  const [cancelledNotices, setCancelledNotices] = useState<{ key: string; title: string; orderNumber?: number; at: number }[]>([])
  const prevActiveIdsRef = useRef<Set<string>>(new Set())
  const [timers, setTimers] = useState<Record<string, string>>({})
  const [completedItems, setCompletedItems] = useState<Record<string, Record<number, boolean>>>({})
  const [filter, setFilter] = useState<FilterOrigin>("all")
  // F8A-002: modo TV — amplia o painel inteiro (zoom) para leitura a 2-3 m
  // F8C-016: estado "Imprimindo..." no botão de impressão do card
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null)
  const [tvMode, setTvMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pedefacil-kds-tv") === "true"
    }
    return false
  })
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

  // F8B-007: renova o access token (24h) com o cookie de refresh (30d).
  // Se nem o refresh funcionar, aí sim a sessão acabou de verdade.
  const refreshKdsToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/auth/kds-refresh", { method: "POST", credentials: "include" })
      if (!res.ok) return null
      const data = await res.json().catch(() => null)
      if (data?.token) {
        localStorage.setItem("kds_token", data.token)
        return data.token as string
      }
      return null
    } catch {
      return null
    }
  }, [])

  // Fetch do KDS: em 401/403 tenta renovar a sessão e repete UMA vez
  const kdsFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = localStorage.getItem("kds_token")
    const headers = { ...(options.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` }
    let res = await fetch(url, { ...options, headers })
    if (res.status === 401 || res.status === 403) {
      const newToken = await refreshKdsToken()
      if (newToken) {
        res = await fetch(url, { ...options, headers: { ...headers, Authorization: `Bearer ${newToken}` } })
      }
    }
    return res
  }, [refreshKdsToken])

  const fetchOrders = useCallback(async () => {
    const token = localStorage.getItem("kds_token")
    if (!token || !estIdRef.current) return

    try {
      // F5A-038: escopo de status + take — o KDS não precisa do histórico
      // inteiro a cada 5s (cancelled entra para o aviso do F5D-006).
      const res = await kdsFetch(
        `/api/orders?establishmentId=${estIdRef.current}&status=new,pending,confirmed,accepted,preparing,ready,cancelled&take=300`
      )

      // F5D-002: 401/403 = sessão JWT expirada → avisar e parar o polling
      if (res.status === 401 || res.status === 403) {
        setSessionExpired(true)
        setOnline(true)
        return
      }

      let data: any = null
      try { data = await res.json() } catch {}

      if (!res.ok) {
        // F5D-003: 5xx/erro do servidor = sem conexão com o back
        setOnline(false)
        return
      }
      setOnline(true)

      // F8C-012: calibra o relógio do KDS com o do servidor (header Date)
      const dateHeader = res.headers.get("date")
      if (dateHeader) {
        const serverTime = new Date(dateHeader).getTime()
        if (!Number.isNaN(serverTime)) serverOffsetRef.current = serverTime - Date.now()
      }

      const all: Order[] = data?.orders || data || []
      const filtered = all.filter((o: Order) => ["new", "pending", "confirmed", "accepted", "preparing", "ready"].includes(o.status))
      filtered.sort((a: Order, b: Order) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

      // F5D-010: bipa quando o total de novos cresce em relação ao baseline
      // (o baseline nulo da primeira carga não bipa; fila zerada → 1 bipa)
      const newCount = filtered.filter((o: Order) => o.status === "new" || o.status === "pending" || o.status === "accepted").length
      if (soundEnabled && lastCountRef.current !== null && newCount > lastCountRef.current) {
        playKitchenBeep(soundVolume, 3)
      }
      lastCountRef.current = newCount

      // F5D-006: pedido que estava na tela e virou cancelled vira aviso vermelho
      const activeIds = new Set(filtered.map((o: Order) => o.id))
      const cancelledNow = all.filter((o: Order) => o.status === "cancelled" && prevActiveIdsRef.current.has(o.id))
      if (cancelledNow.length > 0) {
        if (soundEnabled) playKitchenBeep(soundVolume, 3)
        const at = Date.now()
        setCancelledNotices((prev) => [
          ...prev,
          ...cancelledNow.map((o: Order) => ({
            key: `${o.id}-${at}`,
            title: getOrderTitle(o),
            orderNumber: o.orderNumber,
            at,
          })),
        ])
      }
      prevActiveIdsRef.current = activeIds

      setOrders(filtered)

      // Fetch messages for all orders
      fetchMessages(filtered.map((o: Order) => o.id))
    } catch (err) {
      // F5D-003: falha de rede = offline (o ponto verde passa a refletir isso)
      console.error("[KDS] Fetch error:", err)
      setOnline(false)
    } finally {
      setLoading(false)
    }
  }, [soundEnabled, soundVolume, kdsFetch])

  async function updateStatus(orderId: string, newStatus: string) {
    try {
      const res = await kdsFetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      // F8B-007: antes o 401 era engolido — o card ficava com o status antigo
      if (res.status === 401 || res.status === 403) {
        setSessionExpired(true)
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast(data?.error || "Não foi possível atualizar o pedido", "error")
        return
      }
      fetchOrders()
    } catch (err) {
      console.error("[KDS] Update error:", err)
      toast("Sem conexão com o servidor", "error")
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
    let msgsMap: Record<string, OrderMessage[]> = {}
    // F3A-021: 1 chamada em lote em vez de N (o loop sequencial fazia ~3.600
    // req/h a cada 10-15 pedidos na tela).
    if (orderIds.length > 0) {
      try {
        const res = await kdsFetch(`/api/orders/messages?ids=${orderIds.join(",")}`)
        if (res.ok) {
          msgsMap = await res.json()
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
          playKitchenBeep(soundVolume, 1)
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
      const res = await kdsFetch(`/api/orders/${orderId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: chatInput.trim() }),
      })
      if (res.ok) {
        const msg = await res.json()
        setOrderMessages(prev => ({
          ...prev,
          [orderId]: [...(prev[orderId] || []), msg],
        }))
        setChatInput("")
        markMessagesRead(orderId, token)
      }
    } catch {} finally {
      setSendingMsg(false)
    }
  }

  async function markMessagesRead(orderId: string, token?: string | null) {
    try {
      // F8B-007: usa o mesmo fetch com refresh (o token pode ter expirado)
      await kdsFetch(`/api/orders/${orderId}/messages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      })
      setOrderMessages(prev => ({
        ...prev,
        [orderId]: (prev[orderId] || []).map(m => m.sender === "customer" ? { ...m, read: true } : m),
      }))
    } catch {}
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

  function getOrderTypeLabel(order: Order): string {
    if (order.tableNumber) return "Mesa"
    if (order.method === "ifood") return "iFood"
    if (order.orderType === "delivery") return "Online Entrega"
    if (order.orderType === "pickup") return "Online Retirada"
    if (order.orderType === "dineIn") return "No local"
    if (order.method === "site") return "Online"
    return "Balcão"
  }

  function isOverdue(dateStr: string): boolean {
    return (serverNow() - new Date(dateStr).getTime()) > 15 * 60 * 1000
  }

  function getOrdersForColumn(colStatus: string): Order[] {
    return orders.filter(o => {
      if (colStatus === "new") return o.status === "new" || o.status === "pending" || o.status === "confirmed" || o.status === "accepted"
      return o.status === colStatus
    }).filter(o => {
      if (filter === "all") return true
      if (filter === "mesas") return getOrigin(o) === "mesa"
      if (filter === "online") return getOrigin(o) === "online"
      return true
    })
  }

  function getNextAction(status: string, method?: string): { label: string; next: string } | null {
    // iFood: HOJE — 1 clique direto pra 'preparing'.
    // Cardápio online / balcão / mesa: 2 passos (accepted → preparing).
    if (status === "new" || status === "pending" || status === "confirmed") {
      if (method === "ifood") return { label: "Aceitar e iniciar produção", next: "preparing" }
      return { label: "Aceitar e iniciar produção", next: "accepted" }
    }
    if (status === "accepted") return { label: "Iniciar Preparo", next: "preparing" }
    if (status === "preparing") return { label: "Concluir Pedido", next: "ready" }
    return null
  }

  useEffect(() => {
    if (sessionExpired) return
    // F3C-001: não gasta poll com a aba oculta (KDS escondido em outra aba);
    // ao voltar, atualiza na hora.
    const tick = () => {
      if (!document.hidden) fetchOrders()
    }
    fetchOrders()
    const interval = setInterval(tick, 5000)
    return () => clearInterval(interval)
  }, [fetchOrders, sessionExpired])
  useVisibilityRefresh(fetchOrders, !sessionExpired)

  // F5D-006: o aviso de cancelamento some sozinho após 60s
  useEffect(() => {
    const t = setInterval(() => {
      setCancelledNotices((prev) => prev.filter((n) => serverNow() - n.at < 60000))
    }, 5000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const timerInterval = setInterval(() => {
      const now = serverNow()
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
    ? Math.round(orders.reduce((acc, o) => acc + (serverNow() - new Date(o.createdAt).getTime()), 0) / totalCount / 60000)
    : 0

  if (sessionExpired) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center gap-4 text-white p-6">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <div className="text-center">
          <p className="font-bold text-lg">Sessão expirada</p>
          <p className="text-sm text-zinc-400 mt-1">Entre novamente para continuar acompanhando a cozinha.</p>
        </div>
        <button
          onClick={() => router.push("/kds")}
          className="bg-amber-700 hover:bg-amber-600 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Entrar novamente
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  return (
    <div
      // F8A-002: modo TV amplia tudo (zoom) — leitura a distância
      style={{ zoom: tvMode ? 1.2 : 1 }}
      className="min-h-screen bg-[#1a1a1a] text-white flex"
    >
      {/* Sidebar */}
      <aside className="w-56 lg:w-64 2xl:w-72 bg-[#111] border-r border-zinc-800 flex flex-col p-4 shrink-0">
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
                <span className={`w-2 h-2 rounded-full ${online ? "bg-green-500" : "bg-red-500 animate-pulse"}`} />
                <span className={`text-xs ${online ? "text-zinc-300" : "text-red-400 font-semibold"}`}>
                  {online ? "Modo Serviço: Ativo" : "Sem conexão"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-zinc-300 text-[10px] lg:text-xs uppercase tracking-wider mb-2 font-semibold">Filtrar por Origem</p>
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
          <h2 className="text-lg xl:text-2xl font-bold text-white">Painel Cozinha</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-zinc-800/50 px-3 py-1.5 rounded-lg">
              <ChefHat className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-zinc-200">Total: <strong className="text-white">{totalCount}</strong></span>
            </div>
            <div className="flex items-center gap-2 bg-zinc-800/50 px-3 py-1.5 rounded-lg">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-zinc-200">Média: <strong className="text-white">{avgTime}m</strong></span>
            </div>
            <button
              onClick={() => {
                const next = !tvMode
                setTvMode(next)
                localStorage.setItem("pedefacil-kds-tv", String(next))
              }}
              aria-pressed={tvMode}
              aria-label="Alternar modo TV"
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                tvMode ? "bg-amber-500 text-zinc-900" : "bg-zinc-800/50 text-zinc-200 hover:bg-zinc-700"
              }`}
            >
              <Tv className="w-4 h-4" aria-hidden="true" />
              <span className="hidden xl:inline">Modo TV</span>
            </button>
            <SoundControl
              storageKey="kds_sound"
              defaultEnabled={true}
              defaultVolume={0.7}
              onChange={(enabled, volume) => {
                setSoundEnabled(enabled)
                setSoundVolume(volume)
              }}
            />
          </div>
        </header>

        {/* Kanban Columns */}
        <main className="flex-1 p-4 overflow-y-auto lg:overflow-hidden flex flex-col">
          {/* F5D-006: aviso de cancelamento (card vermelho, some em 60s) */}
          {cancelledNotices.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 shrink-0">
              {cancelledNotices.map((n) => (
                <div
                  key={n.key}
                  className="flex items-center gap-2 bg-red-500/15 border border-red-500/50 text-red-300 rounded-lg px-3 py-2 text-xs font-bold"
                >
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  CANCELADO — {n.title}
                  {n.orderNumber ? <span className="font-mono opacity-80">#{n.orderNumber}</span> : null}
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 min-h-0">
            {columns.map(col => {
              const colOrders = getOrdersForColumn(col.status)

              return (
                <div key={col.status} className="flex flex-col min-h-0">
                  {/* Column Header */}
                  <div className={`flex items-center justify-between px-4 py-2.5 rounded-t-xl ${col.bg} border ${col.border} border-b-0`}>
                    <span className={`font-bold text-sm lg:text-base xl:text-lg ${col.color}`}>{col.label}</span>
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
                        const items = parseOrderItems(order.items)
                        const orderCompleted = completedItems[order.id] || {}
                        const overdue = isOverdue(order.createdAt)
                        const nextAction = getNextAction(order.status, order.method)
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
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-sm lg:text-base xl:text-lg 2xl:text-xl text-white truncate">{getOrderTitle(order)}</span>
                                    <span className="text-[10px] lg:text-xs xl:text-sm text-zinc-400 font-mono">#{order.orderNumber}</span>
                                  </div>
                                  <span className="text-[9px] lg:text-[11px] xl:text-xs text-zinc-400">{getOrderTypeLabel(order)}</span>
                                </div>
                                {order.tableNumber && (
                                  <span className="text-[10px] lg:text-xs xl:text-sm text-zinc-300 bg-zinc-700 px-1.5 py-0.5 rounded">
                                    {order.tableNumber}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {overdue && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                                <button
                                  onClick={() => {
                                    const items = parseOrderItems(order.items)
                                    const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`
                                    const statusLabels: Record<string, string> = { new: "Novo", pending: "Pendente", confirmed: "Confirmado", accepted: "Aceito", preparing: "Preparando", ready: "Pronto", out_for_delivery: "Saiu p/ Entrega", delivered: "Entregue", cancelled: "Cancelado", abandoned: "Pedido expirado" }
                                    const orderTypeLabels: Record<string, string> = { delivery: "Entrega", pickup: "Retirada", presencial: "Presencial", dineIn: "No local" }
                                    const paymentLabels: Record<string, string> = { cash: "Dinheiro", delivery: "Dinheiro (entrega)", pickup: "Dinheiro (retirada)", card_delivery: "Cartão (entrega)", card_pickup: "Cartão (retirada)", pix: "Pix", online: "Online", asaas: "Asaas", inter: "Inter" }
                                    const esc = (v: any) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
                                    const orderRef = esc(order.orderNumber || order.id.slice(0, 8))
                                    const estName = esc(establishment?.name || "Estabelecimento")
                                    const custName = esc(order.customerName || order.customer?.name || "")
                                    const custPhone = esc(order.customerPhone || order.customer?.phone || "")
                                    const html = `
                                      <html><head><title>Pedido #${orderRef}</title>
                                      <style>
                                        @page { margin: 0; }
                                        body { font-family: 'Courier New', monospace; font-size: 12px; padding: 20px; color: #000; }
                                        h1 { font-size: 16px; text-align: center; margin: 0 0 4px; }
                                        h2 { font-size: 14px; text-align: center; margin: 0 0 12px; font-weight: normal; }
                                        .divider { border-top: 1px dashed #000; margin: 8px 0; }
                                        table { width: 100%; border-collapse: collapse; }
                                        td { padding: 2px 0; }
                                        .right { text-align: right; }
                                        .total { font-size: 14px; font-weight: bold; }
                                        .label { color: #555; }
                                        .footer { text-align: center; margin-top: 12px; font-size: 10px; }
                                        .order-number { font-size: 20px; font-weight: bold; text-align: center; margin: 8px 0; }
                                      </style></head><body>
                                        <h1>${estName}</h1>
                                        <h2>--- CUPOM ---</h2>
                                        <div class="order-number">Pedido #${orderRef}</div>
                                        <p>${new Date(order.createdAt).toLocaleString("pt-BR")}</p>
                                        <p>Status: ${esc(statusLabels[order.status] || order.status)}</p>
                                        <div class="divider"></div>
                                        ${custName ? `<p><strong>Cliente:</strong> ${custName}</p>` : ""}
                                        ${custPhone ? `<p><strong>WhatsApp:</strong> ${custPhone}</p>` : ""}
                                        ${order.customerAddress ? `<p><strong>Endereço:</strong> ${esc(order.customerAddress)}</p>` : ""}
                                        ${order.orderType ? `<p><strong>Tipo:</strong> ${esc(orderTypeLabels[order.orderType] || order.orderType)}</p>` : ""}
                                        ${order.tableNumber ? `<p><strong>Mesa:</strong> ${esc(order.tableNumber)}</p>` : ""}
                                        ${order.paymentMethod ? `<p><strong>Pagamento:</strong> ${esc(paymentLabels[order.paymentMethod] || order.paymentMethod)}</p>` : ""}
                                        ${order.deliveryPerson ? `<p><strong>Entregador:</strong> ${esc(order.deliveryPerson)}</p>` : ""}
                                        ${order.deliveryCode ? `<p style="font-size:18px;font-weight:bold;text-align:center;margin:8px 0;">🔑 Código de Entrega: ${esc(order.deliveryCode)}</p>` : ""}
                                        <div class="divider"></div>
                                        <table>
                                          <tr><td><strong>Item</strong></td><td class="right"><strong>Qtd</strong></td></tr>
                                          ${items.map((it: any) => {
                                            const addOns = (it.additionalOptions || []).map((o: any) => `  • ${esc(o.name)}`).join("<br>")
                                            const obs = it.observation ? `<br><em>Obs: ${esc(it.observation)}</em>` : ""
                                            const notes = it.notes ? `<br><em>Nota: ${esc(it.notes)}</em>` : ""
                                            return `<tr><td>${esc(it.name)}${addOns ? `<br>${addOns}` : ""}${obs}${notes}</td><td class="right">${it.quantity}x</td></tr>`
                                          }).join("")}
                                        </table>
                                        ${order.deliveryFee && order.deliveryFee > 0 ? `<p class="right">Taxa entrega: ${fmt(order.deliveryFee)}</p>` : ""}
                                        ${order.total ? `<div class="divider"></div><p class="total right">Total: ${fmt(order.total)}</p>` : ""}
                                        ${order.notes ? `<p><span class="label">Obs:</span> ${esc(order.notes)}</p>` : ""}
                                        <div class="divider"></div>
                                        <p class="footer">Obrigado pela preferência!</p>
                                      </body></html>`
                                    setPrintingOrderId(order.id)
                                    printHtmlPopup(html, {
                                      // F8C-016: aviso honesto quando o pop-up é bloqueado
                                      onStatus: (status) => {
                                        if (status === "blocked") {
                                          setPrintingOrderId(null)
                                          toast("Não foi possível imprimir: o navegador bloqueou o pop-up.", "error")
                                        }
                                        if (status === "closed") setPrintingOrderId(null)
                                      },
                                    })
                                  }}
                                  disabled={printingOrderId === order.id}
                                  aria-label="Imprimir pedido"
                                  className="p-1 rounded hover:bg-zinc-700 transition-colors disabled:opacity-60"
                                  title="Imprimir pedido"
                                >
                                  {printingOrderId === order.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                                  ) : (
                                    <Printer className="w-3.5 h-3.5 text-zinc-400" />
                                  )}
                                </button>
                                <span className={`text-xs lg:text-sm xl:text-base font-mono ${overdue ? "text-red-400" : "text-zinc-300"}`}>
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
                                      aria-pressed={done}
                                      aria-label={done ? `Desmarcar ${item.name}` : `Marcar ${item.name} como pronto`}
                                      // F8A-003: caixa visual de 16px, mas alvo de toque
                                      // de 44px (pseudo-elemento expande o clique).
                                      className={`relative w-4 h-4 mt-0.5 rounded-sm border flex items-center justify-center transition-colors shrink-0 before:absolute before:-inset-3.5 before:content-[''] ${
                                        done
                                          ? "bg-green-500 border-green-500"
                                          : "border-zinc-500 hover:border-zinc-300"
                                      }`}
                                    >
                                      {done && <span className="text-white text-[10px]">✓</span>}
                                    </button>
                                    <div className="min-w-0">
                                      <span className={`text-xs lg:text-sm xl:text-base 2xl:text-lg font-medium ${done ? "line-through text-zinc-400" : "text-white"}`}>
                                        {item.quantity}x {item.name}
                                      </span>
                                      {item.additionalOptions && item.additionalOptions.length > 0 && (
                                        <div className="mt-0.5 ml-1">
                                          <p className={`text-[10px] lg:text-xs xl:text-sm font-medium ${done ? "text-zinc-400" : "text-zinc-300"}`}>Adicionais:</p>
                                          {item.additionalOptions.map((opt: any, oi: number) => (
                                            <p key={oi} className={`text-[10px] lg:text-xs xl:text-sm ml-1 ${done ? "text-zinc-400" : "text-zinc-300"}`}>• {opt.name}</p>
                                          ))}
                                        </div>
                                      )}
                                      {item.notes && (
                                        <p className="text-amber-400 text-[10px] lg:text-xs xl:text-sm mt-0.5">{item.notes}</p>
                                      )}
                                      {item.observation && (
                                        <p className="text-amber-300 text-[10px] lg:text-xs xl:text-sm mt-0.5">Obs: {item.observation}</p>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}

                              {order.notes && (
                                <div className="mt-1.5 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1">
                                  <p className="text-amber-300 text-[10px] lg:text-xs xl:text-sm font-medium">Observação:</p>
                                  <p className="text-amber-300 text-[10px] lg:text-xs xl:text-sm font-medium">{order.notes}</p>
                                </div>
                              )}
                            </div>

                            {/* Message indicator + Chat toggle */}
                            <div className="px-3 pb-1">
                              <button
                                onClick={() => {
                                  const next = isChatOpen ? null : order.id
                                  setExpandedChat(next)
                                  if (next && unreadMsgs.length > 0) markMessagesRead(order.id)
                                }}
                                className={`w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-[10px] lg:text-xs xl:text-sm font-medium transition-colors ${
                                  unreadMsgs.length > 0
                                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                    : msgs.length > 0
                                      ? "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700"
                                      : "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700"
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
                                    <p className="text-zinc-400 text-[10px] lg:text-xs xl:text-sm text-center py-2">Nenhuma mensagem</p>
                                  ) : (
                                    msgs.map(m => (
                                      <div key={m.id} className={`flex ${m.sender === "establishment" ? "justify-end" : "justify-start"}`}>
                                        <div className={`max-w-[85%] rounded-lg px-2 py-1 text-[10px] lg:text-xs xl:text-sm ${
                                          m.sender === "establishment"
                                            ? "bg-green-600/20 text-green-300"
                                            : "bg-zinc-700 text-zinc-200"
                                        }`}>
                                          <p className={`text-[9px] lg:text-[11px] xl:text-xs font-semibold mb-0.5 ${
                                            m.sender === "establishment" ? "text-green-400" : "text-amber-400"
                                          }`}>
                                            {m.sender === "establishment" ? "Estabelecimento" : getOrderTitle(order)}
                                          </p>
                                          <p>{m.message}</p>
                                          <p className="text-[8px] lg:text-[10px] xl:text-xs opacity-50 mt-0.5">
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
                                    className="flex-1 bg-zinc-800 text-white text-[10px] lg:text-xs xl:text-sm rounded px-2 py-1.5 border border-zinc-600 focus:border-green-500 focus:outline-none"
                                  />
                                  <button
                                    onClick={() => sendKdsMessage(order.id)}
                                    disabled={!chatInput.trim() || sendingMsg}
                                    aria-label="Enviar resposta"
                                    // F8A-003: alvo de toque ≥44px
                                    className="min-h-[44px] min-w-[44px] bg-green-600 hover:bg-green-500 disabled:opacity-30 text-white rounded px-2 py-1.5 transition-colors"
                                  >
                                    <Send aria-hidden="true" className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Action */}
                            {nextAction && (
                              <div className="px-3 pb-2.5 pt-1">
                                <button
                                  onClick={() => updateStatus(order.id, nextAction.next)}
                                  // F8A-003: botão de ação com alvo ≥44px
                                  className={`w-full min-h-[44px] text-white font-medium py-2.5 rounded-lg text-xs lg:text-sm xl:text-base transition-colors ${col.btnColor}`}
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
