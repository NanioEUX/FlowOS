"use client"

import { useEffect, useState, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { ShoppingBag, Search, MessageCircle, ExternalLink, User, Plus, Loader2, X, Bike, Store, CreditCard, Banknote, Printer, Calendar, Package, Send, ChefHat } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import { formatCurrency } from "@/lib/utils"
import { fetchAuth } from "@/lib/fetch-auth"
import { useNewOrderAlerts, ensureNotificationPermission, playNewOrderSound } from "@/lib/use-new-order-alerts"
import { SearchableSelect } from "@/components/searchable-select"

const statusLabels: Record<string, string> = {
  new: "Novo",
  pending: "Pendente",
  payment_pending: "Aguard. Pagamento",
  confirmed: "Confirmado",
  preparing: "Preparando",
  ready: "Pronto",
  out_for_delivery: "Saiu p/ Entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
}

const statusColors: Record<string, "info" | "warning" | "success" | "danger" | "default"> = {
  new: "default",
  pending: "info",
  payment_pending: "danger",
  confirmed: "info",
  preparing: "warning",
  ready: "success",
  out_for_delivery: "info",
  delivered: "success",
  cancelled: "danger",
}

const flowOrder = ["pending", "payment_pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered"]
const selectableStatuses = ["confirmed", "preparing", "ready", "out_for_delivery", "delivered"]

const paymentMethodLabels: Record<string, string> = {
  online: "Online (Pix/Cartão)",
  cash: "Dinheiro (entrega)",
  card: "Cartão (entrega)",
  delivery: "Pagar na Entrega",
  pickup: "Pagar na Retirada",
}

// Legacy paymentMethod values from the cardápio online flow used
// "delivery" / "pickup" / "asaas" / "pix" / "card". Normalize them so the
// dashboard renders consistent badges regardless of source.
// "card_delivery" / "card_pickup" = cartão NA MÁQUINA do estabelecimento
// (Pagar na Entrega/Retirada + Cartão) → normalized to "card".
function normalizePaymentMethod(method: string | null | undefined): string {
  if (!method) return "online"
  const m = method.toLowerCase()
  if (m === "delivery" || m === "pickup") return "cash"
  if (m === "card_delivery" || m === "card_pickup") return "card"
  if (m === "asaas" || m === "inter") return "online"
  return m
}

const orderTypeLabels: Record<string, string> = {
  delivery: "Entrega",
  pickup: "Retirada",
}

export default function PedidosPage() {
  const searchParams = useSearchParams()
  const hookEstablishmentId = useEstablishmentId()
  const searchParamsEstablishmentId = searchParams.get("establishment")
  const establishmentId = searchParamsEstablishmentId || hookEstablishmentId
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [newOrder, setNewOrder] = useState({ customerName: "", customerPhone: "", notes: "" })
  const [deliveryPeople, setDeliveryPeople] = useState<any[]>([])
  const [filterMotoboy, setFilterMotoboy] = useState("")
  const [filterPeriod, setFilterPeriod] = useState("all")
  const [filterType, setFilterType] = useState("all")
  const [filterSource, setFilterSource] = useState("all") // Origem: all | ifood | site | whatsapp | manual
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterCancelledBy, setFilterCancelledBy] = useState("all") // all | customer | merchant | system
  const [filterScheduled, setFilterScheduled] = useState<"all" | "scheduled" | "immediate">("all")
  const [unreadOrders, setUnreadOrders] = useState<Record<string, { count: number; name: string; message: string }>>({})
  const [highlightOrderId, setHighlightOrderId] = useState<string | null>(null)

  async function loadOrders() {
    if (!establishmentId) return

    // Pull fresh orders from iFood in the background before reloading the list.
    // This keeps the dashboard in sync without manual polling.
    try {
      await fetchAuth(`/api/orders/ifood-poll`, { method: "POST" })
    } catch (e) {}

    const res = await fetchAuth(`/api/orders?establishmentId=${establishmentId}`)
    const data = await res.json()
    setOrders(data)
    setLoading(false)

    // Auto-sync pending payments in background
    const pendingPayments = data.filter((o: any) =>
      o.paymentId && o.paymentStatus === "pending" && o.status !== "cancelled"
    )
    if (pendingPayments.length > 0) {
      console.log(`[Orders] Auto-syncing ${pendingPayments.length} pending payments...`)
      fetchAuth(`/api/payments/sync?establishmentId=${establishmentId}`).catch(() => {})
    }
  }

  useEffect(() => { loadOrders(); loadDeliveryPeople() }, [establishmentId])
  useEffect(() => { const i = setInterval(loadOrders, 30000); return () => clearInterval(i) }, [establishmentId])

  // Request browser notification permission once the dashboard loads.
  useEffect(() => {
    ensureNotificationPermission()
  }, [])

  // Sound + desktop notification when a new order arrives.
  useNewOrderAlerts(orders)

  // Periodic payment sync (every 30 seconds for pending payments)
  useEffect(() => {
    if (!establishmentId) return
    const syncInterval = setInterval(() => {
      const pendingPayments = orders.filter((o: any) => 
        o.paymentId && o.paymentStatus === "pending" && o.status !== "cancelled"
      )
      if (pendingPayments.length > 0) {
        console.log(`[Orders] Periodic sync: ${pendingPayments.length} pending payments`)
        fetchAuth(`/api/payments/sync?establishmentId=${establishmentId}`).catch(() => {})
      }
    }, 30000)
    return () => clearInterval(syncInterval)
  }, [establishmentId, orders])

  async function updateStatus(orderId: string, status: string) {
    await fetchAuth(`/api/orders/${orderId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })
    loadOrders()
  }

  async function updateDeliveryPerson(orderId: string, deliveryPersonId: string, deliveryPersonName: string) {
    await fetchAuth(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryPersonId, deliveryPersonName }),
    })
    loadOrders()
  }

  async function loadDeliveryPeople() {
    if (!establishmentId) return
    const res = await fetchAuth(`/api/delivery-persons?establishmentId=${establishmentId}`)
    if (res.ok) setDeliveryPeople(await res.json())
  }

  async function createWhatsAppOrder() {
    if (!establishmentId || !newOrder.customerName) return
    await fetchAuth("/api/orders/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newOrder, establishmentId, items: [], total: 0 }),
    })
    setNewOrder({ customerName: "", customerPhone: "", notes: "" })
    setShowNewOrder(false)
    loadOrders()
  }

  const filtered = orders.filter((o) => {
    const matchesName = (o.customerName || "").toLowerCase().includes(filter.toLowerCase())
    const matchesMotoboy = !filterMotoboy || o.deliveryPersonId === filterMotoboy
    const matchesType = filterType === "all" || o.orderType === filterType
    const matchesSource = filterSource === "all" || o.method === filterSource
    const matchesStatus = filterStatus === "all" || o.status === filterStatus
    const matchesCancelledBy = filterCancelledBy === "all" || o.cancelledBy === filterCancelledBy
    const matchesScheduled =
      filterScheduled === "all" ||
      (filterScheduled === "scheduled" && o.isScheduled) ||
      (filterScheduled === "immediate" && !o.isScheduled)
    const d = new Date(o.createdAt)
    const now = new Date()
    let matchesPeriod = true
    if (filterPeriod === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      matchesPeriod = d >= start
    } else if (filterPeriod === "7days") {
      const start = new Date(now.getTime() - 7 * 86400000)
      matchesPeriod = d >= start
    } else if (filterPeriod === "30days") {
      const start = new Date(now.getTime() - 30 * 86400000)
      matchesPeriod = d >= start
    }
    return matchesName && matchesMotoboy && matchesType && matchesSource && matchesPeriod && matchesStatus && matchesCancelledBy && matchesScheduled
  })

  function groupOrders(list: any[]) {
    // Kitchen/operator dashboard only shows orders that haven't left yet.
    // Once an order goes to delivery it moves to the Entregas tab; once it
    // is delivered it goes to history.
    const groups: Record<string, typeof list> = { active: [], completed: [], cancelled: [] }
    list.forEach((o) => {
      if (o.status === "cancelled") groups.cancelled.push(o)
      else if (o.status === "delivered") groups.completed.push(o)
      else if (o.status === "out_for_delivery" || o.status === "dispatched") {
        // Delivery is happening; show under "completed" so it stays in the page
        // but visually separated from pending work. The motoboy screen handles
        // its own status updates.
        groups.completed.push(o)
      }
      else groups.active.push(o)
    })
    // Pedidos agendados: ordem por deliveryDate ascendente (próximos primeiro)
    groups.active.sort((a, b) => {
      if (a.isScheduled && b.isScheduled) {
        return new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime()
      }
      if (a.isScheduled) return -1
      if (b.isScheduled) return 1
      return 0
    })
    return groups
  }

  const grouped = groupOrders(filtered)

  function handleUnreadUpdate(orderId: string, count: number, name: string, message: string) {
    setUnreadOrders((prev) => {
      if (count === 0) {
        const next = { ...prev }
        delete next[orderId]
        return next
      }
      return { ...prev, [orderId]: { count, name, message } }
    })
  }

  function scrollToOrder(orderId: string) {
    const el = document.getElementById(`order-${orderId}`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      setHighlightOrderId(orderId)
      setTimeout(() => setHighlightOrderId(null), 3000)
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-900">Pedidos</h2>
        <button
          onClick={() => {
            const user = JSON.parse(localStorage.getItem("pedefacil-user") || "{}")
            if (user.establishmentId) {
              localStorage.setItem("kds_token", user.token)
              localStorage.setItem("kds_user", JSON.stringify(user))
              localStorage.setItem("kds_establishment", JSON.stringify(user.establishment))
              window.open("/kds/screen", "_blank")
            }
          }}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <ChefHat className="w-4 h-4" />
          Cozinha (KDS)
        </button>
      </div>

      {/* Motoboy summary removido — gestão de motoboys fica no módulo /entregas */}

      {/* Filters: Origem + Tipo (dropdowns) + Período (pills) + Status (pills with counts) */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600">Origem:</span>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 focus:border-green-500 focus:outline-none"
            >
              <option value="all">Todas</option>
              <option value="ifood">iFood</option>
              <option value="site">Online</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="manual">Local</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600">Tipo:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 focus:border-green-500 focus:outline-none"
            >
              <option value="all">Todos</option>
              <option value="delivery">Entrega</option>
              <option value="pickup">Retirada</option>
              <option value="presencial">Mesas</option>
              <option value="balcao">Balcão</option>
            </select>
          </div>
          <div className="flex items-center rounded-lg bg-zinc-100 p-0.5 border border-zinc-200/60">
            {[
              { value: "all", label: "Todos" },
              { value: "today", label: "Hoje" },
              { value: "7days", label: "7 dias" },
              { value: "30days", label: "30 dias" },
            ].map((p) => (
              <button key={p.value} onClick={() => setFilterPeriod(p.value)} className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${filterPeriod === p.value ? "bg-white text-zinc-800 shadow-sm font-semibold" : "text-zinc-500 hover:text-zinc-800"}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-600">Status:</span>
          {[
            { value: "all", label: "Todos" },
            { value: "pending", label: "Novos" },
            { value: "preparing", label: "Preparando" },
            { value: "ready", label: "Prontos" },
            { value: "out_for_delivery", label: "Saiu p/ entrega" },
            { value: "delivered", label: "Entregue" },
            { value: "cancelled", label: "Cancelado" },
          ].map((s) => {
            const count =
              s.value === "all"
                ? filtered.length
                : filtered.filter((o) => o.status === s.value).length
            const active = filterStatus === s.value
            return (
              <button
                key={s.value}
                onClick={() => setFilterStatus(s.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "bg-green-600 text-white shadow-sm"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                {s.label} <span className={`ml-1 font-semibold ${active ? "text-white" : "text-zinc-500"}`}>({count})</span>
              </button>
            )
          })}
        </div>
        {filterStatus === "cancelled" && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs font-medium text-zinc-600">Cancelado por:</span>
            {[
              { value: "all", label: "Todos" },
              { value: "customer", label: "Cliente" },
              { value: "merchant", label: "Estabelecimento" },
              { value: "system", label: "Sistema" },
            ].map((c) => {
              const active = filterCancelledBy === c.value
              return (
                <button
                  key={c.value}
                  onClick={() => setFilterCancelledBy(c.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "bg-red-600 text-white shadow-sm"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="text-xs font-medium text-zinc-600">Agendamento:</span>
          {[
            { value: "all", label: "Todos" },
            { value: "scheduled", label: "📅 Agendados" },
            { value: "immediate", label: "⚡ Imediatos" },
          ].map((s) => {
            const active = filterScheduled === s.value
            return (
              <button
                key={s.value}
                onClick={() => setFilterScheduled(s.value as any)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Global message notification bar */}
      {Object.keys(unreadOrders).length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
          <p className="mb-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">Mensagens não lidas</p>
          <div className="space-y-1.5">
            {Object.entries(unreadOrders).map(([orderId, data]) => (
              <button
                key={orderId}
                onClick={() => scrollToOrder(orderId)}
                className="flex w-full items-center gap-3 rounded-lg bg-white border border-amber-500/20 px-3 py-2 text-left hover:bg-amber-500/10 transition-colors"
              >
                <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500/100" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900">{data.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{data.message}</p>
                </div>
                <span className="flex-shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-400">
                  {data.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[.08] p-12 text-center">
          <ShoppingBag className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-2 text-sm text-zinc-500">Nenhum pedido ainda</p>
        </div>
      ) : (
        <>
          {grouped.active.length > 0 && <OrderSection title="Em Andamento" orders={grouped.active} onUpdateStatus={updateStatus} onUpdateDelivery={updateDeliveryPerson} deliveryPeople={deliveryPeople} onUnreadUpdate={handleUnreadUpdate} highlightOrderId={highlightOrderId} />}
          {grouped.completed.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-400 hover:text-zinc-400">Entregues ({grouped.completed.length})</summary>
              <div className="mt-3 space-y-3"><OrderSection title="" orders={grouped.completed} onUpdateStatus={updateStatus} onUpdateDelivery={updateDeliveryPerson} deliveryPeople={deliveryPeople} onUnreadUpdate={handleUnreadUpdate} highlightOrderId={highlightOrderId} /></div>
            </details>
          )}
          {grouped.cancelled.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-semibold text-red-400 hover:text-red-400">Cancelados ({grouped.cancelled.length})</summary>
              <div className="mt-3 space-y-3"><OrderSection title="" orders={grouped.cancelled} onUpdateStatus={updateStatus} onUpdateDelivery={updateDeliveryPerson} deliveryPeople={deliveryPeople} onUnreadUpdate={handleUnreadUpdate} highlightOrderId={highlightOrderId} /></div>
            </details>
          )}
        </>
      )}

      {/* New WhatsApp Order Modal */}
      {showNewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-green-600" />
                  Pedido via WhatsApp
                </h3>
                <button onClick={() => setShowNewOrder(false)}><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Nome do cliente</label>
                  <input
                    type="text"
                    placeholder="Ex: João"
                    value={newOrder.customerName}
                    onChange={(e) => setNewOrder({ ...newOrder, customerName: e.target.value })}
                    className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">WhatsApp do cliente</label>
                  <input
                    type="text"
                    placeholder="11999999999"
                    value={newOrder.customerPhone}
                    onChange={(e) => setNewOrder({ ...newOrder, customerPhone: e.target.value })}
                    className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Observações</label>
                  <input
                    type="text"
                    placeholder="Ex: Pedido feito pelo WhatsApp"
                    value={newOrder.notes}
                    onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                    className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
                <p className="text-xs text-zinc-500">Os itens são gerenciados manualmente pelo WhatsApp. Use isso para registrar pedidos que chegaram pelo chat.</p>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowNewOrder(false)}>Cancelar</Button>
                  <Button className="flex-1" onClick={createWhatsAppOrder}>Criar pedido</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function OrderSection({ title, orders, onUpdateStatus, onUpdateDelivery, deliveryPeople, onUnreadUpdate, highlightOrderId }: {
  title: string
  orders: any[]
  onUpdateStatus: (id: string, s: string) => void
  onUpdateDelivery: (id: string, personId: string, personName: string) => void
  deliveryPeople: any[]
  onUnreadUpdate: (orderId: string, count: number, name: string, message: string) => void
  highlightOrderId: string | null
}) {
  return (
    <div>
      {title && <h3 className="mb-3 text-sm font-semibold text-zinc-500 uppercase tracking-wider">{title}</h3>}
      <div className="space-y-3">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} onUpdateStatus={onUpdateStatus} onUpdateDelivery={onUpdateDelivery} deliveryPeople={deliveryPeople} onUnreadUpdate={onUnreadUpdate} highlight={highlightOrderId === order.id} />
        ))}
      </div>
    </div>
  )
}

function OrderCard({ order, onUpdateStatus, onUpdateDelivery, deliveryPeople, onUnreadUpdate, highlight }: { order: any; onUpdateStatus: (id: string, s: string) => void; onUpdateDelivery: (id: string, personId: string, personName: string) => void; deliveryPeople: any[]; onUnreadUpdate: (orderId: string, count: number, name: string, message: string) => void; highlight: boolean }) {
  const items = typeof order.items === "string" ? JSON.parse(order.items) : order.items
  const isPresencial = order.orderType === "presencial"
  const currentIdx = flowOrder.indexOf(order.status)
  const isNewOrder = ["pending", "payment_pending"].includes(order.status)
  const isIfoodOrder = order.method === "ifood"
  // Online orders that haven't been paid yet block production; cash-on-delivery
  // and paid online orders may proceed straight to preparation.
  const isOnlinePaymentPending =
    normalizePaymentMethod(order.paymentMethod) === "online" && order.paymentStatus !== "paid"

  let nextStatus: string | null
  if (isOnlinePaymentPending) {
    nextStatus = null
  } else if (isNewOrder) {
    // iFood + cash orders jump pending -> preparing in one click ("accept + start").
    nextStatus = "preparing"
  } else if (order.status === "confirmed") {
    // Online payment confirmed by Asaas/Inter: ready to start preparation.
    nextStatus = "preparing"
  } else if (isPresencial && order.status === "ready") {
    nextStatus = "delivered"
  } else if (isPresencial && order.status === "preparing") {
    nextStatus = "ready"
  } else if (order.status === "dispatched") {
    // Legacy "dispatched" orders still need a way forward; jump straight to delivered.
    nextStatus = "delivered"
  } else if (!isPresencial && currentIdx >= 0 && currentIdx < flowOrder.length - 1) {
    nextStatus = flowOrder[currentIdx + 1]
  } else {
    nextStatus = null
  }

  const isLocked = isPresencial
    ? ["delivered", "cancelled"].includes(order.status)
    : ["ready", "out_for_delivery", "delivered"].includes(order.status)

  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  async function fetchMessages() {
    try {
      const res = await fetchAuth(`/api/orders/${order.id}/messages?_t=${Date.now()}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data)
      }
    } catch (e) {}
  }

  async function markAsRead() {
    try {
      await fetchAuth(`/api/orders/${order.id}/messages`, { method: "PATCH" })
      setMessages((prev) => prev.map((m) => m.sender === "customer" ? { ...m, read: true } : m))
    } catch (e) {
      console.error("Erro ao marcar como lida:", e)
    }
  }

  useEffect(() => {
    fetchMessages()
    const i = setInterval(fetchMessages, 30000)
    return () => clearInterval(i)
  }, [order.id])

  useEffect(() => {
    if (chatOpen) {
      markAsRead()
    }
  }, [chatOpen, order.id])

  useEffect(() => {
    if (chatOpen && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, chatOpen])

  async function sendMessage() {
    if (!newMessage.trim() || sending) return
    setSending(true)
    try {
      const res = await fetchAuth(`/api/orders/${order.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newMessage.trim() }),
      })
      if (res.ok) {
        const msg = await res.json()
        setMessages((prev) => [...prev, msg])
        setNewMessage("")
      }
    } catch {} finally {
      setSending(false)
    }
  }

  const unreadCount = messages.filter((m) => m.sender === "customer" && !m.read).length
  const lastCustomerMsg = [...messages].reverse().find((m) => m.sender === "customer")

  useEffect(() => {
    onUnreadUpdate(order.id, unreadCount, order.customerName, lastCustomerMsg?.message || "")
  }, [unreadCount, order.id, order.customerName, lastCustomerMsg?.message])

  const nextLabel: Record<string, string> = {
    pending: isOnlinePaymentPending
      ? "Aguardando pagamento"
      : "Aceitar e iniciar produção",
    payment_pending: isOnlinePaymentPending ? "Aguardando pagamento" : "Aceitar e iniciar produção",
    confirmed: "Aceitar e iniciar produção",
    preparing: "Finalizar preparo",
    ready: isPresencial ? "Entregar no balcão" : "Sair p/ entrega",
    out_for_delivery: "Entregar",
  }

  function printReceipt() {
    const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`
    const win = window.open("", "_blank")
    if (!win) return
    win.document.write(`
      <html>
      <head>
        <title>Pedido #${order.orderNumber || order.id.slice(0, 8)}</title>
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
    </style>
  </head>
  <body>
    <h1>${order.establishment?.name || order.establishmentName || "Estabelecimento"}</h1>
    <h2>--- CUPOM ---</h2>
    <div class="order-number">Pedido #${order.orderNumber || order.id.slice(0, 8)}</div>
    <p>${new Date(order.createdAt).toLocaleString("pt-BR")}</p>
    <p>Status: ${statusLabels[order.status] || order.status}</p>
    <div class="divider"></div>
    <p><strong>Cliente:</strong> ${order.customerName}</p>
    ${order.customerPhone ? `<p><strong>WhatsApp:</strong> ${order.customerPhone}</p>` : ""}
    ${order.customerAddress ? `<p><strong>Endereço:</strong> ${order.customerAddress}</p>` : ""}
    ${order.orderType ? `<p><strong>Tipo:</strong> ${orderTypeLabels[order.orderType] || order.orderType}</p>` : ""}
    ${order.paymentMethod ? `<p><strong>Pagamento:</strong> ${paymentMethodLabels[normalizePaymentMethod(order.paymentMethod)] || order.paymentMethod}</p>` : ""}
    ${order.deliveryPerson ? `<p><strong>Entregador:</strong> ${order.deliveryPerson}</p>` : ""}
    <div class="divider"></div>
    <table>
      <tr><td><strong>Item</strong></td><td class="right"><strong>Qtd</strong></td><td class="right"><strong>Valor</strong></td></tr>
      ${items.map((item: any) => `<tr><td>${item.name}</td><td class="right">${item.quantity}x</td><td class="right">${fmt(item.price * item.quantity)}</td></tr>`).join("")}
    </table>
    ${order.deliveryFee > 0 ? `<p class="right">Taxa entrega: ${fmt(order.deliveryFee)}</p>` : ""}
    <div class="divider"></div>
    <p class="total right">Total: ${fmt(order.total)}</p>
    ${order.notes ? `<p><span class="label">Obs:</span> ${order.notes}</p>` : ""}
    <div class="divider"></div>
    <p class="footer">Obrigado pela preferência!</p>
  </body>
</html>`)
win.document.close()
win.focus()
win.print()
win.close()
}

  const ageMinutes = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000)
  const isStale =
    ageMinutes >= 30 &&
    !["delivered", "cancelled", "out_for_delivery"].includes(order.status)
  const isCritical = ageMinutes >= 45 && isStale

  return (
    <Card id={`order-${order.id}`} className={`${isNewOrder ? "border-l-4 border-l-blue-500" : ""} ${unreadCount > 0 ? "border-red-300 border-2 shadow-md shadow-red-100" : ""} ${isCritical ? "border-red-500 border-2 shadow-md shadow-red-200" : isStale ? "border-amber-400 border-2" : ""} ${highlight ? "ring-2 ring-amber-400 ring-offset-2" : ""} transition-all duration-300`}>
      <CardContent className="p-4">
        {unreadCount > 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500/100" />
            </span>
            <p className="text-sm font-semibold text-red-400">
              {unreadCount} {unreadCount === 1 ? "nova mensagem" : "novas mensagens"} do cliente
            </p>
            <MessageCircle className="h-4 w-4 text-red-500 ml-auto" />
          </div>
        )}
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {order.method === "ifood" && order.externalDisplayId ? (
                <span className="inline-flex items-center rounded-md bg-red-600 px-2 py-0.5 text-xs font-bold text-white" title="Pedido iFood">
                  #{order.externalDisplayId}
                </span>
              ) : order.orderNumber ? (
                <span className="inline-flex items-center rounded-md bg-green-600 px-2 py-0.5 text-xs font-bold text-white">
                  #{order.orderNumber}
                </span>
              ) : null}
              <p className="font-semibold text-zinc-900">{order.customerName}</p>
              {order.isScheduled && order.deliveryDate && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-semibold text-purple-700 ring-1 ring-inset ring-purple-600/20"
                  title={`Agendado para ${new Date(order.deliveryDate).toLocaleString("pt-BR")}`}
                >
                  📅 {new Date(order.deliveryDate).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              {isStale && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${isCritical ? "bg-red-50 text-red-700 ring-red-600/20 animate-pulse" : "bg-amber-50 text-amber-700 ring-amber-600/20"}`}
                  title={`Pedido aguardando há ${ageMinutes} min`}
                >
                  ⏱ {ageMinutes >= 60 ? `${Math.floor(ageMinutes / 60)}h${ageMinutes % 60}min` : `${ageMinutes}min`}
                </span>
              )}
              {["pending", "confirmed"].includes(order.status) ? (
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20 animate-pulse">Novo</span>
              ) : order.status === "preparing" ? (
                <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-700 ring-1 ring-inset ring-orange-600/20">Preparando</span>
              ) : order.status === "ready" ? (
                <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-600/20">Pronto</span>
              ) : order.status === "out_for_delivery" ? (
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20">Em entrega</span>
              ) : order.status === "delivered" ? (
                <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-600/20">Entregue</span>
              ) : order.status === "cancelled" ? (
                <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">Cancelado</span>
              ) : (
                <Badge variant={statusColors[order.status] || "default"}>{statusLabels[order.status] || order.status}</Badge>
              )}
              {(() => {
                const m = normalizePaymentMethod(order.paymentMethod)
                if (m === "online" && order.paymentStatus === "pending") {
                  return <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20">Aguardando pagamento</span>
                }
                return null
              })()}
              {order.method === "ifood" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
                  <ShoppingBag className="h-3 w-3" />iFood
                </span>
              )}
              {order.method === "site" && (
                <a
                  href={order.establishment?.slug ? `/${order.establishment.slug}` : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-600/20 hover:bg-violet-100"
                >
                  <Store className="h-3 w-3" />Cardápio digital
                </a>
              )}
              {order.method === "whatsapp" && (
                <a
                  href={order.establishment?.slug ? `/${order.establishment.slug}` : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 hover:bg-emerald-100"
                >
                  <MessageCircle className="h-3 w-3" />WhatsApp
                </a>
              )}
              {unreadCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-inset ring-red-600/20 animate-pulse">{unreadCount} msg</span>
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm font-medium text-zinc-700">
              {order.orderType && (
                <span className="flex items-center gap-1">
                  {order.orderType === "delivery" ? "🛵" : order.orderType === "pickup" ? "🛍️" : "🍽️"}
                  <span>{orderTypeLabels[order.orderType] || order.orderType}</span>
                </span>
              )}
              {order.paymentMethod && (
                <span className="flex items-center gap-1">
                  {normalizePaymentMethod(order.paymentMethod) === "online" ? <CreditCard className="h-3.5 w-3.5" /> : <Banknote className="h-3.5 w-3.5" />}
                  <span>{paymentMethodLabels[normalizePaymentMethod(order.paymentMethod)] || order.paymentMethod}</span>
                  {normalizePaymentMethod(order.paymentMethod) === "cash" && order.changeFor && order.changeFor > 0 ? (
                    <span className="font-semibold text-amber-700">· troco p/ R$ {order.changeFor.toFixed(2).replace(".", ",")}</span>
                  ) : null}
                </span>
              )}
              <span className="text-zinc-300">•</span>
              <span className="text-zinc-500">{new Date(order.createdAt).toLocaleString("pt-BR")}</span>
            </div>

            <div className="mt-1.5 flex flex-wrap gap-2 text-sm">
              {order.trackingToken && order.orderType === "delivery" && false && (
                <a href={`/pedido/${order.trackingToken}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-green-600 hover:underline">
                  <ExternalLink className="h-3 w-3" />Rastrear
                </a>
              )}
              {order.paymentLink && (order.paymentStatus !== "paid" || order.status === "payment_pending") && (
                <button
                  onClick={async () => {
                    try {
                      if (!order.paymentId) {
                        alert("❌ Este pedido não possui ID de cobrança no Asaas. Gere um novo pagamento.")
                        return
                      }
                      const res = await fetchAuth("/api/payments/sync", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ orderId: order.id }),
                      })
                      const data = await res.json()
                      if (res.ok) {
                        alert(`✅ Asaas: ${data.asaasStatus} → Sistema: ${data.paymentStatus}`)
                        window.location.reload()
                      } else {
                        alert(`❌ ${data.error || "Erro ao sincronizar"}`)
                      }
                    } catch (e: any) {
                      console.error("Sync error:", e)
                      alert(`❌ Falha: ${e.message}`)
                    }
                  }}
                  className="text-xs text-blue-500 hover:underline"
                >
                  🔄 Sincronizar
                </button>
              )}
            </div>

            {order.orderType === "delivery" && order.customerAddress && <p className="mt-1 text-sm text-zinc-500">📍 {order.customerAddress}</p>}

            {order.status === "cancelled" && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
                    {order.cancelledBy === "customer"
                      ? "Cancelado pelo cliente"
                      : order.cancelledBy === "merchant"
                      ? "Cancelado pelo estabelecimento"
                      : order.cancelledBy === "system"
                      ? "Cancelado pelo sistema"
                      : "Cancelado"}
                  </span>
                  {order.cancellationDate && (
                    <span className="text-xs text-red-700/80">
                      em {new Date(order.cancellationDate).toLocaleString("pt-BR")}
                    </span>
                  )}
                  {order.customer?.cancellationCount >= 2 && (
                    <span
                      className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/30"
                      title={`Cliente já cancelou ${order.customer.cancellationCount} pedidos neste estabelecimento`}
                    >
                      ⚠ Cliente reincidente ({order.customer.cancellationCount} cancelamentos)
                    </span>
                  )}
                  {order.customer?.blockedUntil && new Date(order.customer.blockedUntil) > new Date() && (
                    <span className="inline-flex items-center rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-white ring-1 ring-inset ring-zinc-700">
                      🚫 Bloqueado até {new Date(order.customer.blockedUntil).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
                {order.cancellationReason && (
                  <p className="text-red-900">
                    <span className="font-semibold">Motivo:</span> {order.cancellationReason}
                  </p>
                )}
              </div>
            )}

            {items.length > 0 && (
              <div className="mt-2 rounded-lg bg-zinc-50 border border-zinc-100 p-2.5 space-y-0.5 text-sm text-zinc-600">
                {items.map((item: any, i: number) => (
                  <p key={i} className="font-medium">{item.quantity}x {item.name} — <span className="text-zinc-400">{formatCurrency(item.price * item.quantity)}</span></p>
                ))}
                {!isPresencial && order.deliveryFee > 0 && (
                  <p className="text-xs text-zinc-400 pt-1 border-t border-zinc-100">Taxa de entrega: {formatCurrency(order.deliveryFee)}</p>
                )}
              </div>
            )}

            {order.notes && <p className="mt-1.5 text-sm text-zinc-400 italic">Obs: {order.notes}</p>}

            {lastCustomerMsg && (
              <div className={`mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${unreadCount > 0 ? "bg-red-500/10 border border-red-500/20" : "bg-zinc-50 border border-zinc-200"}`}>
                <MessageCircle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${unreadCount > 0 ? "text-red-500" : "text-zinc-400"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${unreadCount > 0 ? "text-red-400" : "text-zinc-500"}`}>
                    {unreadCount > 0 ? "Última mensagem do cliente:" : "Mensagem do cliente:"}
                  </p>
                  <p className={`truncate ${unreadCount > 0 ? "text-red-400 font-medium" : "text-zinc-400"}`}>{lastCustomerMsg.message}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{new Date(lastCustomerMsg.createdAt).toLocaleString("pt-BR")}</p>
                </div>
              </div>
            )}

            {/* Delivery person - only for delivery orders */}
            {order.orderType === "delivery" && (
              <div className="mt-2 flex items-center gap-2">
                <Bike className="h-3 w-3 text-zinc-400" />
                <SearchableSelect
                  value={order.deliveryPersonId || ""}
                  onChange={(id) => {
                    const person = deliveryPeople.find((p: any) => p.id === id)
                    onUpdateDelivery(order.id, id, person?.name || "")
                  }}
                  options={[{ value: "", label: "Sem entregador" }, ...deliveryPeople.map((p: any) => ({ value: p.id, label: p.name }))]}
                  placeholder="Entregador..."
                />
            </div>
            )}
          </div>

          <div className="flex flex-col items-end justify-between gap-3 lg:min-h-[90px]">
            <p className="text-xl font-black text-green-600 tracking-tight">{formatCurrency(order.total)}</p>
            <div className="flex items-center gap-2">
              <button onClick={printReceipt} className="rounded-lg p-2 text-zinc-400 border border-zinc-200 bg-white hover:bg-zinc-50 hover:text-zinc-600 transition-colors" title="Imprimir">
                <Printer className="h-4 w-4" />
              </button>
               {nextStatus && !isOnlinePaymentPending && order.status !== "delivered" && order.status !== "cancelled" && (
                <button onClick={() => onUpdateStatus(order.id, nextStatus!)} className="rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 shadow-sm transition-colors flex items-center gap-1">
                  {nextLabel[order.status] || "Avançar"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Chat panel */}
        {chatOpen && (
          <div className="mt-4 border-t border-zinc-200 pt-4">
            <div ref={chatContainerRef} className="max-h-60 overflow-y-auto space-y-2 mb-3">
              {messages.length === 0 && (
                <p className="text-center text-sm text-zinc-400 py-3">Nenhuma mensagem ainda</p>
              )}
              {messages.map((msg: any) => (
                <div key={msg.id} className={`flex ${msg.sender === "establishment" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.sender === "establishment" ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-200"}`}>
                    <p>{msg.sender === "customer" ? "Você: " : "Estabelecimento: "}{msg.message}</p>
                    <p className={`text-[10px] mt-1 ${msg.sender === "establishment" ? "text-green-200" : "text-zinc-400"}`}>
                      {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value.slice(0, 500))}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Responder mensagem..."
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-green-600 focus:outline-none"
              />
              <Button size="sm" onClick={sendMessage} disabled={!newMessage.trim() || sending} className="gap-1">
                <Send className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
