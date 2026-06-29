"use client"

import { useEffect, useState } from "react"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { DollarSign, ShoppingBag, Users, Bike, TrendingUp, TrendingDown, RefreshCw, Package, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { fetchAuth } from "@/lib/fetch-auth"

interface DashboardData {
  today: {
    total: number
    count: number
    ticketMedio: number
    vsYesterday: {
      total: number
      count: number
      percentTotal: number
    }
  }
  active: {
    total: number
    byStatus: {
      preparing: number
      ready: number
      out_for_delivery: number
    }
  }
  customers: {
    total: number
    newToday: number
  }
  motoboys: {
    total: number
    free: number
  }
  recentOrders: any[]
  topProducts: { name: string; count: number; total: number }[]
  weekSales: { date: string; total: number; count: number }[]
}

export default function DashboardHomePage() {
  const establishmentId = useEstablishmentId()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function loadData() {
    if (!establishmentId) return
    setRefreshing(true)
    try {
      const res = await fetchAuth(`/api/dashboard?establishmentId=${establishmentId}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (e) {
      console.error("Erro ao carregar dashboard:", e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [establishmentId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-flow-blue border-t-transparent" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="py-20 text-center text-zinc-500">
        <p>Erro ao carregar dados</p>
        <Button onClick={loadData} className="mt-4">Tentar novamente</Button>
      </div>
    )
  }

  const salesPercent = data.today.vsYesterday.percentTotal

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-flow-white">Dashboard</h2>
          <p className="text-sm text-zinc-500">Visão geral do dia</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Vendas Hoje */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-flow-blue/10">
                <DollarSign className="h-5 w-5 text-flow-blue" />
              </div>
              {salesPercent !== 0 && (
                <span className={`flex items-center gap-0.5 text-xs font-medium ${salesPercent > 0 ? "text-flow-blue" : "text-red-500"}`}>
                  {salesPercent > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {salesPercent > 0 ? "+" : ""}{salesPercent}%
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-flow-white">{formatCurrency(data.today.total)}</p>
            <p className="text-xs text-zinc-500">{data.today.count} vendas hoje</p>
          </CardContent>
        </Card>

        {/* Ticket Médio */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-flow-blue/15">
                <ShoppingBag className="h-5 w-5 text-flow-blue" />
              </div>
            </div>
            <p className="text-2xl font-bold text-flow-white">{formatCurrency(data.today.ticketMedio)}</p>
            <p className="text-xs text-zinc-500">Ticket médio</p>
          </CardContent>
        </Card>

        {/* Pedidos Ativos */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15">
                <Package className="h-5 w-5 text-amber-400" />
              </div>
              <span className="text-xs font-bold text-amber-400 bg-amber-500/15 rounded-full px-2 py-0.5">
                {data.active.total}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <Clock className="h-3 w-3 text-amber-500" />
                <span className="text-zinc-400">Preparando:</span>
                <span className="font-medium">{data.active.byStatus.preparing}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Package className="h-3 w-3 text-flow-green" />
                <span className="text-zinc-400">Prontos:</span>
                <span className="font-medium">{data.active.byStatus.ready}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Bike className="h-3 w-3 text-blue-500" />
                <span className="text-zinc-400">Em entrega:</span>
                <span className="font-medium">{data.active.byStatus.out_for_delivery}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clientes + Motoboys */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-zinc-400" />
                  <span className="text-xs text-zinc-500">Clientes</span>
                </div>
                <p className="text-xl font-bold text-flow-white">{data.customers.total}</p>
                {data.customers.newToday > 0 && (
                  <p className="text-[10px] text-flow-blue">+{data.customers.newToday} hoje</p>
                )}
              </div>
              <div className="border-t border-white/[.04] pt-2">
                <div className="flex items-center gap-2 mb-1">
                  <Bike className="h-4 w-4 text-zinc-400" />
                  <span className="text-xs text-zinc-500">Motoboys</span>
                </div>
                <p className="text-xl font-bold text-flow-white">
                  {data.motoboys.free}
                  <span className="text-sm font-normal text-zinc-400"> / {data.motoboys.total}</span>
                </p>
                <p className="text-[10px] text-zinc-500">livres</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico semanal + Top produtos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Vendas 7 dias */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-zinc-300 mb-4">Vendas - Últimos 7 dias</h3>
            <div className="space-y-2">
              {data.weekSales.map((day) => {
                const maxTotal = Math.max(...data.weekSales.map((d) => d.total), 1)
                const percent = (day.total / maxTotal) * 100
                const isToday = day.date === new Date().toISOString().split("T")[0]
                const dayLabel = new Date(day.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" })
                return (
                  <div key={day.date} className="flex items-center gap-3">
                    <span className={`w-16 text-xs ${isToday ? "font-bold text-flow-blue" : "text-zinc-500"}`}>
                      {dayLabel}
                    </span>
                    <div className="flex-1 h-6 bg-white/[.05] rounded-md overflow-hidden">
                      <div
                        className={`h-full rounded-md transition-all ${isToday ? "bg-flow-green" : "bg-zinc-300"}`}
                        style={{ width: `${Math.max(percent, 2)}%` }}
                      />
                    </div>
                    <span className="w-20 text-right text-xs font-medium text-zinc-300">
                      {formatCurrency(day.total)}
                    </span>
                    <span className="w-8 text-right text-[10px] text-zinc-400">
                      {day.count}x
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top produtos */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-zinc-300 mb-4">Produtos mais vendidos (hoje)</h3>
            {data.topProducts.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-8">Nenhuma venda ainda hoje</p>
            ) : (
              <div className="space-y-3">
                {data.topProducts.map((product, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-flow-blue/10 text-xs font-bold text-flow-blue">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-flow-white truncate">{product.name}</p>
                      <p className="text-[10px] text-zinc-500">{product.count} vendidos</p>
                    </div>
                    <span className="text-sm font-medium text-flow-blue">{formatCurrency(product.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Últimos pedidos */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Últimos pedidos</h3>
          <div className="space-y-2">
            {data.recentOrders.map((order) => {
              const statusLabels: Record<string, string> = {
                pending: "Pendente",
                preparing: "Preparando",
                ready: "Pronto",
                out_for_delivery: "Em entrega",
                delivered: "Entregue",
                cancelled: "Cancelado",
              }
              const statusColors: Record<string, string> = {
                pending: "bg-white/[.05] text-zinc-400",
                preparing: "bg-amber-500/15 text-amber-400",
                ready: "bg-flow-blue/10 text-flow-blue",
                out_for_delivery: "bg-flow-blue/15 text-flow-blue",
                delivered: "bg-flow-blue/10 text-flow-blue",
                cancelled: "bg-red-500/15 text-red-400",
              }
              return (
                <div key={order.id} className="flex items-center justify-between rounded-lg border border-white/[.04] bg-white/[.03] px-3 py-2">
                  <div className="flex items-center gap-3">
                    {order.orderNumber && (
                      <span className="text-xs font-bold text-flow-blue">#{order.orderNumber}</span>
                    )}
                    <div>
                      <p className="text-sm font-medium text-flow-white">{order.customerName}</p>
                      <p className="text-[10px] text-zinc-400">
                        {new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-flow-blue">{formatCurrency(order.total)}</p>
                    <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusColors[order.status] || "bg-white/[.05] text-zinc-400"}`}>
                      {statusLabels[order.status] || order.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
