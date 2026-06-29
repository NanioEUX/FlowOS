"use client"

import { useEffect, useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import {
  DollarSign, Clock, TrendingUp, TrendingDown, History, BarChart3,
  Minus, Plus, Trash2, Wallet, ArrowRight, Loader2, ChevronDown, ChevronUp,
  Banknote, CreditCard, CheckCircle, AlertTriangle, Filter
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/utils"
import { fetchAuth } from "@/lib/fetch-auth"

type Tab = "atual" | "historico" | "resumo"
type DateFilter = "today" | "7days" | "30days" | "all" | "custom"

const paymentLabels: Record<string, string> = { cash: "Dinheiro", card: "Cartão", pix: "Pix", online: "Online" }
const paymentIcons: Record<string, any> = { cash: Banknote, card: CreditCard, pix: Wallet, online: DollarSign }
const typeLabels: Record<string, string> = { sale: "Venda", expense: "Despesa", withdrawal: "Sangria", injection: "Suprimento", refund: "Estorno" }
const typeColors: Record<string, string> = { sale: "text-flow-blue", expense: "text-red-400", withdrawal: "text-red-400", injection: "text-flow-blue", refund: "text-amber-400" }

function getDateRange(filter: DateFilter, customStart: string, customEnd: string): { start: Date; end: Date } {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)

  switch (filter) {
    case "today": return { start, end }
    case "7days": { const s = new Date(start); s.setDate(s.getDate() - 6); return { start: s, end } }
    case "30days": { const s = new Date(start); s.setDate(s.getDate() - 29); return { start: s, end } }
    case "custom": {
      const s = customStart ? new Date(customStart + "T00:00:00") : start
      const e = customEnd ? new Date(customEnd + "T23:59:59") : end
      return { start: s, end: e }
    }
    case "all": default: return { start: new Date(0), end }
  }
}

function isInRange(dateStr: string, start: Date, end: Date): boolean {
  const d = new Date(dateStr)
  return d >= start && d <= end
}

export default function CaixaGerencialPage() {
  const searchParams = useSearchParams()
  const hookEstablishmentId = useEstablishmentId()
  const establishmentId = searchParams.get("establishment") || hookEstablishmentId

  const [tab, setTab] = useState<Tab>("atual")
  const [loading, setLoading] = useState(true)
  const [cashRegister, setCashRegister] = useState<any>(null)
  const [allOrders, setAllOrders] = useState<any[]>([])
  const [dateFilter, setDateFilter] = useState<DateFilter>("today")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")

  const [historyRegisters, setHistoryRegisters] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [expandedRegister, setExpandedRegister] = useState<string | null>(null)
  const [expandedMovements, setExpandedMovements] = useState<Record<string, any[]>>({})

  const [summary, setSummary] = useState<any>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const [sangriaModal, setSangriaModal] = useState(false)
  const [suprimentoModal, setSuprimentoModal] = useState(false)
  const [despesaModal, setDespesaModal] = useState(false)
  const [despesaDesc, setDespesaDesc] = useState("")
  const [despesaAmount, setDespesaAmount] = useState("")
  const [movAmount, setMovAmount] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function loadCurrent() {
    if (!establishmentId) return
    const [regRes, ordRes] = await Promise.all([
      fetchAuth(`/api/cash-register?establishmentId=${establishmentId}`),
      fetchAuth(`/api/orders?establishmentId=${establishmentId}`),
    ])
    if (regRes.ok) setCashRegister(await regRes.json())
    if (ordRes.ok) setAllOrders(await ordRes.json())
    setLoading(false)
  }

  useEffect(() => { loadCurrent() }, [establishmentId])
  useEffect(() => { const i = setInterval(loadCurrent, 15000); return () => clearInterval(i) }, [establishmentId])

  const { start: dateStart, end: dateEnd } = getDateRange(dateFilter, customStart, customEnd)

  const todayOrders = useMemo(() => {
    return allOrders.filter((o: any) =>
      o.orderType === "presencial" && o.status !== "cancelled" && isInRange(o.createdAt, dateStart, dateEnd)
    )
  }, [allOrders, dateStart.getTime(), dateEnd.getTime()])

  const cashSales = todayOrders.filter((o: any) => o.paymentMethod === "cash").reduce((s: number, o: any) => s + o.total, 0)
  const cardSales = todayOrders.filter((o: any) => o.paymentMethod === "card").reduce((s: number, o: any) => s + o.total, 0)
  const pixSales = todayOrders.filter((o: any) => o.paymentMethod === "pix").reduce((s: number, o: any) => s + o.total, 0)
  const totalSales = cashSales + cardSales + pixSales

  const registerMovements = cashRegister?.movements || []
  const totalInjection = registerMovements.filter((m: any) => m.type === "injection").reduce((s: number, m: any) => s + m.amount, 0)
  const totalWithdrawal = registerMovements.filter((m: any) => m.type === "withdrawal").reduce((s: number, m: any) => s + Math.abs(m.amount), 0)
  const totalExpense = registerMovements.filter((m: any) => m.type === "expense").reduce((s: number, m: any) => s + Math.abs(m.amount), 0)
  const currentBalance = cashRegister ? cashRegister.openingAmount + registerMovements.reduce((s: number, m: any) => s + m.amount, 0) : 0

  const movementsByType = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const m of registerMovements) {
      if (!map[m.type]) map[m.type] = []
      map[m.type].push(m)
    }
    return map
  }, [registerMovements])

  async function addMovement(type: "withdrawal" | "injection" | "expense") {
    if (!cashRegister || !movAmount) return
    setSubmitting(true)
    try {
      const body: any = { type, amount: parseFloat(movAmount) }
      if (type === "expense") body.description = despesaDesc || "Despesa"
      await fetchAuth(`/api/cash-register/${cashRegister.id}/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      setMovAmount("")
      setDespesaDesc("")
      setSangriaModal(false)
      setSuprimentoModal(false)
      setDespesaModal(false)
      loadCurrent()
    } finally {
      setSubmitting(false)
    }
  }

  async function loadHistory() {
    if (!establishmentId) return
    setHistoryLoading(true)
    try {
      const { start, end } = getDateRange(dateFilter, customStart, customEnd)
      const res = await fetchAuth(`/api/cash-register/history?establishmentId=${establishmentId}&page=${historyPage}&limit=20&start=${start.toISOString()}&end=${end.toISOString()}`)
      if (res.ok) {
        const data = await res.json()
        setHistoryRegisters(data.registers)
        setHistoryTotal(data.total)
      }
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (tab === "historico") loadHistory()
  }, [tab, dateFilter, customStart, customEnd, historyPage, establishmentId])

  async function loadRegisterDetails(registerId: string) {
    if (expandedRegister === registerId) {
      setExpandedRegister(null)
      return
    }
    setExpandedRegister(registerId)
    if (!expandedMovements[registerId]) {
      const res = await fetchAuth(`/api/cash-register/${registerId}/movements`)
      if (res.ok) {
        const data = await res.json()
        setExpandedMovements((prev) => ({ ...prev, [registerId]: data }))
      }
    }
  }

  async function loadSummary() {
    if (!establishmentId) return
    setSummaryLoading(true)
    try {
      const { start, end } = getDateRange(dateFilter, customStart, customEnd)
      const res = await fetchAuth(`/api/cash-register/summary?establishmentId=${establishmentId}&start=${start.toISOString()}&end=${end.toISOString()}`)
      if (res.ok) setSummary(await res.json())
    } finally {
      setSummaryLoading(false)
    }
  }

  useEffect(() => {
    if (tab === "resumo") loadSummary()
  }, [tab, dateFilter, customStart, customEnd, establishmentId])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-flow-blue border-t-transparent" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-flow-white">Caixa</h2>
        <p className="text-sm text-zinc-500">Vendas são feitas na Frente de Caixa</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: "atual" as Tab, icon: DollarSign, label: "Caixa Atual" },
          { key: "historico" as Tab, icon: History, label: "Histórico" },
          { key: "resumo" as Tab, icon: BarChart3, label: "Resumo" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === t.key ? "bg-flow-blue text-white" : "bg-white/[.05] text-zinc-400 hover:bg-white/[.08]"}`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Date Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {(["today", "7days", "30days", "all"] as DateFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setDateFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${dateFilter === f ? "bg-flow-blue text-white" : "bg-white/[.05] text-zinc-400 hover:bg-white/[.08]"}`}
          >
            {f === "today" ? "Hoje" : f === "7days" ? "7 dias" : f === "30days" ? "30 dias" : "Tudo"}
          </button>
        ))}
        <button
          onClick={() => { setDateFilter(dateFilter === "custom" ? "today" : "custom") }}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${dateFilter === "custom" ? "bg-flow-blue text-white" : "bg-white/[.05] text-zinc-400 hover:bg-white/[.08]"}`}
        >
          <Filter className="h-3 w-3" />
        </button>
        {dateFilter === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-36 text-xs" />
            <span className="text-xs text-zinc-400">até</span>
            <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-36 text-xs" />
          </div>
        )}
      </div>

      {/* ===== TAB: CAIXA ATUAL ===== */}
      {tab === "atual" && (
        <>
          {/* Balance summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="border-flow-blue/20 bg-flow-blue/10">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-flow-blue mb-1">Saldo Atual</p>
                <p className="text-xl font-bold text-flow-blue">{formatCurrency(currentBalance)}</p>
              </CardContent>
            </Card>
            <Card className="border-flow-blue/20 bg-flow-blue/10">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-flow-blue mb-1">Suprimentos</p>
                <p className="text-xl font-bold text-flow-blue">{formatCurrency(totalInjection)}</p>
              </CardContent>
            </Card>
            <Card className="border-red-500/20 bg-red-500/10">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-red-400 mb-1">Sangrias</p>
                <p className="text-xl font-bold text-red-400">{formatCurrency(totalWithdrawal)}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-500/20 bg-amber-500/10">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-amber-400 mb-1">Despesas</p>
                <p className="text-xl font-bold text-amber-400">{formatCurrency(totalExpense)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Action buttons */}
          {cashRegister && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-1.5 text-red-400 border-red-500/20 hover:bg-red-500/10" onClick={() => { setMovAmount(""); setSangriaModal(true) }}>
                <Minus className="h-4 w-4" /> Sangria
              </Button>
              <Button variant="outline" className="gap-1.5 text-flow-blue border-flow-blue/20 hover:bg-flow-blue/10" onClick={() => { setMovAmount(""); setSuprimentoModal(true) }}>
                <Plus className="h-4 w-4" /> Suprimento
              </Button>
              <Button variant="outline" className="gap-1.5 text-amber-400 border-amber-500/20 hover:bg-amber-500/10" onClick={() => { setMovAmount(""); setDespesaDesc(""); setDespesaModal(true) }}>
                <Trash2 className="h-4 w-4" /> Despesa
              </Button>
            </div>
          )}

          {!cashRegister && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <p className="text-sm text-yellow-700">Caixa fechado. Abra o caixa na <a href="/caixa" className="font-medium underline">Frente de Caixa</a> para iniciar.</p>
              </CardContent>
            </Card>
          )}

          {/* Movements by type */}
          {cashRegister && registerMovements.length > 0 && (
            <div className="space-y-3">
              {(["sale", "injection", "withdrawal", "expense"] as const).map((type) => {
                const items = movementsByType[type] || []
                if (items.length === 0) return null
                return (
                  <Card key={type}>
                    <CardContent className="p-4">
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-300 mb-2">
                        {type === "sale" ? <TrendingUp className="h-4 w-4 text-flow-blue" /> :
                         type === "injection" ? <Plus className="h-4 w-4 text-flow-blue" /> :
                         <Minus className="h-4 w-4 text-red-400" />}
                        {typeLabels[type]} ({items.length})
                      </h4>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {items.map((m: any) => (
                          <div key={m.id} className="flex items-center justify-between rounded-lg bg-white/[.03] px-3 py-2 text-sm">
                            <div>
                              <p className="text-zinc-300">{m.description || typeLabels[m.type]}</p>
                              <p className="text-xs text-zinc-400">{new Date(m.createdAt).toLocaleTimeString("pt-BR")}{m.paymentMethod && ` • ${paymentLabels[m.paymentMethod] || m.paymentMethod}`}</p>
                            </div>
                            <span className={`font-semibold ${typeColors[m.type]}`}>
                              {m.type === "sale" ? "+" : "-"}{formatCurrency(Math.abs(m.amount))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Today's sales by payment method */}
          {todayOrders.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold text-zinc-300 mb-3">Vendas Presenciais do Dia ({todayOrders.length})</h4>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="rounded-lg bg-white/[.03] p-3 text-center">
                    <p className="text-lg font-bold text-flow-blue">{formatCurrency(cashSales)}</p>
                    <p className="text-xs text-zinc-500">Dinheiro</p>
                  </div>
                  <div className="rounded-lg bg-white/[.03] p-3 text-center">
                    <p className="text-lg font-bold text-flow-blue">{formatCurrency(cardSales)}</p>
                    <p className="text-xs text-zinc-500">Cartão</p>
                  </div>
                  <div className="rounded-lg bg-white/[.03] p-3 text-center">
                    <p className="text-lg font-bold text-purple-600">{formatCurrency(pixSales)}</p>
                    <p className="text-xs text-zinc-500">Pix</p>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {todayOrders.map((o: any) => (
                    <div key={o.id} className="flex items-center justify-between rounded-lg bg-white/[.03] px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium text-flow-white">{o.customerName || "Cliente"}</p>
                        <p className="text-xs text-zinc-400">
                          {new Date(o.createdAt).toLocaleTimeString("pt-BR")} • {paymentLabels[o.paymentMethod] || "Pendente"}
                          {o.tableNumber && ` • Mesa ${o.tableNumber}`}
                        </p>
                      </div>
                      <span className="font-semibold text-flow-blue">{formatCurrency(o.total)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ===== TAB: HISTÓRICO ===== */}
      {tab === "historico" && (
        <>
          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-flow-blue border-t-transparent" />
            </div>
          ) : historyRegisters.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-zinc-400">
                <History className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
                <p>Nenhum caixa encontrado neste período</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="space-y-3">
                {historyRegisters.map((reg: any) => (
                  <Card key={reg.id} className={reg.status === "open" ? "border-flow-blue/20" : ""}>
                    <CardContent className="p-4">
                      <button
                        onClick={() => loadRegisterDetails(reg.id)}
                        className="w-full flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${reg.status === "open" ? "bg-flow-blue/10" : "bg-white/[.05]"}`}>
                            {reg.status === "open"
                              ? <DollarSign className="h-5 w-5 text-flow-blue" />
                              : <CheckCircle className="h-5 w-5 text-zinc-500" />
                            }
                          </div>
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-flow-white">
                                {new Date(reg.createdAt).toLocaleDateString("pt-BR")}
                              </p>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${reg.status === "open" ? "bg-flow-blue/10 text-flow-blue" : "bg-white/[.05] text-zinc-500"}`}>
                                {reg.status === "open" ? "Aberto" : "Fechado"}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400">
                              Abertura: {formatCurrency(reg.openingAmount)}
                              {reg.closingAmount != null && ` • Fechamento: ${formatCurrency(reg.closingAmount)}`}
                              {reg.closedAt && ` • ${new Date(reg.closedAt).toLocaleTimeString("pt-BR")}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {reg.movements && (
                            <span className="text-xs text-zinc-400">{reg.movements.length} mov.</span>
                          )}
                          {expandedRegister === reg.id ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
                        </div>
                      </button>

                      {/* Expanded details */}
                      {expandedRegister === reg.id && (
                        <div className="mt-4 border-t border-white/[.04] pt-4 space-y-3">
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="rounded-lg bg-white/[.03] p-2">
                              <p className="font-bold text-flow-white">{formatCurrency(reg.openingAmount)}</p>
                              <p className="text-zinc-400">Abertura</p>
                            </div>
                            <div className="rounded-lg bg-white/[.03] p-2">
                              <p className="font-bold text-flow-white">{formatCurrency(reg.expectedAmount || 0)}</p>
                              <p className="text-zinc-400">Esperado</p>
                            </div>
                            <div className="rounded-lg bg-white/[.03] p-2">
                              <p className={`font-bold ${(reg.closingAmount || 0) >= (reg.expectedAmount || 0) ? "text-flow-blue" : "text-red-400"}`}>
                                {formatCurrency((reg.closingAmount || 0) - (reg.expectedAmount || 0))}
                              </p>
                              <p className="text-zinc-400">Sobra/Falta</p>
                            </div>
                          </div>
                          {expandedMovements[reg.id] && expandedMovements[reg.id].length > 0 && (
                            <div className="space-y-1.5 max-h-60 overflow-y-auto">
                              {expandedMovements[reg.id].map((m: any) => (
                                <div key={m.id} className="flex items-center justify-between rounded-lg bg-white/[.03] px-3 py-2 text-sm">
                                  <div>
                                    <p className="text-zinc-300">{m.description || typeLabels[m.type]}</p>
                                    <p className="text-xs text-zinc-400">
                                      {new Date(m.createdAt).toLocaleTimeString("pt-BR")}
                                      {m.paymentMethod && ` • ${paymentLabels[m.paymentMethod] || m.paymentMethod}`}
                                    </p>
                                  </div>
                                  <span className={`font-semibold ${m.amount >= 0 ? "text-flow-blue" : "text-red-400"}`}>
                                    {m.amount >= 0 ? "+" : ""}{formatCurrency(m.amount)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {(!expandedMovements[reg.id] || expandedMovements[reg.id].length === 0) && (
                            <p className="text-xs text-zinc-400 text-center py-2">Carregando movimentações...</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {historyTotal > 20 && (
                <div className="flex justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={historyPage === 1}
                    onClick={() => setHistoryPage((p) => p - 1)}
                  >
                    Anterior
                  </Button>
                  <span className="flex items-center px-3 text-sm text-zinc-500">
                    Página {historyPage} de {Math.ceil(historyTotal / 20)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={historyPage >= Math.ceil(historyTotal / 20)}
                    onClick={() => setHistoryPage((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ===== TAB: RESUMO ===== */}
      {tab === "resumo" && (
        <>
          {summaryLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-flow-blue border-t-transparent" />
            </div>
          ) : summary ? (
            <>
              {/* Overview cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Card className="border-flow-blue/20 bg-flow-blue/10">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-flow-blue mb-1">Total Vendas</p>
                    <p className="text-xl font-bold text-flow-blue">{formatCurrency(summary.totalSales)}</p>
                  </CardContent>
                </Card>
                <Card className="border-red-500/20 bg-red-500/10">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-red-400 mb-1">Total Despesas</p>
                    <p className="text-xl font-bold text-red-400">{formatCurrency(summary.totalExpenses)}</p>
                  </CardContent>
                </Card>
                <Card className="border-flow-blue/20 bg-flow-blue/10">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-flow-blue mb-1">Suprimentos</p>
                    <p className="text-xl font-bold text-flow-blue">{formatCurrency(summary.totalInjections)}</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-500/20 bg-amber-500/10">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-amber-400 mb-1">Líquido</p>
                    <p className={`text-xl font-bold ${summary.netResult >= 0 ? "text-flow-blue" : "text-red-400"}`}>{formatCurrency(summary.netResult)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Sales by payment */}
              <Card>
                <CardContent className="p-4">
                  <h4 className="text-sm font-semibold text-zinc-300 mb-3">Vendas por Forma de Pagamento</h4>
                  <div className="space-y-2">
                    {(Object.entries(summary.salesByPayment) as [string, number][]).filter(([, v]) => v > 0).map(([method, amount]) => {
                      const Icon = paymentIcons[method] || DollarSign
                      const pct = summary.totalSales > 0 ? ((amount as number) / summary.totalSales * 100).toFixed(1) : 0
                      return (
                        <div key={method} className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[.05]">
                            <Icon className="h-4 w-4 text-zinc-400" />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-zinc-300">{paymentLabels[method] || method}</span>
                              <span className="font-semibold text-flow-white">{formatCurrency(amount as number)}</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[.05]">
                              <div className="h-full rounded-full bg-flow-green" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          <span className="text-xs text-zinc-400 w-12 text-right">{pct}%</span>
                        </div>
                      )
                    })}
                    {Object.values(summary.salesByPayment).every((v) => v === 0) && (
                      <p className="text-sm text-zinc-400 text-center py-4">Nenhuma venda no período</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Expenses by category */}
              {Object.keys(summary.expensesByCategory).length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h4 className="text-sm font-semibold text-zinc-300 mb-3">Despesas por Categoria</h4>
                    <div className="space-y-2">
                      {(Object.entries(summary.expensesByCategory) as [string, number][]).sort(([, a], [, b]) => b - a).map(([cat, amount]) => (
                        <div key={cat} className="flex items-center justify-between rounded-lg bg-white/[.03] px-3 py-2">
                          <span className="text-sm text-zinc-300 capitalize">{cat}</span>
                          <span className="text-sm font-semibold text-red-400">{formatCurrency(amount as number)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Register info */}
              <Card>
                <CardContent className="p-4">
                  <h4 className="text-sm font-semibold text-zinc-300 mb-3">Informações dos Caixas</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-white/[.03] p-3">
                      <p className="text-zinc-500">Total de caixas</p>
                      <p className="font-bold text-flow-white">{summary.registerCount}</p>
                    </div>
                    <div className="rounded-lg bg-white/[.03] p-3">
                      <p className="text-zinc-500">Abertos agora</p>
                      <p className="font-bold text-flow-blue">{summary.openRegisters}</p>
                    </div>
                    <div className="rounded-lg bg-white/[.03] p-3">
                      <p className="text-zinc-500">Total abertura</p>
                      <p className="font-bold text-flow-white">{formatCurrency(summary.totalOpening)}</p>
                    </div>
                    <div className="rounded-lg bg-white/[.03] p-3">
                      <p className="text-zinc-500">Total fechamento</p>
                      <p className="font-bold text-flow-white">{formatCurrency(summary.totalClosing)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-zinc-400">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
                <p>Nenhum dado disponível</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ===== MODALS ===== */}
      {/* Sangria Modal */}
      {sangriaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-flow-card p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-flow-white mb-4">Sangria</h3>
            <Input
              type="number"
              placeholder="Valor"
              value={movAmount}
              onChange={(e) => setMovAmount(e.target.value)}
              className="mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setSangriaModal(false)}>Cancelar</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700" disabled={!movAmount || submitting} onClick={() => addMovement("withdrawal")}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Suprimento Modal */}
      {suprimentoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-flow-card p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-flow-white mb-4">Suprimento</h3>
            <Input
              type="number"
              placeholder="Valor"
              value={movAmount}
              onChange={(e) => setMovAmount(e.target.value)}
              className="mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setSuprimentoModal(false)}>Cancelar</Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={!movAmount || submitting} onClick={() => addMovement("injection")}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Despesa Modal */}
      {despesaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-flow-card p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-flow-white mb-4">Despesa</h3>
            <Input
              placeholder="Descrição"
              value={despesaDesc}
              onChange={(e) => setDespesaDesc(e.target.value)}
              className="mb-3"
              autoFocus
            />
            <Input
              type="number"
              placeholder="Valor"
              value={movAmount}
              onChange={(e) => setMovAmount(e.target.value)}
              className="mb-4"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDespesaModal(false)}>Cancelar</Button>
              <Button className="flex-1 bg-amber-600 hover:bg-amber-700" disabled={!movAmount || submitting} onClick={() => addMovement("expense")}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
