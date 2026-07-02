"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, Percent, Bike, Package, Calendar } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { fetchAuth } from "@/lib/fetch-auth"

type Period = "today" | "7days" | "30days" | "all"

export default function FinanceiroPage() {
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
    else if (period === "7days") {
      const d = new Date(now.getTime() - 7 * 86400000)
      from = d.toISOString().split("T")[0]
    } else if (period === "30days") {
      const d = new Date(now.getTime() - 30 * 86400000)
      from = d.toISOString().split("T")[0]
    }

    const params = new URLSearchParams({ establishmentId })
    if (from) params.set("from", from)

    fetchAuth(`/api/financial/dre?${params}`)
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

  const { summary: s, breakdown: b, counts } = data
  const isPositive = s.lucroLiquido >= 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900">DRE — Demonstrativo</h1>
        <div className="flex gap-1">
          {([
            { value: "today", label: "Hoje" },
            { value: "7days", label: "7 dias" },
            { value: "30days", label: "30 dias" },
            { value: "all", label: "Tudo" },
          ] as const).map((p) => (
            <button key={p.value} onClick={() => setPeriod(p.value)} className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${period === p.value ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-white/[.08]"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* DRE Table */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 font-semibold text-sm text-zinc-900">Demonstração do Resultado</h3>
          <div className="space-y-1 text-sm">
            <Row label={`(+) Receita Bruta (${counts.orders} pedidos)`} value={s.receitaBruta} color="text-zinc-900" bold />
            <Row label="(-) Descontos (cupons)" value={-s.descontos} color="text-red-500" />
            <Row label="(=) Receita Líquida" value={s.receitaLiquida} color="text-zinc-900" bold />
            <div className="border-t border-white/[.04] my-2" />
            <Row label="(-) Custo Entregas (motoboys)" value={-s.custoEntregas} color="text-orange-600" />
            <Row label="(=) Lucro Bruto" value={s.lucroBruto} color={s.lucroBruto >= 0 ? "text-green-600" : "text-red-400"} bold />
            <div className="border-t border-white/[.04] my-2" />
            <Row label="(-) Despesas Operacionais" value={-s.despesasOperacionais} color="text-red-500" />
            <div className="border-t border-zinc-200 my-2" />
            <Row label="(=) LUCRO LÍQUIDO" value={s.lucroLiquido} color={isPositive ? "text-green-600" : "text-red-400"} bold large />
          </div>
        </CardContent>
      </Card>

      {/* Revenue by type */}
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
            <h3 className="mb-3 font-semibold text-sm text-zinc-900">Despesas por Categoria</h3>
            <div className="space-y-2">
              {[
                { label: "Fixas", value: b.expensesByCategory.fixa },
                { label: "Variáveis", value: b.expensesByCategory.variavel },
                { label: "Motoboy", value: b.expensesByCategory.motoboy },
                { label: "Insumos", value: b.expensesByCategory.insumo },
                { label: "Outros", value: b.expensesByCategory.outro },
              ].filter((c) => c.value > 0).map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm">{item.label}</span>
                  <span className="text-sm font-bold text-red-400">{formatCurrency(item.value)}</span>
                </div>
              ))}
              {Object.values(b.expensesByCategory).every((v) => v === 0) && (
                <p className="text-xs text-zinc-400 text-center py-2">Nenhuma despesa registrada</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by payment method */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 font-semibold text-sm text-zinc-900">Receita por Pagamento</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Dinheiro", value: b.byPayment.money },
              { label: "Cartão", value: b.byPayment.card },
              { label: "Pix", value: b.byPayment.pix },
              { label: "Online", value: b.byPayment.online },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-white/[.04] p-2 text-center">
                <p className="text-[10px] text-zinc-500">{item.label}</p>
                <p className="text-sm font-bold">{formatCurrency(item.value)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value, color, bold, large }: { label: string; value: number; color: string; bold?: boolean; large?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-semibold" : ""} ${large ? "text-base" : ""}`}>
      <span className="text-zinc-400">{label}</span>
      <span className={color}>{formatCurrency(value)}</span>
    </div>
  )
}
