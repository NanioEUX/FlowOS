"use client"

import { useEffect, useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Bike, MapPin, Copy, CheckCircle, Clock, Package, MessageCircle, Loader2, DollarSign, History, Wallet, Calendar } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { fetchAuth } from "@/lib/fetch-auth"
import { useToast } from "@/components/toast"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { SearchableSelect } from "@/components/searchable-select"

const statusLabels: Record<string, string> = {
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
  ready: "success",
  out_for_delivery: "info",
  delivered: "success",
}

type DateFilter = "today" | "yesterday" | "7days" | "30days" | "custom" | "all"

function getDateRange(filter: DateFilter, customStart: string, customEnd: string): { start: Date; end: Date } {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)

  switch (filter) {
    case "today":
      return { start, end }
    case "yesterday": {
      const y = new Date(start)
      y.setDate(y.getDate() - 1)
      const ye = new Date(end)
      ye.setDate(ye.getDate() - 1)
      return { start: y, end: ye }
    }
    case "7days": {
      const s = new Date(start)
      s.setDate(s.getDate() - 6)
      return { start: s, end }
    }
    case "30days": {
      const s = new Date(start)
      s.setDate(s.getDate() - 29)
      return { start: s, end }
    }
    case "custom": {
      const s = customStart ? new Date(customStart + "T00:00:00") : start
      const e = customEnd ? new Date(customEnd + "T23:59:59") : end
      return { start: s, end: e }
    }
    case "all":
    default:
      return { start: new Date(0), end }
  }
}

function isInRange(dateStr: string, start: Date, end: Date): boolean {
  const d = new Date(dateStr)
  return d >= start && d <= end
}

const dateFilterButtons: { key: DateFilter; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "yesterday", label: "Ontem" },
  { key: "7days", label: "Últimos 7 dias" },
  { key: "30days", label: "Últimos 30 dias" },
  { key: "all", label: "Tudo" },
]

function DateFilters({ active, onChange, customStart, customEnd, onCustomStartChange, onCustomEndChange }: {
  active: DateFilter
  onChange: (f: DateFilter) => void
  customStart: string
  customEnd: string
  onCustomStartChange: (v: string) => void
  onCustomEndChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Calendar className="h-4 w-4 text-zinc-400" />
      {dateFilterButtons.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${active === f.key ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-400 hover:bg-white/[.08]"}`}
        >
          {f.label}
        </button>
      ))}
      <button
        onClick={() => onChange(active === "custom" ? "all" : "custom")}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${active === "custom" ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-400 hover:bg-white/[.08]"}`}
      >
        Personalizado
      </button>
      {active === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => onCustomStartChange(e.target.value)}
            className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none w-36 text-xs"
          />
          <span className="text-xs text-zinc-400">até</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => onCustomEndChange(e.target.value)}
            className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none w-36 text-xs"
          />
        </div>
      )}
    </div>
  )
}

export default function EntregasPage() {
  const searchParams = useSearchParams()
  const hookEstablishmentId = useEstablishmentId()
  const searchParamsEstablishmentId = searchParams.get("establishment")
  const establishmentId = searchParamsEstablishmentId || hookEstablishmentId
  const { toast } = useToast()
  const [deliveryPeople, setDeliveryPeople] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMotoboy, setSelectedMotoboy] = useState<string>("")
  const [tab, setTab] = useState<"entregas" | "financeiro">("entregas")
  const [payingMotoboy, setPayingMotoboy] = useState<string | null>(null)
  const [createdPassword, setCreatedPassword] = useState<string | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState<{ open: boolean; orderId: string }>({ open: false, orderId: "" })

  const [dateFilter, setDateFilter] = useState<DateFilter>("all")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")

  const [finDateFilter, setFinDateFilter] = useState<DateFilter>("all")
  const [finCustomStart, setFinCustomStart] = useState("")
  const [finCustomEnd, setFinCustomEnd] = useState("")

  async function loadAll() {
    if (!establishmentId) return
    const [peopleRes, ordersRes, paymentsRes] = await Promise.all([
      fetchAuth(`/api/delivery-persons?establishmentId=${establishmentId}`),
      fetchAuth(`/api/orders?establishmentId=${establishmentId}`),
      fetchAuth(`/api/delivery-payments?establishmentId=${establishmentId}`),
    ])
    if (peopleRes.ok) setDeliveryPeople(await peopleRes.json())
    if (ordersRes.ok) setOrders(await ordersRes.json())
    if (paymentsRes.ok) setPayments(await paymentsRes.json())
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [establishmentId])
  useEffect(() => { const i = setInterval(loadAll, 10000); return () => clearInterval(i) }, [establishmentId])

  async function reassignOrder(orderId: string, deliveryPersonId: string) {
    const person = deliveryPeople.find((p: any) => p.id === deliveryPersonId)
    await fetchAuth(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryPersonId, deliveryPersonName: person?.name || "" }),
    })
    loadAll()
  }

  function handleCancelOrder(orderId: string) {
    setCancelConfirm({ open: true, orderId })
  }

  async function confirmCancelOrder() {
    await fetchAuth(`/api/orders/${cancelConfirm.orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    })
    toast("Pedido cancelado", "success")
    setCancelConfirm({ open: false, orderId: "" })
    loadAll()
  }

  function calcPendingAmount(person: any) {
    const range = getDateRange(finDateFilter, finCustomStart, finCustomEnd)
    const completedOrders = orders.filter(
      (o: any) => o.deliveryPersonId === person.id && o.status === "delivered" && o.orderType === "delivery" && isInRange(o.createdAt, range.start, range.end)
    )
    const totalEarned = completedOrders.reduce((sum: number, o: any) => sum + (o.deliveryFee || 0), 0)
    const totalPaid = (person.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0)
    return totalEarned - totalPaid
  }

  async function payMotoboy(person: any) {
    if (!establishmentId) return
    const pending = calcPendingAmount(person)
    if (pending <= 0) return

    setPayingMotoboy(person.id)
    try {
      const range = getDateRange(finDateFilter, finCustomStart, finCustomEnd)
      const completedCount = orders.filter(
        (o: any) => o.deliveryPersonId === person.id && o.status === "delivered" && o.orderType === "delivery" && isInRange(o.createdAt, range.start, range.end)
      ).length
      await fetchAuth("/api/delivery-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryPersonId: person.id,
          amount: pending,
          period: "manual",
          notes: `Pagamento referente a ${completedCount} entregas`,
          establishmentId,
        }),
      })
      loadAll()
    } finally {
      setPayingMotoboy(null)
    }
  }

  const { start: dateStart, end: dateEnd } = getDateRange(dateFilter, customStart, customEnd)

  const filteredOrders = useMemo(() => {
    return orders.filter((o: any) => o.orderType === "delivery" && isInRange(o.createdAt, dateStart, dateEnd))
  }, [orders, dateStart.getTime(), dateEnd.getTime()])

  const filteredPeople = selectedMotoboy
    ? deliveryPeople.filter((p: any) => p.id === selectedMotoboy)
    : deliveryPeople

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-900">Entregas</h2>
        <p className="text-sm text-zinc-500">
          Motoboys são cadastrados na aba{" "}
          <a href="/dashboard/usuarios" className="font-medium text-[#FF6B35] hover:underline">
            Usuários
          </a>
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("entregas")}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "entregas" ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-400 hover:bg-white/[.08]"}`}
        >
          <Bike className="h-4 w-4" />
          Entregas
        </button>
        <button
          onClick={() => setTab("financeiro")}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "financeiro" ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-400 hover:bg-white/[.08]"}`}
        >
          <DollarSign className="h-4 w-4" />
          Financeiro
        </button>
      </div>

      {/* Created password banner */}
      {createdPassword && (
        <div className="rounded-lg bg-green-600/10 border border-green-600/20 p-3 text-sm text-green-600">
          {createdPassword}
        </div>
      )}

      {/* ===== TAB: ENTREGAS ===== */}
      {tab === "entregas" && (
        <>
          {/* Filtros agrupados */}
          <div className="rounded-lg bg-zinc-100 p-1">
            <DateFilters
              active={dateFilter}
              onChange={setDateFilter}
              customStart={customStart}
              customEnd={customEnd}
              onCustomStartChange={setCustomStart}
              onCustomEndChange={setCustomEnd}
            />
            <div className="flex flex-wrap items-center gap-1 mt-1">
              <button
                onClick={() => setSelectedMotoboy("")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${!selectedMotoboy ? "bg-green-600 text-white" : "bg-zinc-50 text-zinc-400 hover:bg-white/[.08]"}`}
              >
                Todos
              </button>
              {deliveryPeople.map((p: any) => {
                const pendings = filteredOrders.filter((o: any) => o.deliveryPersonId === p.id && ["ready", "out_for_delivery"].includes(o.status)).length
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedMotoboy(p.id)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${selectedMotoboy === p.id ? "bg-green-600 text-white" : "bg-zinc-50 text-zinc-400 hover:bg-white/[.08]"}`}
                  >
                    <Bike className="h-3 w-3" />
                    {p.name}
                    {pendings > 0 && <span className="rounded-full bg-white/20 px-1.5 text-[10px]">{pendings}</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {filteredPeople.map((person: any) => {
            const personOrders = filteredOrders.filter((o: any) => o.deliveryPersonId === person.id)
            const activeOrders = personOrders.filter((o: any) => ["ready", "out_for_delivery"].includes(o.status))
            const completedOrders = personOrders.filter((o: any) => o.status === "delivered")
            const vinculados = activeOrders.filter((o: any) => o.status === "ready").length
            const emRota = activeOrders.filter((o: any) => o.status === "out_for_delivery").length
            const isAvailable = vinculados === 0 && emRota === 0

            return (
              <Card key={person.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600/10">
                        <Bike className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-zinc-900">{person.name}</p>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${isAvailable ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${isAvailable ? "bg-green-500 animate-pulse" : "bg-amber-500"}`} />
                            {isAvailable ? "Disponível" : "Ocupado"}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500">{person.phone}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/${person.establishmentSlug}/entregas/${person.token}`)}
                      className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-400"
                      title="Copiar link"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mb-4 grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                      <p className="text-2xl font-bold text-amber-600">{vinculados}</p>
                      <p className="text-xs font-medium text-amber-600/70">Vinculados</p>
                    </div>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
                      <p className="text-2xl font-bold text-blue-600">{emRota}</p>
                      <p className="text-xs font-medium text-blue-600/70">Em Rota</p>
                    </div>
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
                      <p className="text-2xl font-bold text-green-600">{completedOrders.length}</p>
                      <p className="text-xs font-medium text-green-600/70">Concluídas</p>
                    </div>
                  </div>

                  {activeOrders.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Pedidos ativos</p>
                      {activeOrders.map((order: any) => (
                        <OrderRow key={order.id} order={order} deliveryPeople={deliveryPeople} onReassign={reassignOrder} onCancel={handleCancelOrder} />
                      ))}
                    </div>
                  )}

                  {activeOrders.length === 0 && completedOrders.length === 0 && (
                    <p className="text-sm text-zinc-400 italic">Nenhum pedido atribuído neste período</p>
                  )}
                </CardContent>
              </Card>
            )
          })}

          {!selectedMotoboy && (
            <PendingOrdersSection orders={filteredOrders.filter((o: any) => o.status === "ready" && !o.deliveryPersonId)} deliveryPeople={deliveryPeople} onReassign={reassignOrder} onCancel={handleCancelOrder} />
          )}
        </>
      )}

      {/* ===== TAB: FINANCEIRO ===== */}
      {tab === "financeiro" && (
        <>
          {/* Filtros agrupados */}
          <div className="rounded-lg bg-zinc-100 p-1">
            <DateFilters
              active={finDateFilter}
              onChange={setFinDateFilter}
              customStart={finCustomStart}
              customEnd={finCustomEnd}
              onCustomStartChange={setFinCustomStart}
              onCustomEndChange={setFinCustomEnd}
            />
          </div>

          {/* Pending amounts */}
          <Card>
            <CardContent className="p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-700 mb-3">
                <Wallet className="h-4 w-4" />
                Saldo Pendente por Motoboy
              </h3>
              <div className="space-y-3">
                {deliveryPeople.map((person: any) => {
                  const pending = calcPendingAmount(person)
                  const range = getDateRange(finDateFilter, finCustomStart, finCustomEnd)
                  const completedCount = orders.filter(
                    (o: any) => o.deliveryPersonId === person.id && o.status === "delivered" && o.orderType === "delivery" && isInRange(o.createdAt, range.start, range.end)
                  ).length
                  return (
                    <div key={person.id} className="flex items-center justify-between rounded-lg border border-white/[.04] bg-zinc-50 p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600/10">
                          <Bike className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900">{person.name}</p>
                          <p className="text-xs text-zinc-500">{completedCount} entregas • Taxa recebida: {formatCurrency(orders.filter((o: any) => o.deliveryPersonId === person.id && o.status === "delivered" && o.orderType === "delivery" && isInRange(o.createdAt, range.start, range.end)).reduce((sum: number, o: any) => sum + (o.deliveryFee || 0), 0))}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-bold ${pending > 0 ? "text-amber-400" : "text-green-600"}`}>
                          {formatCurrency(pending)}
                        </span>
                        {pending > 0 && (
                          <Button
                            size="sm"
                            onClick={() => payMotoboy(person)}
                            disabled={payingMotoboy === person.id}
                            className="gap-1"
                          >
                            {payingMotoboy === person.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <DollarSign className="h-3 w-3" />}
                            Pagar
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
                {deliveryPeople.length === 0 && (
                  <p className="text-sm text-zinc-400 text-center py-4">Nenhum entregador cadastrado</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment history */}
          <Card>
            <CardContent className="p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-700 mb-3">
                <History className="h-4 w-4" />
                Histórico de Pagamentos
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {(() => {
                  const range = getDateRange(finDateFilter, finCustomStart, finCustomEnd)
                  const filtered = payments.filter((p: any) => isInRange(p.createdAt, range.start, range.end))
                  if (filtered.length === 0) {
                    return <p className="text-sm text-zinc-400 text-center py-4">Nenhum pagamento neste período</p>
                  }
                  return filtered.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-white/[.04] bg-zinc-50 p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600/10">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-900">{p.deliveryPerson?.name}</p>
                          <p className="text-xs text-zinc-400">
                            {new Date(p.createdAt).toLocaleString("pt-BR")}
                            {p.notes && ` • ${p.notes}`}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-green-600">{formatCurrency(p.amount)}</span>
                    </div>
                  ))
                })()}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={cancelConfirm.open}
        title="Cancelar pedido"
        message="Tem certeza que deseja cancelar este pedido? Esta ação não pode ser desfeita."
        confirmLabel="Cancelar Pedido"
        variant="danger"
        onConfirm={confirmCancelOrder}
        onCancel={() => setCancelConfirm({ open: false, orderId: "" })}
      />
    </div>
  )
}

function OrderRow({ order, deliveryPeople, onReassign, onCancel }: { order: any; deliveryPeople: any[]; onReassign: (id: string, personId: string) => void; onCancel: (id: string) => void }) {
  const isLocked = ["out_for_delivery", "delivered", "cancelled"].includes(order.status)
  const createdAt = new Date(order.createdAt)
  const diffMs = Date.now() - createdAt.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const timeLabel = diffMin < 60 ? `${diffMin} min` : `${Math.floor(diffMin / 60)}h ${diffMin % 60}min`
  const isReady = order.status === "ready"

  return (
    <div className="flex items-center justify-between rounded-lg border border-white/[.04] bg-zinc-50 p-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {order.orderNumber && (
            <span className="inline-flex items-center rounded-full bg-green-600 px-2.5 py-0.5 text-xs font-bold text-white">
              #{order.orderNumber}
            </span>
          )}
          <p className="font-medium text-zinc-900">{order.customerName}</p>
          {isReady && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
              <Clock className="h-3 w-3" />
              Pronto há {timeLabel}
            </span>
          )}
          {!isReady && order.status === "out_for_delivery" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
              Em rota há {timeLabel}
            </span>
          )}
          <Badge variant={statusColors[order.status] || "default"}>{statusLabels[order.status] || order.status}</Badge>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-xs text-zinc-400">{createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
          {order.customerAddress && <p className="flex items-center gap-1 text-xs text-zinc-500"><MapPin className="h-3 w-3 shrink-0" />{order.customerAddress}</p>}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {order.customerPhone && (
            <a href={`https://wa.me/55${order.customerPhone.replace(/\D/g, "")}`} target="_blank" className="flex items-center gap-1 text-xs text-green-600 hover:underline">
              <MessageCircle className="h-3 w-3" />{order.customerPhone}
            </a>
          )}
          <span className="text-xs font-semibold text-zinc-700">{formatCurrency(order.total)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        <SearchableSelect
          value={order.deliveryPersonId || ""}
          onChange={(id) => onReassign(order.id, id)}
          options={[{ value: "", label: "Sem motoboy" }, ...deliveryPeople.map((p: any) => ({ value: p.id, label: p.name }))]}
          placeholder="Motoboy..."
        />
        <button
          onClick={() => onCancel(order.id)}
          disabled={isLocked}
          className="rounded p-1.5 text-red-400 hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-red-400"
          title={isLocked ? "Pedido em entrega/entregue" : "Cancelar pedido"}
        >
          <span className="sr-only">Cancelar</span>
          &times;
        </button>
      </div>
    </div>
  )
}

function PendingOrdersSection({ orders, deliveryPeople, onReassign, onCancel }: { orders: any[]; deliveryPeople: any[]; onReassign: (id: string, personId: string) => void; onCancel: (id: string) => void }) {
  if (orders.length === 0) return null

  return (
    <Card className="border-amber-500/20 bg-amber-500/5">
      <CardContent className="p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-600 mb-3">
          <Package className="h-4 w-4" />
          Pedidos prontos sem motoboy ({orders.length})
        </h3>
        <div className="space-y-2">
          {orders.map((order: any) => (
            <OrderRow key={order.id} order={order} deliveryPeople={deliveryPeople} onReassign={onReassign} onCancel={onCancel} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
