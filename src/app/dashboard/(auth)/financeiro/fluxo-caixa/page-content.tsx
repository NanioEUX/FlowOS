"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { fetchAuth } from "@/lib/fetch-auth"
import { ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react"

type Period = "7days" | "30days" | "month" | "all"

interface DayFlow {
  date: string
  entradas: number
  saidas: number
  saldo: number
}

export default function FluxoCaixaPage() {
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

    fetchAuth(`/api/financial/cash-flow?${params}`)
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
  const maxVal = Math.max(...days.map((d: DayFlow) => Math.max(d.entradas, d.saidas)), 1)

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number)
    return `${d}/${m}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900">Fluxo de Caixa</h1>
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
      </div>

      {/* Summary */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-green-500" />
              <span className="text-xs text-zinc-500">Entradas</span>
            </div>
            <p className="mt-1 text-xl font-bold text-green-600">{formatCurrency(s.totalEntradas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ArrowDownRight className="h-4 w-4 text-red-500" />
              <span className="text-xs text-zinc-500">Saídas</span>
            </div>
            <p className="mt-1 text-xl font-bold text-red-500">{formatCurrency(s.totalSaidas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-zinc-500">Saldo</span>
            </div>
            <p className={`mt-1 text-xl font-bold ${s.saldo >= 0 ? "text-green-600" : "text-red-500"}`}>{formatCurrency(s.saldo)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 font-semibold text-sm text-zinc-900">Fluxo Diário</h3>
          {days.length === 0 ? (
            <p className="text-center text-sm text-zinc-400 py-4">Nenhum dado no período</p>
          ) : (
            <div className="space-y-1">
              {/* Legend */}
              <div className="mb-2 flex items-center gap-4 text-xs text-zinc-500">
                <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-green-500" /> Entradas</div>
                <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-red-400" /> Saídas</div>
              </div>
              {/* Bars */}
              <div className="max-h-96 space-y-1 overflow-y-auto">
                {days.map((day: DayFlow) => (
                  <div key={day.date} className="flex items-center gap-2">
                    <span className="w-10 text-right text-xs text-zinc-500">{formatDate(day.date)}</span>
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center gap-1">
                        <div className="h-3 rounded-r bg-green-500" style={{ width: `${(day.entradas / maxVal) * 100}%`, minWidth: day.entradas > 0 ? "4px" : "0" }} />
                        {day.entradas > 0 && <span className="text-[10px] text-green-600">{formatCurrency(day.entradas)}</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-3 rounded-r bg-red-400" style={{ width: `${(day.saidas / maxVal) * 100}%`, minWidth: day.saidas > 0 ? "4px" : "0" }} />
                        {day.saidas > 0 && <span className="text-[10px] text-red-400">{formatCurrency(day.saidas)}</span>}
                      </div>
                    </div>
                    <span className={`w-20 text-right text-xs font-medium ${day.saldo >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {formatCurrency(day.saldo)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}