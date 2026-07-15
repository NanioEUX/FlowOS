"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { BarChart3, TrendingUp, DollarSign, ShoppingBag, Calendar, Package, CreditCard, Banknote, Smartphone, Bike, CheckCircle, Wallet, History, Loader2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { fetchAuth } from "@/lib/fetch-auth"

type Period = "all" | "today" | "7days" | "30days"

export default function RelatoriosPage() {
  const searchParams = useSearchParams()
  const hookEstablishmentId = useEstablishmentId()
  const searchParamsEstablishmentId = searchParams.get("establishment")
  const establishmentId = searchParamsEstablishmentId || hookEstablishmentId
  const [orders, setOrders] = useState<any[]>([])
  const [deliveryPeople, setDeliveryPeople] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [payingMotoboy, setPayingMotoboy] = useState<string | null>(null)
  const [commissionRates, setCommissionRates] = useState<Record<string, number>>({})
  const [period, setPeriod] = useState<Period>("all")
  const [filterType, setFilterType] = useState("all")

  useEffect(() => {
    if (!establishmentId) return
    Promise.all([
      fetchAuth(`/api/orders?establishmentId=${establishmentId}`),
      fetchAuth(`/api/delivery-persons?establishmentId=${establishmentId}`),
      fetchAuth(`/api/delivery-payments?establishmentId=${establishmentId}`),
    ]).then(([ordersRes, peopleRes, paymentsRes]) =>
      Promise.all([ordersRes.json(), peopleRes.json(), paymentsRes.json()])
    ).then(([ordersData, peopleData, paymentsData]) => {
      setOrders(ordersData.filter((o: any) => o.status !== "cancelled"))
      setDeliveryPeople(peopleData)
      setPayments(paymentsData)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [establishmentId])

  // Load commission rates from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("waiterCommissionRates")
      if (saved) setCommissionRates(JSON.parse(saved))
    } catch {}
  }, [])

  const filtered = orders.filter((o) => {
    const matchesType = filterType === "all" || o.orderType === filterType
    const d = new Date(o.createdAt)
    const now = new Date()
    let matchesPeriod = true
    if (period === "today") {
      matchesPeriod = d.toDateString() === now.toDateString()
    } else if (period === "7days") {
      matchesPeriod = d >= new Date(now.getTime() - 7 * 86400000)
    } else if (period === "30days") {
      matchesPeriod = d >= new Date(now.getTime() - 30 * 86400000)
    }
    return matchesPeriod && matchesType
  })

  const totalRevenue = filtered.reduce((sum, o) => sum + o.total, 0)
  const onlineOrders = filtered.filter((o) => o.paymentMethod === "online")
  const presencialOrders = filtered.filter((o) => o.orderType === "presencial")
  const onlineRevenue = onlineOrders.reduce((sum, o) => sum + o.total, 0)
  const presencialRevenue = presencialOrders.reduce((sum, o) => sum + o.total, 0)
  const netRevenue = onlineRevenue + presencialRevenue
  const averageTicket = filtered.length > 0 ? totalRevenue / filtered.length : 0

  // Payment method breakdown
  const paymentBreakdown = {
    money: filtered.filter((o) => o.paymentMethod === "money").reduce((sum, o) => sum + o.total, 0),
    card: filtered.filter((o) => o.paymentMethod === "card").reduce((sum, o) => sum + o.total, 0),
    pix: filtered.filter((o) => o.paymentMethod === "pix").reduce((sum, o) => sum + o.total, 0),
    online: onlineRevenue,
  }
  const paymentCount = {
    money: filtered.filter((o) => o.paymentMethod === "money").length,
    card: filtered.filter((o) => o.paymentMethod === "card").length,
    pix: filtered.filter((o) => o.paymentMethod === "pix").length,
    online: onlineOrders.length,
  }

  // Top products
  const productSales: Record<string, { name: string; qty: number; revenue: number }> = {}
  filtered.forEach((o) => {
    try {
      const items = typeof o.items === "string" ? JSON.parse(o.items) : o.items
      if (Array.isArray(items)) {
        items.forEach((item: any) => {
          if (!productSales[item.name]) {
            productSales[item.name] = { name: item.name, qty: 0, revenue: 0 }
          }
          productSales[item.name].qty += item.quantity || 1
          productSales[item.name].revenue += (item.price || 0) * (item.quantity || 1)
        })
      }
    } catch {}
  })
  const topProducts = Object.values(productSales)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  // Delivery financial helpers
  function calcPendingAmount(person: any) {
    const completedOrders = orders.filter(
      (o: any) => o.deliveryPersonId === person.id && o.status === "delivered" && o.orderType === "delivery"
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
      const completedCount = orders.filter(
        (o: any) => o.deliveryPersonId === person.id && o.status === "delivered" && o.orderType === "delivery"
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
      // Reload payments
      const res = await fetchAuth(`/api/delivery-payments?establishmentId=${establishmentId}`)
      if (res.ok) setPayments(await res.json())
    } finally {
      setPayingMotoboy(null)
    }
  }

  // Daily revenue (last 14 days)
  const dailyData = Array.from({ length: 14 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (13 - i))
    const dateStr = date.toDateString()
    const dayOrders = filtered.filter((o) => new Date(o.createdAt).toDateString() === dateStr)
    return {
      day: `${date.getDate()}/${date.getMonth() + 1}`,
      shortDay: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][date.getDay()],
      revenue: dayOrders.reduce((sum, o) => sum + o.total, 0),
      count: dayOrders.length,
    }
  })

  const maxDailyRevenue = Math.max(...dailyData.map((d) => d.revenue), 1)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-zinc-900">Relatórios Financeiros</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1">
          {([
            { value: "all", label: "Todos" },
            { value: "today", label: "Hoje" },
            { value: "7days", label: "7 dias" },
            { value: "30days", label: "30 dias" },
          ] as const).map((p) => (
            <button key={p.value} onClick={() => setPeriod(p.value)} className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${period === p.value ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-white/[.08]"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {[
            { value: "all", label: "Todos" },
            { value: "delivery", label: "Entrega" },
            { value: "pickup", label: "Retirada" },
            { value: "presencial", label: "Caixa" },
          ].map((t) => (
            <button key={t.value} onClick={() => setFilterType(t.value)} className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${filterType === t.value ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-white/[.08]"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600/10">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-[10px] text-zinc-500">Faturamento</p>
                <p className="text-lg font-bold">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600/10">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-[10px] text-zinc-500">Faturamento Líquido</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(netRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
                <ShoppingBag className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="text-[10px] text-zinc-500">Ticket Médio</p>
                <p className="text-lg font-bold">{formatCurrency(averageTicket)}</p>
                <p className="text-[10px] text-zinc-400">{filtered.length} pedidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 font-semibold text-sm text-zinc-900">Faturamento Diário (14 dias)</h3>
          <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ height: 180 }}>
            {dailyData.map((day, i) => {
              const height = (day.revenue / maxDailyRevenue) * 140
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-0.5 min-w-[32px]">
                  {day.revenue > 0 && (
                    <span className="text-[9px] font-medium text-zinc-400">{formatCurrency(day.revenue)}</span>
                  )}
                  <div
                    className={`w-full rounded-t transition-all ${day.revenue > 0 ? "bg-green-600" : "bg-zinc-100"}`}
                    style={{ height: Math.max(height, day.revenue > 0 ? 8 : 2) }}
                  />
                  <span className="text-[9px] text-zinc-400">{day.shortDay}</span>
                  <span className="text-[8px] text-zinc-300">{day.day}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Payment methods + Top products */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 font-semibold text-sm text-zinc-900">Formas de Pagamento</h3>
            <div className="space-y-2">
              {[
                { label: "Dinheiro", value: paymentBreakdown.money, count: paymentCount.money, icon: Banknote, color: "green" },
                { label: "Cartão", value: paymentBreakdown.card, count: paymentCount.card, icon: CreditCard, color: "blue" },
                { label: "Pix", value: paymentBreakdown.pix, count: paymentCount.pix, icon: Smartphone, color: "purple" },
                { label: "Online (Asaas)", value: paymentBreakdown.online, count: paymentCount.online, icon: DollarSign, color: "orange" },
              ].map((pm) => (
                <div key={pm.label} className="flex items-center justify-between rounded-lg border border-white/[.04] p-2">
                  <div className="flex items-center gap-2">
                    <pm.icon className={`h-4 w-4 text-${pm.color}-500`} />
                    <span className="text-sm">{pm.label}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatCurrency(pm.value)}</p>
                    <p className="text-[10px] text-zinc-400">{pm.count} pedidos</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 font-semibold text-sm text-zinc-900">Produtos Mais Vendidos</h3>
            {topProducts.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-4">Nenhum dado</p>
            ) : (
              <div className="space-y-2">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-white/[.04] p-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600/10 text-[10px] font-bold text-green-600">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-[10px] text-zinc-400">{p.qty} vendidos</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold">{formatCurrency(p.revenue)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 font-semibold text-sm text-zinc-900">Últimos Pedidos</h3>
          <div className="space-y-1">
            {filtered.slice(0, 10).map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-lg border border-white/[.04] p-2">
                <div>
                  <p className="text-sm font-medium text-zinc-900">{order.customerName}</p>
                  <p className="text-[10px] text-zinc-500">
                    {new Date(order.createdAt).toLocaleDateString("pt-BR")} • {order.orderType === "presencial" ? "Caixa" : order.orderType === "delivery" ? "Entrega" : "Retirada"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-600">{formatCurrency(order.total)}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Equipe - Entregadores */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 font-semibold text-sm text-zinc-900 flex items-center gap-2">
            <Bike className="h-4 w-4" />
            Entregadores
          </h3>
          {deliveryPeople.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-4">Nenhum entregador cadastrado</p>
          ) : (
            <div className="space-y-3">
              {deliveryPeople.map((person: any) => {
                const pending = calcPendingAmount(person)
                const completedCount = orders.filter(
                  (o: any) => o.deliveryPersonId === person.id && o.status === "delivered" && o.orderType === "delivery"
                ).length
                const totalEarned = orders.filter(
                  (o: any) => o.deliveryPersonId === person.id && o.status === "delivered" && o.orderType === "delivery"
                ).reduce((sum: number, o: any) => sum + (o.deliveryFee || 0), 0)
                return (
                  <div key={person.id} className="flex items-center justify-between rounded-lg border border-white/[.04] bg-zinc-50 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600/10">
                        <Bike className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-zinc-900">{person.name}</p>
                        <p className="text-xs text-zinc-500">{completedCount} entregas • Taxa recebida: {formatCurrency(totalEarned)}</p>
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment history */}
      {payments.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 font-semibold text-sm text-zinc-900 flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico de Pagamentos - Entregadores
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {payments.slice(0, 20).map((p: any) => (
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
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Garçoms */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 font-semibold text-sm text-zinc-900 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Garçoms
          </h3>
          {(() => {
            const waiterOrders: Record<string, { count: number; revenue: number }> = {}
            filtered.forEach((o: any) => {
              if (o.waiterName) {
                if (!waiterOrders[o.waiterName]) waiterOrders[o.waiterName] = { count: 0, revenue: 0 }
                waiterOrders[o.waiterName].count++
                waiterOrders[o.waiterName].revenue += o.total
              }
            })
            const waiters = Object.entries(waiterOrders)
            if (waiters.length === 0) {
              return <p className="text-sm text-zinc-400 text-center py-4">Nenhum pedido com garçom vinculado neste período</p>
            }
            return (
              <div className="space-y-3">
                {waiters.map(([name, data]) => {
                  const rate = commissionRates[name] ?? 10
                  const commission = data.revenue * (rate / 100)
                  return (
                    <div key={name} className="flex items-center justify-between rounded-lg border border-white/[.04] bg-zinc-50 p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600/10">
                          <Users className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900">{name}</p>
                          <p className="text-xs text-zinc-500">{data.count} pedidos • {formatCurrency(data.revenue)} em vendas</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-xs text-zinc-500">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={rate}
                            onChange={(e) => {
                              const newRate = parseFloat(e.target.value) || 0
                              const updated = { ...commissionRates, [name]: newRate }
                              setCommissionRates(updated)
                              localStorage.setItem("waiterCommissionRates", JSON.stringify(updated))
                            }}
                            className="w-12 rounded border border-zinc-200 bg-white px-1 py-0.5 text-center text-xs font-medium text-zinc-700 focus:border-green-600 focus:outline-none"
                          />
                          <span>%</span>
                        </div>
                        <span className="text-lg font-bold text-blue-600">
                          {formatCurrency(commission)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </CardContent>
      </Card>
    </div>
  )
}
