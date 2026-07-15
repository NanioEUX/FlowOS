"use client"

import { useEffect, useState, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { ShoppingBag, Search, MessageCircle, ExternalLink, User, Plus, Loader2, X, Bike, Store, CreditCard, Banknote, Printer, Calendar, Package, Send } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import { formatCurrency } from "@/lib/utils"
import { fetchAuth } from "@/lib/fetch-auth"
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
const selectableStatuses = ["preparing", "ready", "out_for_delivery", "delivered"]

const paymentMethodLabels: Record<string, string> = {
  online: "Online (Pix/Cartão)",
  delivery: "Pagar na Entrega",
  pickup: "Pagar na Retirada",
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
  const [filterStatus, setFilterStatus] = useState("all")
  const [unreadOrders, setUnreadOrders] = useState<Record<string, { count: number; name: string; message: string }>>({})
  const [highlightOrderId, setHighlightOrderId] = useState<string | null>(null)

  async function loadOrders() {
    if (!establishmentId) return
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
    const matchesName = o.customerName.toLowerCase().includes(filter.toLowerCase())
    const matchesMotoboy = !filterMotoboy || o.deliveryPersonId === filterMotoboy
    const matchesType = filterType === "all" || o.orderType === filterType
    const matchesStatus = filterStatus === "all" || o.status === filterStatus
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
    return matchesName && matchesMotoboy && matchesType && matchesPeriod && matchesStatus
  })

  function groupOrders(list: any[]) {
    const groups: Record<string, typeof list> = { active: [], completed: [], cancelled: [] }
    list.forEach((o) => {
      if (o.status === "cancelled") groups.cancelled.push(o)
      else if (o.status === "delivered") groups.completed.push(o)
      else groups.active.push(o)
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
        
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none pl-9"
        />
      </div>

      {/* Motoboy summary */}
      {deliveryPeople.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div
            onClick={() => setFilterMotoboy("")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${!filterMotoboy ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-400 hover:bg-white/[.08]"}`}
          >
            Todos
          </div>
          {deliveryPeople.map((p: any) => {
            const count = orders.filter((o: any) => o.deliveryPersonId === p.id && !["delivered", "cancelled"].includes(o.status)).length
            return (
              <button
                key={p.id}
                onClick={() => setFilterMotoboy(p.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${filterMotoboy === p.id ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-400 hover:bg-white/[.08]"}`}
              >
                <Bike className="h-3 w-3" />
                {p.name}
                {count > 0 && <span className="ml-0.5 rounded-full bg-white/20 px-1.5 text-[10px]">{count}</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* Period + Type + Status filters */}
      <div className="flex flex-wrap gap-3 items-center">
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
        <div className="flex items-center rounded-lg bg-zinc-100 p-0.5 border border-zinc-200/60">
          {[
            { value: "all", label: "Todos" },
            { value: "delivery", label: "Entrega" },
            { value: "pickup", label: "Retirada" },
            { value: "presencial", label: "Caixa" },
          ].map((t) => (
            <button key={t.value} onClick={() => setFilterType(t.value)} className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${filterType === t.value ? "bg-white text-zinc-800 shadow-sm font-semibold" : "text-zinc-500 hover:text-zinc-800"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <SearchableSelect
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { value: "all", label: "Todos status" },
              { value: "pending", label: "Pendente" },
              { value: "preparing", label: "Preparando" },
              { value: "ready", label: "Pronto" },
              { value: "out_for_delivery", label: "Em entrega" },
              { value: "delivered", label: "Entregue" },
              { value: "cancelled", label: "Cancelado" },
            ]}
            placeholder="Status..."
          />
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
  const isNewOrder = ["pending", "payment_pending", "confirmed"].includes(order.status)

  let nextStatus: string | null
  if (isNewOrder) {
    nextStatus = "preparing"
  } else if (isPresencial && order.status === "ready") {
    nextStatus = "delivered"
  } else if (isPresencial && order.status === "preparing") {
    nextStatus = "ready"
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
    pending: "Iniciar preparo",
    payment_pending: "Iniciar preparo",
    confirmed: "Iniciar preparo",
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
    <h1>${order.establishmentName || "Estabelecimento"}</h1>
    <h2>--- CUPOM ---</h2>
    <div class="order-number">Pedido #${order.orderNumber || order.id.slice(0, 8)}</div>
    <p>${new Date(order.createdAt).toLocaleString("pt-BR")}</p>
    <p>Status: ${statusLabels[order.status] || order.status}</p>
    <div class="divider"></div>
    <p><strong>Cliente:</strong> ${order.customerName}</p>
    ${order.customerPhone ? `<p><strong>WhatsApp:</strong> ${order.customerPhone}</p>` : ""}
    ${order.customerAddress ? `<p><strong>Endereço:</strong> ${order.customerAddress}</p>` : ""}
    ${order.orderType ? `<p><strong>Tipo:</strong> ${orderTypeLabels[order.orderType] || order.orderType}</p>` : ""}
    ${order.paymentMethod ? `<p><strong>Pagamento:</strong> ${paymentMethodLabels[order.paymentMethod] || order.paymentMethod}</p>` : ""}
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

  return (
    <Card id={`order-${order.id}`} className={`${isNewOrder ? "border-l-4 border-l-blue-500" : ""} ${unreadCount > 0 ? "border-red-300 border-2 shadow-md shadow-red-100" : ""} ${highlight ? "ring-2 ring-amber-400 ring-offset-2" : ""} transition-all duration-300`}>
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
              {order.orderNumber && (
                <span className="inline-flex items-center rounded-md bg-green-600 px-2 py-0.5 text-xs font-bold text-white">
                  #{order.orderNumber}
                </span>
              )}
              <p className="font-semibold text-zinc-900">{order.customerName}</p>
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
              {order.paymentStatus === "paid" && <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700 ring-1 ring-inset ring-green-600/20">Pago</span>}
              {order.method === "whatsapp" && <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">WhatsApp</span>}
              {unreadCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-inset ring-red-600/20 animate-pulse">{unreadCount} msg</span>
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              {order.orderType && (
                <span className="flex items-center gap-1">
                  {order.orderType === "delivery" ? "🛵" : order.orderType === "pickup" ? "🛍️" : "🍽️"}
                  {orderTypeLabels[order.orderType] || order.orderType}
                </span>
              )}
              {order.paymentMethod && (
                <span className="flex items-center gap-1">
                  {order.paymentMethod === "online" ? <CreditCard className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}
                  {paymentMethodLabels[order.paymentMethod] || order.paymentMethod}
                </span>
              )}
              <span className="text-zinc-400">•</span>
              <span className="text-zinc-400">{new Date(order.createdAt).toLocaleString("pt-BR")}</span>
            </div>

            <div className="mt-1.5 flex flex-wrap gap-2 text-sm">
              {order.customerPhone && (
                <a href={`https://wa.me/55${order.customerPhone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-green-600 hover:underline">
                  <MessageCircle className="h-3 w-3" />{order.customerPhone}
                </a>
              )}
              {order.trackingToken && order.orderType === "delivery" && (
                <a href={`/pedido/${order.trackingToken}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-green-600 hover:underline">
                  <ExternalLink className="h-3 w-3" />Rastrear
                </a>
              )}
              {order.paymentLink && (
                <a href={order.paymentLink} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 underline">Link pgto</a>
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
              {nextStatus && (
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
                    <p>{msg.message}</p>
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
