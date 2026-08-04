"use client"

import { useEffect, useState } from "react"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { fetchAuth } from "@/lib/fetch-auth"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Package, TrendingUp, DollarSign, Percent, AlertTriangle } from "lucide-react"

type Period = "today" | "7days" | "30days" | "all"

export default function CmvPageContent() {
  const establishmentId = useEstablishmentId()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>("30days")

  useEffect(() => {
    if (!establishmentId) return
    setLoading(true)
    const now = new Date()
    let from = ""
    if (period === "today") {
      from = now.toISOString().split("T")[0]
    } else if (period === "7days") {
      from = new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0]
    } else if (period === "30days") {
      from = new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0]
    }

    const params = new URLSearchParams({ establishmentId })
    if (from) params.set("from", from)

    fetchAuth(`/api/financial/cmv?${params}`)
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

  const { summary: s, byDay, topProducts } = data

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">CMV — Custo de Mercadoria Vendida</h1>
          <p className="text-xs text-zinc-500">Custo baseado na ficha técnica (insumos vinculados)</p>
        </div>
        <div className="flex gap-1">
          {([
            { value: "today", label: "Hoje" },
            { value: "7days", label: "7 dias" },
            { value: "30days", label: "30 dias" },
            { value: "all", label: "Tudo" },
          ] as const).map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${period === p.value ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500">Receita</p>
              <DollarSign className="h-4 w-4 text-zinc-400" />
            </div>
            <p className="mt-1 text-lg font-bold text-zinc-900">{formatCurrency(s.revenueCents / 100)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500">CMV</p>
              <Package className="h-4 w-4 text-zinc-400" />
            </div>
            <p className="mt-1 text-lg font-bold text-zinc-900">{formatCurrency(s.costCents / 100)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500">Margem</p>
              <TrendingUp className="h-4 w-4 text-zinc-400" />
            </div>
            <p className={`mt-1 text-lg font-bold ${s.marginCents >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(s.marginCents / 100)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500">Margem %</p>
              <Percent className="h-4 w-4 text-zinc-400" />
            </div>
            <p className={`mt-1 text-lg font-bold ${s.marginPercent >= 0 ? "text-green-600" : "text-red-600"}`}>
              {s.marginPercent.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {s.ordersWithoutRecipe > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {s.ordersWithoutRecipe} pedido(s) sem ficha técnica cadastrada. Cadastre os insumos em{" "}
            <strong>Cardápio → produto → "Vincular insumos"</strong> pra calcular o CMV corretamente.
          </p>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-zinc-900">CMV por dia</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="py-2">Dia</th>
                  <th>Pedidos</th>
                  <th>Receita</th>
                  <th>CMV</th>
                  <th>Margem</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {byDay.map((d: any) => (
                  <tr key={d.day} className="border-t border-zinc-100">
                    <td className="py-2">{new Date(d.day).toLocaleDateString("pt-BR")}</td>
                    <td>{d.orderCount}</td>
                    <td>{formatCurrency(d.revenueCents / 100)}</td>
                    <td>{formatCurrency(d.costCents / 100)}</td>
                    <td className={d.marginCents >= 0 ? "text-green-600" : "text-red-600"}>
                      {formatCurrency(d.marginCents / 100)}
                    </td>
                    <td className={d.marginPercent >= 0 ? "text-green-600" : "text-red-600"}>
                      {d.marginPercent.toFixed(1)}%
                    </td>
                  </tr>
                ))}
                {byDay.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-500">
                      Nenhum pedido no período
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-zinc-900">Top produtos por custo</h3>
          <div className="space-y-2">
            {topProducts.map((p: any, i: number) => (
              <div key={i} className="flex items-center justify-between border-t border-zinc-100 pt-2">
                <div>
                  <p className="text-sm font-medium text-zinc-900">{p.productName}</p>
                  <p className="text-xs text-zinc-500">{p.quantity} unidade(s)</p>
                </div>
                <p className="text-sm font-bold text-zinc-900">{formatCurrency(p.totalCostCents / 100)}</p>
              </div>
            ))}
            {topProducts.length === 0 && (
              <p className="py-4 text-center text-sm text-zinc-500">
                Sem ficha técnica cadastrada. Cadastre os insumos nos produtos.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
