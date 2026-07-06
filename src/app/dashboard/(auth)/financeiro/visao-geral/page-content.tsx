"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { fetchAuth } from "@/lib/fetch-auth"
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, Percent, Bike, Package, CreditCard, Banknote, Smartphone, Globe } from "lucide-react"

type Period = "today" | "7days" | "30days" | "month" | "all"

export default function VisaoGeralPage() {
  const searchParams = useSearchParams()
  const hookEstablishmentId = useEstablishmentId()
  const establishmentId = searchParams.get("establishment") || hookEstablishmentId
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>("30days")

  useEffect(() => {
    if (!establishmentId) return
    setLoading(true)

    const now = new Date()
    let from = ""
    if (period === "today") from = now.toISOString().split("T")[0]
    else if (period === "7days") { const d = new Date(now.getTime() - 7 * 86400000); from = d.toISOString().split("T")[0] }
    else if (period === "30days") { const d = new Date(now.getTime() - 30 * 86400000); from = d.toISOString().split("T")[0] }
    else if (period === "month") { const d = new Date(now.getFullYear(), now.getMonth(), 1); from = d.toISOString().split("T")[0] }

    const params = new URLSearchParams({ establishmentId })
    if (from) params.set("from", from)

    Promise.all([
      fetchAuth(`/api/financial/dre?${params}`).then(r => r.json()),
      fetchAuth(`/api/financial/revenues?${params}`).then(r => r.json()),
    ])
      .then(([dre, rev]) => {
        setData({ dre, rev })
      })
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

  const { dre, rev } = data
  const s = dre.summary
  const b = dre.breakdown
  const isPositive = s.lucroLiquido >= 0

  const paymentIcons: Record<string, any> = { money: Banknote, card: CreditCard, pix: Smartphone, online: Globe }
  const paymentLabels: Record<string, string> = { money: "Dinheiro", card: "Cartão", pix: "Pix", online: "Online" }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900">Visão Geral</h1>
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

      {/* Main Cards */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs text-zinc-500">Receita Bruta</span>
            </div>
            <p className="mt-1 text-xl font-bold text-green-600">{formatCurrency(s.receitaBruta)}</p>
            <p className="text-xs text-zinc-400">{dre.counts.orders} pedidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-orange-500" />
              <span className="text-xs text-zinc-500">Descontos</span>
            </div>
            <p className="mt-1 text-xl font-bold text-orange-500">-{formatCurrency(s.descontos)}</p>
            <p className="text-xs text-zinc-400">cupons aplicados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Bike className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-zinc-500">Custo Entregas</span>
            </div>
            <p className="mt-1 text-xl font-bold text-blue-500">-{formatCurrency(s.custoEntregas)}</p>
            <p className="text-xs text-zinc-400">{dre.counts.deliveryPayments} pagamentos motoboy</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-xs text-zinc-500">Despesas</span>
            </div>
            <p className="mt-1 text-xl font-bold text-red-500">-{formatCurrency(s.despesasOperacionais)}</p>
            <p className="text-xs text-zinc-400">{dre.counts.expenses} despesas</p>
          </CardContent>
        </Card>
      </div>

      {/* Profit */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-500">Lucro Líquido</p>
              <p className={`text-2xl font-bold ${isPositive ? "text-green-600" : "text-red-500"}`}>
                {formatCurrency(s.lucroLiquido)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-500">Ticket Médio</p>
              <p className="text-lg font-bold text-zinc-900">
                {rev.summary.totalPedidos > 0 ? formatCurrency(rev.summary.totalReceita / rev.summary.totalPedidos) : formatCurrency(0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue by type + payment */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 font-semibold text-sm text-zinc-900">Receita por Tipo</h3>
            <div className="space-y-2">
              {[
                { label: "Entrega", value: b.byType.delivery, icon: Bike, color: "blue" },
                { label: "Retirada", value: b.byType.pickup, icon: Package, color: "purple" },
                { label: "Presencial", value: b.byType.presencial, icon: ShoppingBag, color: "green" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <item.icon className={`h-4 w-4 text-${item.color}-500`} />
                    <span className="text-sm">{item.label}</span>
                  </div>
                  <span className="text-sm font-bold">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 font-semibold text-sm text-zinc-900">Receita por Pagamento</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Dinheiro", value: b.byPayment.money, icon: Banknote },
                { label: "Cartão", value: b.byPayment.card, icon: CreditCard },
                { label: "Pix", value: b.byPayment.pix, icon: Smartphone },
                { label: "Online", value: b.byPayment.online, icon: Globe },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-zinc-200 p-2 text-center">
                  <item.icon className="mx-auto h-3 w-3 text-zinc-400" />
                  <p className="text-[10px] text-zinc-500">{item.label}</p>
                  <p className="text-xs font-bold">{formatCurrency(item.value)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expenses by category */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 font-semibold text-sm text-zinc-900">Despesas por Categoria</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: "Fixas", value: b.expensesByCategory.fixa },
              { label: "Variáveis", value: b.expensesByCategory.variavel },
              { label: "Motoboy", value: b.expensesByCategory.motoboy },
              { label: "Insumos", value: b.expensesByCategory.insumo },
              { label: "Salários", value: b.expensesByCategory.salario },
              { label: "Aluguel", value: b.expensesByCategory.aluguel },
              { label: "Energia", value: b.expensesByCategory.energia },
              { label: "Água", value: b.expensesByCategory.agua },
              { label: "Internet", value: b.expensesByCategory.internet },
              { label: "Impostos", value: b.expensesByCategory.imposto },
              { label: "Manutenção", value: b.expensesByCategory.manutencao },
              { label: "Marketing", value: b.expensesByCategory.marketing },
              { label: "Outros", value: b.expensesByCategory.outro },
            ].filter((c) => c.value > 0).map((item) => (
              <div key={item.label} className="rounded-lg border border-zinc-200 p-2">
                <p className="text-[10px] text-zinc-500">{item.label}</p>
                <p className="text-xs font-bold text-red-400">{formatCurrency(item.value)}</p>
              </div>
            ))}
            {Object.values(b.expensesByCategory).every((v) => v === 0) && (
              <p className="col-span-full text-center text-xs text-zinc-400 py-2">Nenhuma despesa registrada</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}