"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { fetchAuth } from "@/lib/fetch-auth"
import { FileText, Download, TrendingUp, TrendingDown, DollarSign, ShoppingBag } from "lucide-react"

type Period = "7days" | "30days" | "month" | "all"

export default function RelatoriosPage() {
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
    if (period === "7days") { const d = new Date(now.getTime() - 7 * 86400000); from = d.toISOString().split("T")[0] }
    else if (period === "30days") { const d = new Date(now.getTime() - 30 * 86400000); from = d.toISOString().split("T")[0] }
    else if (period === "month") { const d = new Date(now.getFullYear(), now.getMonth(), 1); from = d.toISOString().split("T")[0] }

    const params = new URLSearchParams({ establishmentId })
    if (from) params.set("from", from)

    Promise.all([
      fetchAuth(`/api/financial/dre?${params}`).then(r => r.json()),
      fetchAuth(`/api/financial/revenues?${params}`).then(r => r.json()),
      fetchAuth(`/api/financial/cash-flow?${params}`).then(r => r.json()),
    ])
      .then(([dre, rev, cf]) => setData({ dre, rev, cf }))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [establishmentId, period])

  const exportCSV = () => {
    if (!data) return
    const { dre, rev, cf } = data
    const s = dre.summary

    const lines = [
      "RELATÓRIO FINANCEIRO",
      `Período: ${period === "7days" ? "Últimos 7 dias" : period === "30days" ? "Últimos 30 dias" : period === "month" ? "Mês atual" : "Todos"}`,
      "",
      "RESUMO",
      `Receita Bruta;${s.receitaBruta}`,
      `Descontos;${s.descontos}`,
      `Receita Líquida;${s.receitaLiquida}`,
      `Custo Entregas;${s.custoEntregas}`,
      `Despesas Operacionais;${s.despesasOperacionais}`,
      `Lucro Bruto;${s.lucroBruto}`,
      `Lucro Líquido;${s.lucroLiquido}`,
      "",
      "RECEITA POR TIPO",
      `Entrega;${dre.breakdown.byType.delivery}`,
      `Retirada;${dre.breakdown.byType.pickup}`,
      `Presencial;${dre.breakdown.byType.presencial}`,
      "",
      "RECEITA POR PAGAMENTO",
      `Dinheiro;${dre.breakdown.byPayment.money}`,
      `Cartão;${dre.breakdown.byPayment.card}`,
      `Pix;${dre.breakdown.byPayment.pix}`,
      `Online;${dre.breakdown.byPayment.online}`,
      "",
      "FLUXO DE CAIXA",
      `Total Entradas;${cf.summary.totalEntradas}`,
      `Total Saídas;${cf.summary.totalSaidas}`,
      `Saldo;${cf.summary.saldo}`,
      "",
      "DESPESAS POR CATEGORIA",
      ...Object.entries(dre.breakdown.expensesByCategory).filter(([,v]) => (v as number) > 0).map(([k, v]) => `${k};${v}`),
      "",
      "DETALHE POR DIA",
      "Data;Entradas;Saídas;Saldo",
      ...cf.days.map((d: any) => `${d.date};${d.entradas};${d.saidas};${d.saldo}`),
    ]

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `relatorio-financeiro-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    )
  }

  if (!data) return <p className="text-zinc-500">Erro ao carregar dados</p>

  const { dre, rev, cf } = data
  const s = dre.summary

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900">Relatórios</h1>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {([
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
          <button onClick={exportCSV} className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700">
            <Download className="h-3 w-3" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs text-zinc-500">Receita Bruta</span>
            </div>
            <p className="mt-1 text-lg font-bold">{formatCurrency(s.receitaBruta)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-xs text-zinc-500">Total Despesas</span>
            </div>
            <p className="mt-1 text-lg font-bold">{formatCurrency(s.despesasOperacionais + s.custoEntregas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-zinc-500">Lucro Líquido</span>
            </div>
            <p className={`mt-1 text-lg font-bold ${s.lucroLiquido >= 0 ? "text-green-600" : "text-red-500"}`}>{formatCurrency(s.lucroLiquido)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-zinc-500">Total Pedidos</span>
            </div>
            <p className="mt-1 text-lg font-bold">{dre.counts.orders}</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed sections */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 font-semibold text-sm text-zinc-900">Receita por Tipo</h3>
            <div className="space-y-2">
              {[
                { label: "Entrega", value: dre.breakdown.byType.delivery },
                { label: "Retirada", value: dre.breakdown.byType.pickup },
                { label: "Presencial", value: dre.breakdown.byType.presencial },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">{item.label}</span>
                  <span className="font-medium">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 font-semibold text-sm text-zinc-900">Receita por Pagamento</h3>
            <div className="space-y-2">
              {[
                { label: "Dinheiro", value: dre.breakdown.byPayment.money },
                { label: "Cartão", value: dre.breakdown.byPayment.card },
                { label: "Pix", value: dre.breakdown.byPayment.pix },
                { label: "Online", value: dre.breakdown.byPayment.online },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">{item.label}</span>
                  <span className="font-medium">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expenses */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 font-semibold text-sm text-zinc-900">Despesas por Categoria</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: "Fixas", value: dre.breakdown.expensesByCategory.fixa },
              { label: "Variáveis", value: dre.breakdown.expensesByCategory.variavel },
              { label: "Motoboy", value: dre.breakdown.expensesByCategory.motoboy },
              { label: "Insumos", value: dre.breakdown.expensesByCategory.insumo },
              { label: "Salários", value: dre.breakdown.expensesByCategory.salario },
              { label: "Aluguel", value: dre.breakdown.expensesByCategory.aluguel },
              { label: "Energia", value: dre.breakdown.expensesByCategory.energia },
              { label: "Água", value: dre.breakdown.expensesByCategory.agua },
              { label: "Internet", value: dre.breakdown.expensesByCategory.internet },
              { label: "Impostos", value: dre.breakdown.expensesByCategory.imposto },
              { label: "Manutenção", value: dre.breakdown.expensesByCategory.manutencao },
              { label: "Marketing", value: dre.breakdown.expensesByCategory.marketing },
              { label: "Outros", value: dre.breakdown.expensesByCategory.outro },
            ].filter((c) => c.value > 0).map((item) => (
              <div key={item.label} className="rounded-lg border border-zinc-200 p-2">
                <p className="text-[10px] text-zinc-500">{item.label}</p>
                <p className="text-xs font-bold text-red-400">{formatCurrency(item.value)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cash flow table */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 font-semibold text-sm text-zinc-900">Fluxo de Caixa por Dia</h3>
          {cf.days.length === 0 ? (
            <p className="text-center text-sm text-zinc-400 py-4">Nenhum dado</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="pb-2 text-left font-medium text-zinc-500">Data</th>
                    <th className="pb-2 text-right font-medium text-zinc-500">Entradas</th>
                    <th className="pb-2 text-right font-medium text-zinc-500">Saídas</th>
                    <th className="pb-2 text-right font-medium text-zinc-500">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {cf.days.map((day: any) => (
                    <tr key={day.date} className="border-b border-zinc-100">
                      <td className="py-1.5 text-zinc-700">{day.date.split("-").reverse().join("/")}</td>
                      <td className="py-1.5 text-right text-green-600">{formatCurrency(day.entradas)}</td>
                      <td className="py-1.5 text-right text-red-400">{formatCurrency(day.saidas)}</td>
                      <td className={`py-1.5 text-right font-medium ${day.saldo >= 0 ? "text-green-600" : "text-red-500"}`}>{formatCurrency(day.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}