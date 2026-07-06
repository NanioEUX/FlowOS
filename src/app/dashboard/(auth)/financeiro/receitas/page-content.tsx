"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { fetchAuth } from "@/lib/fetch-auth"
import { TrendingUp, ShoppingBag, DollarSign, Calendar, ChevronDown, ChevronUp, CreditCard, Banknote, Smartphone, Globe, X } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

type Period = "today" | "7days" | "30days" | "month" | "all"

interface DayData {
  date: string
  total: number
  count: number
  avgTicket: number
  byPayment: { money: number; card: number; pix: number; online: number }
  orders: any[]
}

export default function ReceitasPage() {
  const searchParams = useSearchParams()
  const hookEstablishmentId = useEstablishmentId()
  const establishmentId = searchParams.get("establishment") || hookEstablishmentId
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>("30days")
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<any>(null)

  useEffect(() => {
    if (!establishmentId) return
    setLoading(true)

    const now = new Date()
    let from = ""
    if (period === "today") from = now.toISOString().split("T")[0]
    else if (period === "7days") {
      const d = new Date(now.getTime() - 7 * 86400000)
      from = d.toISOString().split("T")[0]
    } else if (period === "30days") {
      const d = new Date(now.getTime() - 30 * 86400000)
      from = d.toISOString().split("T")[0]
    } else if (period === "month") {
      const d = new Date(now.getFullYear(), now.getMonth(), 1)
      from = d.toISOString().split("T")[0]
    }

    const params = new URLSearchParams({ establishmentId })
    if (from) params.set("from", from)

    fetchAuth(`/api/financial/revenues?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [establishmentId, period])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    )
  }

  if (!data) return <p className="text-zinc-500">Erro ao carregar dados</p>

  const { summary: s, days } = data

  const toggleDay = (date: string) => {
    setExpandedDay(expandedDay === date ? null : date)
  }

  const formatDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split("-").map(Number)
      const date = new Date(y, m - 1, d)
      return format(date, "EEE, dd MMM yyyy", { locale: ptBR })
    } catch {
      return dateStr
    }
  }

  const formatTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "HH:mm")
    } catch {
      return ""
    }
  }

  const paymentIcons: Record<string, any> = {
    money: Banknote,
    card: CreditCard,
    pix: Smartphone,
    online: Globe,
  }

  const paymentLabels: Record<string, string> = {
    money: "Dinheiro",
    card: "Cartão",
    pix: "Pix",
    online: "Online",
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900">Receitas</h1>
        <div className="flex gap-1">
          {([
            { value: "today", label: "Hoje" },
            { value: "7days", label: "7 dias" },
            { value: "30days", label: "30 dias" },
            { value: "month", label: "Mês atual" },
            { value: "all", label: "Tudo" },
          ] as const).map((p) => (
            <button key={p.value} onClick={() => setPeriod(p.value)} className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${period === p.value ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-white/[.08]"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-xs text-zinc-500">Receita Total</span>
            </div>
            <p className="mt-1 text-lg font-bold">{formatCurrency(s.totalReceita)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-zinc-500">Total Pedidos</span>
            </div>
            <p className="mt-1 text-lg font-bold">{s.totalPedidos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-zinc-500">Ticket Médio</span>
            </div>
            <p className="mt-1 text-lg font-bold">{formatCurrency(s.ticketMedio)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-500" />
              <span className="text-xs text-zinc-500">Dias com Venda</span>
            </div>
            <p className="mt-1 text-lg font-bold">{s.diasComVenda}</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily breakdown */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 font-semibold text-sm text-zinc-900">Resumo por Dia</h3>
          {days.length === 0 ? (
            <p className="text-center text-sm text-zinc-400 py-4">Nenhuma venda no período</p>
          ) : (
            <div className="space-y-2">
              {days.map((day: DayData) => (
                <div key={day.date} className="rounded-lg border border-zinc-200">
                  <button
                    onClick={() => toggleDay(day.date)}
                    className="flex w-full items-center justify-between p-3 text-left hover:bg-zinc-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium text-zinc-900">{formatDate(day.date)}</div>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                        {day.count} pedido{day.count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-green-600">{formatCurrency(day.total)}</span>
                      {expandedDay === day.date ? (
                        <ChevronUp className="h-4 w-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-zinc-400" />
                      )}
                    </div>
                  </button>
                  {expandedDay === day.date && (
                    <div className="border-t border-zinc-200 p-3">
                      {/* Payment breakdown */}
                      <div className="mb-3 grid grid-cols-4 gap-2">
                        {Object.entries(day.byPayment).filter(([, v]) => v > 0).map(([method, value]) => {
                          const Icon = paymentIcons[method] || DollarSign
                          return (
                            <div key={method} className="rounded-lg bg-zinc-50 p-2 text-center">
                              <Icon className="mx-auto h-3 w-3 text-zinc-400" />
                              <p className="text-[10px] text-zinc-500">{paymentLabels[method] || method}</p>
                              <p className="text-xs font-bold">{formatCurrency(value)}</p>
                            </div>
                          )
                        })}
                      </div>
                      {/* Orders list */}
                      <div className="max-h-60 space-y-1 overflow-y-auto">
                        {day.orders.map((order: any) => (
                          <button
                            key={order.id}
                            onClick={() => setSelectedOrder(order)}
                            className="flex w-full items-center justify-between rounded-lg p-2 text-left hover:bg-zinc-50"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-zinc-400">{formatTime(order.createdAt)}</span>
                              <span className="text-sm text-zinc-700">
                                {order.tableNumber ? `Mesa ${order.orderType === "mesa" ? "Comanda" : ""}` : "Balcão/Online"}
                              </span>
                            </div>
                            <span className="text-sm font-medium">{formatCurrency(order.total)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-zinc-900">Detalhes do Pedido</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Tipo</span>
                <span className="text-zinc-900">{selectedOrder.orderType === "mesa" ? `Mesa ${selectedOrder.tableNumber || ""}` : selectedOrder.orderType === "delivery" ? "Entrega" : "Balcão"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Status</span>
                <span className="text-zinc-900">{selectedOrder.status === "paid" ? "Pago" : selectedOrder.status === "delivered" ? "Entregue" : selectedOrder.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Pagamento</span>
                <span className="text-zinc-900">{paymentLabels[selectedOrder.paymentMethod] || selectedOrder.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Horário</span>
                <span className="text-zinc-900">{formatTime(selectedOrder.createdAt)}</span>
              </div>
            </div>
            <div className="mt-3 border-t border-zinc-200 pt-2">
              <div className="flex items-center justify-between text-sm font-bold">
                <span>Total</span>
                <span className="text-green-600">{formatCurrency(selectedOrder.total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}