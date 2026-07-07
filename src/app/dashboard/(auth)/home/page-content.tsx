"use client"

import { useEffect, useState } from "react"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { DollarSign, ShoppingBag, Users, Bike, TrendingUp, TrendingDown, RefreshCw, Package, Clock, AlertTriangle, Wallet, Store, CreditCard, Banknote, Smartphone, Globe, Plus, BarChart3, ArrowRight, Zap, CircleDollarSign, CalendarClock, Skull, PackageX, UtensilsCrossed } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { fetchAuth } from "@/lib/fetch-auth"
import { Sparkline } from "@/components/charts/sparkline"
import { Donut } from "@/components/charts/donut"
import { AreaChart } from "@/components/charts/area-chart"

export default function DashboardHomePage() {
  const establishmentId = useEstablishmentId()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function loadData() {
    if (!establishmentId) return
    setRefreshing(true)
    try {
      const res = await fetchAuth(`/api/dashboard?establishmentId=${establishmentId}`)
      if (res.ok) setData(await res.json())
    } catch {} finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { loadData() }, [establishmentId])

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" /></div>
  if (!data) return <div className="py-20 text-center text-zinc-500"><p>Erro ao carregar</p><Button onClick={loadData} className="mt-4">Tentar novamente</Button></div>

  const salesPercent = data.today.vsYesterday.percentTotal
  const sparkData = data.weekSales?.map((d: any) => d.total) || []
  const hasAlerts = data.alerts.lowStock > 0 || data.alerts.overdueExpenses > 0 || data.alerts.todayDueExpenses > 0 || data.alerts.noMotoboy > 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Dashboard</h2>
          <p className="text-sm text-zinc-500">Visão geral do dia</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={refreshing} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Linha 1 — 4 cards de resumo */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Vendas Hoje */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="absolute right-2 top-2 opacity-30">
              <Sparkline data={sparkData} color="#16a34a" height={32} className="w-20" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-600/10">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              {salesPercent !== 0 && (
                <span className={`flex items-center gap-0.5 text-[10px] font-medium ${salesPercent > 0 ? "text-green-600" : "text-red-500"}`}>
                  {salesPercent > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                  {salesPercent > 0 ? "+" : ""}{salesPercent}%
                </span>
              )}
            </div>
            <p className="text-xl font-bold text-zinc-900">{formatCurrency(data.today.total)}</p>
            <div className="mt-1 flex items-center gap-2 text-[10px]">
              <span className="text-green-600">✓ {formatCurrency(data.today.paid)} pago</span>
              {data.today.pending > 0 && <span className="text-amber-500">⏳ {formatCurrency(data.today.pending)}</span>}
            </div>
          </CardContent>
        </Card>

        {/* Receita vs Despesas */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                <CircleDollarSign className="h-4 w-4 text-blue-500" />
              </div>
            </div>
            <p className="text-[10px] text-zinc-400 mb-1">Receita vs Despesas</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-bold text-green-600">{formatCurrency(data.today.total)}</span>
              <span className="text-[10px] text-zinc-400">vs</span>
              <span className="text-sm font-bold text-red-500">{formatCurrency(data.profit.expenses)}</span>
            </div>
            <div className="mt-2 h-2 bg-zinc-100 rounded-full overflow-hidden flex">
              <div className="h-full bg-green-500 rounded-l-full" style={{ width: `${data.today.total > 0 ? (data.today.total / (data.today.total + data.profit.expenses)) * 100 : 50}%` }} />
              <div className="h-full bg-red-400 rounded-r-full" style={{ width: `${data.profit.expenses > 0 ? (data.profit.expenses / (data.today.total + data.profit.expenses)) * 100 : 0}%` }} />
            </div>
          </CardContent>
        </Card>

        {/* Lucro Líquido */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${data.profit.today >= 0 ? "bg-green-600/10" : "bg-red-500/10"}`}>
                <Wallet className={`h-4 w-4 ${data.profit.today >= 0 ? "text-green-600" : "text-red-500"}`} />
              </div>
            </div>
            <p className="text-[10px] text-zinc-400 mb-1">Lucro Líquido</p>
            <p className={`text-xl font-bold ${data.profit.today >= 0 ? "text-green-600" : "text-red-500"}`}>{formatCurrency(data.profit.today)}</p>
            <p className="text-[10px] text-zinc-400">Mês: {formatCurrency(data.month?.total || 0)}</p>
          </CardContent>
        </Card>

        {/* Pedidos Ativos */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                <Package className="h-4 w-4 text-amber-500" />
              </div>
              <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 rounded-full px-1.5 py-0.5">
                {data.active.total}
              </span>
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5"><Clock className="h-2.5 w-2.5 text-amber-500" /><span className="text-zinc-400">Preparando</span></div>
                <span className="font-medium">{data.active.byStatus.preparing}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5"><Package className="h-2.5 w-2.5 text-green-600" /><span className="text-zinc-400">Prontos</span></div>
                <span className="font-medium">{data.active.byStatus.ready}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5"><Bike className="h-2.5 w-2.5 text-blue-500" /><span className="text-zinc-400">Em entrega</span></div>
                <span className="font-medium">{data.active.byStatus.out_for_delivery}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Linha 2 — Alertas (prioridade) */}
      <Card className={hasAlerts ? "border-amber-500/30" : ""}>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
            Alertas
            {hasAlerts && <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />}
          </h3>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
            {/* Estoque Baixo */}
            {data.alerts.lowStock > 0 && (
              <a href="/dashboard/estoque" className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 hover:bg-amber-500/10 transition-colors">
                <PackageX className="h-4 w-4 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-900">Estoque baixo</p>
                  {data.alerts.lowStockItems?.slice(0, 2).map((item: any, i: number) => (
                    <p key={i} className="text-[10px] text-zinc-400 truncate">{item.name}: {item.quantity}</p>
                  ))}
                </div>
                <ArrowRight className="h-3 w-3 text-zinc-400 shrink-0" />
              </a>
            )}

            {/* Despesas Atrasadas */}
            {data.alerts.overdueExpenses > 0 && (
              <a href="/dashboard/financeiro/despesas" className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-2.5 hover:bg-red-500/10 transition-colors">
                <Skull className="h-4 w-4 text-red-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-900">{data.alerts.overdueExpenses} atrasada(s)</p>
                  <p className="text-[10px] text-red-500 font-medium">{formatCurrency(data.alerts.totalOverdue)}</p>
                </div>
                <ArrowRight className="h-3 w-3 text-zinc-400 shrink-0" />
              </a>
            )}

            {/* Despesas Vencendo Hoje */}
            {data.alerts.todayDueExpenses > 0 && (
              <a href="/dashboard/financeiro/despesas" className="flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/5 p-2.5 hover:bg-orange-500/10 transition-colors">
                <CalendarClock className="h-4 w-4 text-orange-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-900">{data.alerts.todayDueExpenses} vence(m) hoje</p>
                  <p className="text-[10px] text-orange-500 font-medium">{formatCurrency(data.alerts.totalTodayDue)}</p>
                </div>
                <ArrowRight className="h-3 w-3 text-zinc-400 shrink-0" />
              </a>
            )}

            {/* Despesas a Vencer */}
            {data.alerts.upcomingExpenses > 0 && (
              <a href="/dashboard/financeiro/despesas" className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-2.5 hover:bg-blue-500/10 transition-colors">
                <CalendarClock className="h-4 w-4 text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-900">{data.alerts.upcomingExpenses} a vencer (7d)</p>
                  <p className="text-[10px] text-blue-500 font-medium">{formatCurrency(data.alerts.totalUpcoming)}</p>
                </div>
                <ArrowRight className="h-3 w-3 text-zinc-400 shrink-0" />
              </a>
            )}

            {/* Pedidos sem Motoboy */}
            {data.alerts.noMotoboy > 0 && (
              <a href="/dashboard/entregas" className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/5 p-2.5 hover:bg-purple-500/10 transition-colors">
                <Bike className="h-4 w-4 text-purple-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-900">{data.alerts.noMotoboy} sem motoboy</p>
                  <p className="text-[10px] text-zinc-400">Pronto(s) para entrega</p>
                </div>
                <ArrowRight className="h-3 w-3 text-zinc-400 shrink-0" />
              </a>
            )}

            {/* Tudo ok */}
            {!hasAlerts && (
              <div className="col-span-full flex flex-col items-center justify-center py-4 text-center">
                <Zap className="h-5 w-5 text-green-500 mb-1" />
                <p className="text-xs font-medium text-green-600">Tudo tranquilo!</p>
                <p className="text-[10px] text-zinc-400">Nenhum alerta no momento</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Linha 3 — Gráficos */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Receita 7 dias */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-zinc-700">Receita — 7 dias</h3>
              <span className="text-[10px] text-zinc-400">Mês: {formatCurrency(data.month?.total || 0)}</span>
            </div>
            <AreaChart data={data.weekSales || []} height={150} color="#16a34a" />
          </CardContent>
        </Card>

        {/* Pedidos por Tipo */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-zinc-700 mb-4">Pedidos por Tipo</h3>
            <div className="flex items-center justify-center gap-4">
              <Donut value={data.byType.delivery} total={data.today.count || 1} color="#3b82f6" size={90} label={`${data.byType.delivery}`} sublabel="Entrega" />
              <Donut value={data.byType.pickup} total={data.today.count || 1} color="#8b5cf6" size={90} label={`${data.byType.pickup}`} sublabel="Retirada" />
              <Donut value={data.byType.mesa + data.byType.balcao} total={data.today.count || 1} color="#16a34a" size={90} label={`${data.byType.mesa + data.byType.balcao}`} sublabel="Local" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Linha 4 — Status + Top Produtos */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Status Operacional */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-zinc-700 mb-3">Status Operacional</h3>
            <div className="space-y-2">
              {/* Caixa */}
              <div className="flex items-center justify-between rounded-lg bg-zinc-50 p-3">
                <div className="flex items-center gap-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${data.cashRegister.isOpen ? "bg-green-600/10" : "bg-red-500/10"}`}>
                    <Wallet className={`h-4 w-4 ${data.cashRegister.isOpen ? "text-green-600" : "text-red-500"}`} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-900">Caixa</p>
                    <p className="text-[10px] text-zinc-400">{data.cashRegister.isOpen ? "Aberto" : "Fechado"}</p>
                  </div>
                </div>
                <div className={`h-2.5 w-2.5 rounded-full ${data.cashRegister.isOpen ? "bg-green-500 animate-pulse" : "bg-red-400"}`} />
              </div>
              {/* Mesas */}
              <div className="flex items-center justify-between rounded-lg bg-zinc-50 p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                    <UtensilsCrossed className="h-4 w-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-900">Mesas</p>
                    <p className="text-[10px] text-zinc-400">{data.tables.active} ativa(s) / {data.tables.total} total</p>
                  </div>
                </div>
                {data.tables.active > 0 && (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 rounded-full px-1.5 py-0.5">{data.tables.active}</span>
                )}
              </div>
              {/* Motoboys */}
              <div className="flex items-center justify-between rounded-lg bg-zinc-50 p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                    <Bike className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-900">Motoboys</p>
                    <p className="text-[10px] text-zinc-400">{data.motoboys.free} livres / {data.motoboys.total} total</p>
                  </div>
                </div>
                {data.motoboys.busy > 0 && (
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-500/10 rounded-full px-1.5 py-0.5">{data.motoboys.busy} ocupados</span>
                )}
              </div>
              {/* Clientes */}
              <div className="flex items-center justify-between rounded-lg bg-zinc-50 p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                    <Users className="h-4 w-4 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-900">Clientes</p>
                    <p className="text-[10px] text-zinc-400">{data.customers.total} total</p>
                  </div>
                </div>
                {data.customers.newToday > 0 && (
                  <span className="text-[10px] font-bold text-green-600 bg-green-600/10 rounded-full px-1.5 py-0.5">+{data.customers.newToday}</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Produtos */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-zinc-700 mb-3">Produtos mais vendidos (hoje)</h3>
            {data.topProducts.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-6">Nenhuma venda ainda hoje</p>
            ) : (
              <div className="space-y-2">
                {data.topProducts.map((product: any, i: number) => {
                  const maxCount = data.topProducts[0]?.count || 1
                  const pct = (product.count / maxCount) * 100
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600/10 text-[10px] font-bold text-green-600 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-xs font-medium text-zinc-900 truncate">{product.name}</p>
                          <span className="text-[10px] font-medium text-green-600 ml-2">{formatCurrency(product.total)}</span>
                        </div>
                        <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="text-[10px] text-zinc-400 w-6 text-right shrink-0">{product.count}x</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}