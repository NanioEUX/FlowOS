"use client"

import { useEffect, useState } from "react"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { DollarSign, ShoppingBag, Users, Bike, TrendingUp, TrendingDown, RefreshCw, Package, Clock, AlertTriangle, Wallet, Store, CreditCard, Banknote, Smartphone, Globe, Plus, BarChart3, ArrowRight, Zap } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { fetchAuth } from "@/lib/fetch-auth"
import { Sparkline } from "@/components/charts/sparkline"
import { Donut } from "@/components/charts/donut"
import { AreaChart } from "@/components/charts/area-chart"
import { Ring } from "@/components/charts/ring"

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

      {/* Linha 1 — Cards de resumo com sparkline */}
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
            <p className="text-[10px] text-zinc-400">{data.today.count} vendas hoje</p>
          </CardContent>
        </Card>

        {/* Ticket Médio */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="absolute right-2 top-2 opacity-30">
              <Sparkline data={sparkData.map((v: number, i: number) => data.weekSales[i]?.count ? v / data.weekSales[i].count : 0)} color="#8b5cf6" height={32} className="w-20" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10">
                <ShoppingBag className="h-4 w-4 text-purple-500" />
              </div>
            </div>
            <p className="text-xl font-bold text-zinc-900">{formatCurrency(data.today.ticketMedio)}</p>
            <p className="text-[10px] text-zinc-400">Ticket médio</p>
          </CardContent>
        </Card>

        {/* Pedidos Ativos */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="absolute right-2 top-2 opacity-30">
              <Sparkline data={[data.active.byStatus.preparing, data.active.byStatus.ready, data.active.byStatus.out_for_delivery]} color="#f59e0b" height={32} className="w-20" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                <Package className="h-4 w-4 text-amber-500" />
              </div>
              <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 rounded-full px-1.5 py-0.5">
                {data.active.total}
              </span>
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-[11px]">
                <Clock className="h-2.5 w-2.5 text-amber-500" />
                <span className="text-zinc-400">Preparando:</span>
                <span className="font-medium">{data.active.byStatus.preparing}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <Package className="h-2.5 w-2.5 text-green-600" />
                <span className="text-zinc-400">Prontos:</span>
                <span className="font-medium">{data.active.byStatus.ready}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <Bike className="h-2.5 w-2.5 text-blue-500" />
                <span className="text-zinc-400">Em entrega:</span>
                <span className="font-medium">{data.active.byStatus.out_for_delivery}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lucro Hoje */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="absolute right-2 top-2 opacity-30">
              <Sparkline data={sparkData} color={data.profit.today >= 0 ? "#16a34a" : "#ef4444"} height={32} className="w-20" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${data.profit.today >= 0 ? "bg-green-600/10" : "bg-red-500/10"}`}>
                <Wallet className={`h-4 w-4 ${data.profit.today >= 0 ? "text-green-600" : "text-red-500"}`} />
              </div>
            </div>
            <p className={`text-xl font-bold ${data.profit.today >= 0 ? "text-green-600" : "text-red-500"}`}>{formatCurrency(data.profit.today)}</p>
            <p className="text-[10px] text-zinc-400">Lucro líquido hoje</p>
          </CardContent>
        </Card>
      </div>

      {/* Linha 2 — Gráficos */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Receita 7 dias — Área */}
        <Card className="lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-zinc-700">Receita — 7 dias</h3>
              <span className="text-[10px] text-zinc-400">Mês: {formatCurrency(data.month?.total || 0)}</span>
            </div>
            <AreaChart data={data.weekSales || []} height={140} color="#16a34a" />
          </CardContent>
        </Card>

        {/* Pedidos por Tipo — Donut */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-zinc-700 mb-4">Pedidos por Tipo</h3>
            <div className="flex items-center justify-center gap-4">
              <Donut value={data.byType.delivery} total={data.today.count} color="#3b82f6" size={90} label={`${data.byType.delivery}`} sublabel="Entrega" />
              <Donut value={data.byType.pickup} total={data.today.count} color="#8b5cf6" size={90} label={`${data.byType.pickup}`} sublabel="Retirada" />
              <Donut value={data.byType.mesa + data.byType.balcao} total={data.today.count} color="#16a34a" size={90} label={`${data.byType.mesa + data.byType.balcao}`} sublabel="Local" />
            </div>
          </CardContent>
        </Card>

        {/* Pagamento — Donut */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-zinc-700 mb-4">Receita por Pagamento</h3>
            <div className="flex items-center justify-center gap-3">
              <div className="flex flex-col items-center gap-1">
                <Donut value={data.byPayment.money} total={data.today.total || 1} color="#16a34a" size={70} strokeWidth={5} />
                <span className="text-[10px] text-zinc-500">Dinheiro</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Donut value={data.byPayment.card} total={data.today.total || 1} color="#3b82f6" size={70} strokeWidth={5} />
                <span className="text-[10px] text-zinc-500">Cartão</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Donut value={data.byPayment.pix} total={data.today.total || 1} color="#8b5cf6" size={70} strokeWidth={5} />
                <span className="text-[10px] text-zinc-500">Pix</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Donut value={data.byPayment.online} total={data.today.total || 1} color="#f59e0b" size={70} strokeWidth={5} />
                <span className="text-[10px] text-zinc-500">Online</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Linha 3 — Status + Ações + Alertas */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Caixa + Motoboys */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-zinc-700 mb-3">Status Operacional</h3>
            <div className="space-y-3">
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
              {/* Motoboys */}
              <div className="flex items-center justify-between rounded-lg bg-zinc-50 p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                    <Bike className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-900">Motoboys</p>
                    <p className="text-[10px] text-zinc-400">{data.motoboys.busy} em entrega</p>
                  </div>
                </div>
                <Ring value={data.motoboys.free} total={data.motoboys.total || 1} color="#3b82f6" size={36} strokeWidth={4} />
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

        {/* Ações Rápidas */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-zinc-700 mb-3">Ações Rápidas</h3>
            <div className="grid grid-cols-2 gap-2">
              <a href="/dashboard/caixa" className="flex flex-col items-center gap-1.5 rounded-lg border border-zinc-200 p-3 text-center hover:bg-green-600/5 hover:border-green-600/30 transition-colors">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-600/10">
                  <Wallet className="h-4 w-4 text-green-600" />
                </div>
                <span className="text-[11px] font-medium text-zinc-700">Caixa</span>
              </a>
              <a href="/dashboard/pedidos" className="flex flex-col items-center gap-1.5 rounded-lg border border-zinc-200 p-3 text-center hover:bg-blue-500/5 hover:border-blue-500/30 transition-colors">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                  <ShoppingBag className="h-4 w-4 text-blue-500" />
                </div>
                <span className="text-[11px] font-medium text-zinc-700">Pedidos</span>
              </a>
              <a href="/dashboard/entregas" className="flex flex-col items-center gap-1.5 rounded-lg border border-zinc-200 p-3 text-center hover:bg-amber-500/5 hover:border-amber-500/30 transition-colors">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                  <Bike className="h-4 w-4 text-amber-500" />
                </div>
                <span className="text-[11px] font-medium text-zinc-700">Entregas</span>
              </a>
              <a href="/dashboard/cardapio" className="flex flex-col items-center gap-1.5 rounded-lg border border-zinc-200 p-3 text-center hover:bg-purple-500/5 hover:border-purple-500/30 transition-colors">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10">
                  <Store className="h-4 w-4 text-purple-500" />
                </div>
                <span className="text-[11px] font-medium text-zinc-700">Cardápio</span>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Alertas */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-zinc-700 mb-3">Alertas</h3>
            <div className="space-y-2">
              {data.alerts.lowStock > 0 && (
                <a href="/dashboard/estoque" className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 hover:bg-amber-500/10 transition-colors">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-zinc-900">Estoque baixo</p>
                    <p className="text-[10px] text-zinc-400">{data.alerts.lowStock} item(ns) abaixo do mínimo</p>
                  </div>
                  <ArrowRight className="h-3 w-3 text-zinc-400" />
                </a>
              )}
              {data.active.byStatus.ready > 0 && (
                <a href="/dashboard/entregas" className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-2.5 hover:bg-blue-500/10 transition-colors">
                  <Package className="h-4 w-4 text-blue-500" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-zinc-900">Pedidos prontos</p>
                    <p className="text-[10px] text-zinc-400">{data.active.byStatus.ready} aguardando retirada/entrega</p>
                  </div>
                  <ArrowRight className="h-3 w-3 text-zinc-400" />
                </a>
              )}
              {data.active.byStatus.preparing > 0 && (
                <a href="/dashboard/pedidos" className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 hover:bg-amber-500/10 transition-colors">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-zinc-900">Em preparo</p>
                    <p className="text-[10px] text-zinc-400">{data.active.byStatus.preparing} pedidos sendo preparados</p>
                  </div>
                  <ArrowRight className="h-3 w-3 text-zinc-400" />
                </a>
              )}
              {data.alerts.lowStock === 0 && data.active.byStatus.ready === 0 && data.active.byStatus.preparing === 0 && (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Zap className="h-6 w-6 text-green-500 mb-2" />
                  <p className="text-xs font-medium text-green-600">Tudo tranquilo!</p>
                  <p className="text-[10px] text-zinc-400">Nenhum alerta no momento</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Linha 4 — Top Produtos + Últimos pedidos */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
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
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600/10 text-[10px] font-bold text-green-600">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-xs font-medium text-zinc-900 truncate">{product.name}</p>
                          <span className="text-[10px] font-medium text-green-600 ml-2">{formatCurrency(product.total)}</span>
                        </div>
                        <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <div className="h-full bg-green-600 rounded-full" style={{ width: `${pct}%`, transition: "width 0.8s ease" }} />
                        </div>
                      </div>
                      <span className="text-[10px] text-zinc-400 w-6 text-right">{product.count}x</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Últimos pedidos */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-zinc-700">Últimos pedidos</h3>
              <a href="/dashboard/pedidos" className="text-[10px] text-green-600 hover:underline">Ver todos</a>
            </div>
            <div className="space-y-1.5">
              {data.recentOrders.map((order: any) => {
                const statusLabels: Record<string, string> = { pending: "Pendente", preparing: "Preparando", ready: "Pronto", out_for_delivery: "Em entrega", delivered: "Entregue", cancelled: "Cancelado", new: "Novo", payment_pending: "Aguard. Pgto", confirmed: "Confirmado" }
                const statusColors: Record<string, string> = { pending: "bg-zinc-100 text-zinc-500", preparing: "bg-amber-100 text-amber-700", ready: "bg-green-100 text-green-700", out_for_delivery: "bg-blue-100 text-blue-700", delivered: "bg-green-100 text-green-700", cancelled: "bg-red-100 text-red-700", new: "bg-zinc-100 text-zinc-500", payment_pending: "bg-red-100 text-red-700", confirmed: "bg-blue-100 text-blue-700" }
                const typeLabels: Record<string, string> = { delivery: "Entrega", pickup: "Retirada", presencial: "Mesa", mesa: "Mesa", balcao: "Balcão" }
                return (
                  <div key={order.id} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {order.orderNumber && <span className="text-[10px] font-bold text-green-600">#{order.orderNumber}</span>}
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-zinc-900 truncate">{order.customerName}</p>
                        <p className="text-[10px] text-zinc-400">
                          {new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          {order.orderType && <span className="ml-1 text-zinc-300">• {typeLabels[order.orderType] || order.orderType}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${statusColors[order.status] || "bg-zinc-100 text-zinc-500"}`}>
                        {statusLabels[order.status] || order.status}
                      </span>
                      <span className="text-xs font-bold text-green-600">{formatCurrency(order.total)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}