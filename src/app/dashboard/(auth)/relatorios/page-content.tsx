"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { BarChart3, TrendingUp, DollarSign, ShoppingBag, Calendar, Package, CreditCard, Banknote, Smartphone } from "lucide-react"
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
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>("all")
  const [filterType, setFilterType] = useState("all")

  useEffect(() => {
    if (!establishmentId) return
    fetchAuth(`/api/orders?establishmentId=${establishmentId}`)
      .then((r) => r.json())
      .then((data) => {
        setOrders(data.filter((o: any) => o.status !== "cancelled"))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [establishmentId])

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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-flow-blue border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-flow-white">Relatórios Financeiros</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1">
          {([
            { value: "all", label: "Todos" },
            { value: "today", label: "Hoje" },
            { value: "7days", label: "7 dias" },
            { value: "30days", label: "30 dias" },
          ] as const).map((p) => (
            <button key={p.value} onClick={() => setPeriod(p.value)} className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${period === p.value ? "bg-flow-blue text-white" : "bg-white/[.05] text-zinc-500 hover:bg-white/[.08]"}`}>
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
            <button key={t.value} onClick={() => setFilterType(t.value)} className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${filterType === t.value ? "bg-flow-blue text-white" : "bg-white/[.05] text-zinc-500 hover:bg-white/[.08]"}`}>
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-flow-blue/10">
                <DollarSign className="h-4 w-4 text-flow-blue" />
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-flow-blue/10">
                <TrendingUp className="h-4 w-4 text-flow-blue" />
              </div>
              <div>
                <p className="text-[10px] text-zinc-500">Faturamento Líquido</p>
                <p className="text-lg font-bold text-flow-blue">{formatCurrency(netRevenue)}</p>
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
          <h3 className="mb-3 font-semibold text-sm text-flow-white">Faturamento Diário (14 dias)</h3>
          <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ height: 180 }}>
            {dailyData.map((day, i) => {
              const height = (day.revenue / maxDailyRevenue) * 140
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-0.5 min-w-[32px]">
                  {day.revenue > 0 && (
                    <span className="text-[9px] font-medium text-zinc-400">{formatCurrency(day.revenue)}</span>
                  )}
                  <div
                    className={`w-full rounded-t transition-all ${day.revenue > 0 ? "bg-flow-green" : "bg-white/[.05]"}`}
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
            <h3 className="mb-3 font-semibold text-sm text-flow-white">Formas de Pagamento</h3>
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
            <h3 className="mb-3 font-semibold text-sm text-flow-white">Produtos Mais Vendidos</h3>
            {topProducts.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-4">Nenhum dado</p>
            ) : (
              <div className="space-y-2">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-white/[.04] p-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-flow-blue/10 text-[10px] font-bold text-flow-blue">
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
          <h3 className="mb-3 font-semibold text-sm text-flow-white">Últimos Pedidos</h3>
          <div className="space-y-1">
            {filtered.slice(0, 10).map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-lg border border-white/[.04] p-2">
                <div>
                  <p className="text-sm font-medium text-flow-white">{order.customerName}</p>
                  <p className="text-[10px] text-zinc-500">
                    {new Date(order.createdAt).toLocaleDateString("pt-BR")} • {order.orderType === "presencial" ? "Caixa" : order.orderType === "delivery" ? "Entrega" : "Retirada"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-flow-blue">{formatCurrency(order.total)}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
