"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Plus, Trash2, Loader2, X, Pencil, Download, RotateCcw, DollarSign, Image as ImageIcon, ChevronDown, Search, AlertTriangle, CalendarCheck, Repeat, Settings, ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { fetchAuth } from "@/lib/fetch-auth"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { useToast } from "@/components/toast"

interface Expense {
  id: string
  description: string
  amount: number
  category: string
  type: string
  paymentMethod: string
  isRecurring: boolean
  recurrenceFreq: string | null
  recurrenceStart: string | null
  recurrenceEnd: string | null
  receiptUrl: string | null
  date: string
  dueDate: string | null
  cashRegisterId: string | null
  computedStatus: string
  createdAt: string
}

type Period = "today" | "7days" | "30days" | "month" | "currentMonth" | "custom" | "all"
type StatusFilter = "all" | "pago" | "pendente" | "a_vencer" | "vence_hoje" | "atrasada"
type ExpenseType = "lancamento" | "agendada" | "recorrente"

const categoryLabels: Record<string, string> = {
  fixa: "Fixa", variavel: "Variável", motoboy: "Motoboy", insumo: "Insumo",
  salario: "Salário", aluguel: "Aluguel", energia: "Energia", agua: "Água",
  internet: "Internet", imposto: "Imposto", manutencao: "Manutenção",
  marketing: "Marketing", outro: "Outro",
}

const paymentLabels: Record<string, string> = {
  dinheiro: "Dinheiro", cartao: "Cartão", pix: "Pix", transferencia: "Transferência", boleto: "Boleto",
}
const paymentIcons: Record<string, string> = { dinheiro: "💵", cartao: "💳", pix: "📱", transferencia: "🏦", boleto: "📄" }
const periodLabels: Record<Period, string> = { today: "Hoje", "7days": "7 dias", "30days": "30 dias", month: "Mês", currentMonth: "Mês atual", custom: "Período", all: "Tudo" }
const statusLabels: Record<StatusFilter, string> = { all: "Todos", pago: "Pago", pendente: "Pendente", a_vencer: "A vencer", vence_hoje: "Vence hoje", atrasada: "Atrasada" }
const statusColors: Record<string, string> = { pago: "bg-green-100 text-green-800 border-green-200", pendente: "bg-amber-100 text-amber-800 border-amber-200", a_vencer: "bg-blue-100 text-blue-800 border-blue-200", vence_hoje: "bg-orange-100 text-orange-800 border-orange-200", atrasada: "bg-red-100 text-red-800 border-red-200" }
const typeLabels: Record<ExpenseType, string> = { lancamento: "Lançamento", agendada: "Agendada", recorrente: "Recorrente" }
const typeColors: Record<ExpenseType, string> = { lancamento: "bg-green-100 text-green-800 border-green-200", agendada: "bg-blue-100 text-blue-800 border-blue-200", recorrente: "bg-purple-100 text-purple-800 border-purple-200" }

const DEFAULT_CATEGORIES = ["fixa","variavel","motoboy","insumo","salario","aluguel","energia","agua","internet","imposto","manutencao","marketing","outro"]

function maskMoneyInput(value: string): string {
  const digits = value.replace(/\D/g, "")
  if (!digits) return ""
  return (Number(digits) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function parseMoneyInput(value: string): number {
  const clean = value.trim()
  if (!clean) return 0
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}
function formatMoneyInput(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const emptyForm = { description: "", amount: "", category: "variavel", paymentMethod: "dinheiro", date: "", dueDate: "", recurrenceStart: "", recurrenceEnd: "", recurrenceFreq: "mensal" }

export default function DespesasPage() {
  const searchParams = useSearchParams()
  const hookEstablishmentId = useEstablishmentId()
  const establishmentId = searchParams.get("establishment") || hookEstablishmentId
  const { toast } = useToast()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [period, setPeriod] = useState<Period>("month")
  const [customDateFrom, setCustomDateFrom] = useState("")
  const [customDateTo, setCustomDateTo] = useState("")
  const [filterCategory, setFilterCategory] = useState("all")
  const [filterPayment, setFilterPayment] = useState("all")
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all")
  const [filterType, setFilterType] = useState("all")
  const [search, setSearch] = useState("")

  const [form, setForm] = useState(emptyForm)
  const [formType, setFormType] = useState<ExpenseType>("lancamento")
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string; description: string }>({ open: false, id: "", description: "" })
  const [cashRegister, setCashRegister] = useState<any>(null)
  const [linkToCash, setLinkToCash] = useState(false)

  // Category management
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES)
  const [showCatManager, setShowCatManager] = useState(false)
  const [newCatName, setNewCatName] = useState("")
  const [editingCat, setEditingCat] = useState<string | null>(null)
  const [editCatName, setEditCatName] = useState("")
  const [deleteCat, setDeleteCat] = useState<{ open: boolean; cat: string; count: number }>({ open: false, cat: "", count: 0 })
  const [deleteCatAction, setDeleteCatAction] = useState<"rename" | "move" | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [moveToCat, setMoveToCat] = useState("")
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (!establishmentId) return
    setLoading(true)
    const now = new Date()
    let from = ""
    let to = now.toISOString().split("T")[0]
    if (period === "today") from = now.toISOString().split("T")[0]
    else if (period === "7days") { const d = new Date(now.getTime() - 7 * 86400000); from = d.toISOString().split("T")[0] }
    else if (period === "30days") { const d = new Date(now.getTime() - 30 * 86400000); from = d.toISOString().split("T")[0] }
    else if (period === "month") { from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0] }
    else if (period === "currentMonth") { from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]; to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0] }
    else if (period === "custom") { from = customDateFrom; to = customDateTo || now.toISOString().split("T")[0] }
    else { from = ""; to = "" }

    const params = new URLSearchParams({ establishmentId })
    if (from) params.set("from", from)
    if (to && period !== "all") params.set("to", to)
    if (filterCategory !== "all") params.set("category", filterCategory)
    if (filterPayment !== "all") params.set("paymentMethod", filterPayment)
    if (filterStatus !== "all") params.set("status", filterStatus)
    if (filterType !== "all") params.set("type", filterType)
    if (search) params.set("search", search)

    Promise.all([
      fetchAuth(`/api/expenses?${params}`).then((r) => r.json()),
      fetchAuth(`/api/cash-register?establishmentId=${establishmentId}`).then((r) => r.json()),
      fetchAuth(`/api/establishments?id=${establishmentId}`).then((r) => r.json()),
    ])
      .then(([expensesData, cashData, estData]) => {
        setExpenses(Array.isArray(expensesData) ? expensesData : [])
        setCashRegister(cashData)
        if (estData?.expenseCategories) {
          try { setCategories(JSON.parse(estData.expenseCategories)) } catch {}
        }
      })
      .catch(() => { setExpenses([]) })
      .finally(() => setLoading(false))
  }, [establishmentId, period, customDateFrom, customDateTo, filterCategory, filterPayment, filterStatus, filterType, search])

  async function saveCategories(cats: string[]) {
    setCategories(cats)
    if (!establishmentId) return
    await fetchAuth(`/api/establishments/${establishmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expenseCategories: JSON.stringify(cats) }),
    })
  }

  async function handleAddCategory() {
    const name = newCatName.trim().toLowerCase()
    if (!name) return
    if (categories.includes(name)) { toast("Categoria já existe", "error"); return }
    await saveCategories([...categories, name])
    setNewCatName("")
    toast("Categoria adicionada", "success")
  }

  async function handleRenameCategory(oldName: string) {
    const newName = renameValue.trim().toLowerCase()
    if (!newName) return
    if (categories.includes(newName) && newName !== oldName) { toast("Categoria já existe", "error"); return }
    // Rename in all expenses
    const params = new URLSearchParams({ establishmentId: establishmentId!, category: oldName })
    const exps = await fetchAuth(`/api/expenses?${params}`).then((r) => r.json())
    if (Array.isArray(exps)) {
      for (const e of exps) {
        await fetchAuth(`/api/expenses/${e.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: newName }),
        })
      }
    }
    await saveCategories(categories.map((c) => c === oldName ? newName : c))
    setEditingCat(null)
    setEditCatName("")
    toast("Categoria renomeada", "success")
  }

  async function handleMoveCategory(oldCat: string, newCat: string) {
    const params = new URLSearchParams({ establishmentId: establishmentId!, category: oldCat })
    const exps = await fetchAuth(`/api/expenses?${params}`).then((r) => r.json())
    if (Array.isArray(exps)) {
      for (const e of exps) {
        await fetchAuth(`/api/expenses/${e.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: newCat }),
        })
      }
    }
    await saveCategories(categories.filter((c) => c !== oldCat))
    setDeleteCat({ open: false, cat: "", count: 0 })
    setDeleteCatAction(null)
    toast(`${exps.length} despesa(s) movida(s) para "${newCat}"`, "success")
  }

  async function handleDeleteCategory(cat: string) {
    const params = new URLSearchParams({ establishmentId: establishmentId!, category: cat })
    const exps = await fetchAuth(`/api/expenses?${params}`).then((r) => r.json())
    const count = Array.isArray(exps) ? exps.length : 0
    if (count === 0) {
      await saveCategories(categories.filter((c) => c !== cat))
      toast("Categoria removida", "success")
    } else {
      setDeleteCat({ open: true, cat, count })
      setDeleteCatAction(null)
    }
  }

  function openCreate() {
    setEditingId(null); setForm(emptyForm); setFormType("lancamento"); setLinkToCash(!!cashRegister); setShowForm(true)
  }
  function openEdit(expense: Expense) {
    setEditingId(expense.id); setFormType(expense.type as ExpenseType)
    setForm({ description: expense.description, amount: formatMoneyInput(expense.amount), category: expense.category, paymentMethod: expense.paymentMethod || "dinheiro", date: expense.date.split("T")[0], dueDate: expense.dueDate ? expense.dueDate.split("T")[0] : "", recurrenceStart: expense.recurrenceStart ? expense.recurrenceStart.split("T")[0] : "", recurrenceEnd: expense.recurrenceEnd ? expense.recurrenceEnd.split("T")[0] : "", recurrenceFreq: expense.recurrenceFreq || "mensal" })
    setLinkToCash(false); setShowForm(true)
  }

  async function handleSave() {
    if (!form.description || !form.amount) { toast("Preencha descrição e valor", "error"); return }
    const amount = parseMoneyInput(form.amount)
    if (amount <= 0) { toast("Informe um valor maior que zero", "error"); return }
    setSaving(true)
    try {
      const payload: any = { description: form.description, amount, category: form.category, paymentMethod: form.paymentMethod, type: formType, date: form.date || undefined, dueDate: form.dueDate || undefined, recurrenceStart: form.recurrenceStart || undefined, recurrenceEnd: form.recurrenceEnd || undefined, recurrenceFreq: form.recurrenceFreq, isRecurring: formType === "recorrente", establishmentId }
      if (linkToCash && cashRegister) payload.cashRegisterId = cashRegister.id
      if (editingId) {
        const res = await fetchAuth(`/api/expenses/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        if (res.ok) { toast("Despesa atualizada", "success") } else { toast("Erro ao atualizar", "error") }
      } else {
        const res = await fetchAuth("/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        if (res.ok) { const r = await res.json(); toast(`${r.count || 1} despesa(s) criada(s)`, "success") } else { toast("Erro ao criar", "error") }
      }
      // Reload
      const params = new URLSearchParams({ establishmentId: establishmentId! })
      const refreshed = await fetchAuth(`/api/expenses?${params}`).then((r) => r.json())
      setExpenses(Array.isArray(refreshed) ? refreshed : [])
      setShowForm(false)
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    const res = await fetchAuth(`/api/expenses/${confirmDelete.id}`, { method: "DELETE" })
    if (res.ok) { setExpenses(expenses.filter((e) => e.id !== confirmDelete.id)); toast("Despesa excluída", "success") }
  }

  function exportCSV() {
    const header = "Data,Descrição,Tipo,Categoria,Método Pgto,Status,Vencimento\n"
    const rows = expenses.map((e) => `${new Date(e.createdAt).toLocaleDateString("pt-BR")},"${e.description}",${typeLabels[e.type as ExpenseType] || e.type},${e.category},${paymentLabels[e.paymentMethod] || e.paymentMethod},${e.computedStatus === "pago" ? "Pago" : e.computedStatus === "atrasada" ? "Atrasada" : e.computedStatus === "a_vencer" ? "A vencer" : e.computedStatus === "vence_hoje" ? "Vence hoje" : "Pendente"},${e.dueDate ? new Date(e.dueDate).toLocaleDateString("pt-BR") : ""}`).join("\n")
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `despesas-${new Date().toISOString().split("T")[0]}.csv`; a.click(); URL.revokeObjectURL(url)
    toast("CSV exportado", "success")
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const daysInPeriod = period === "today" ? 1 : period === "7days" ? 7 : period === "30days" ? 30 : period === "month" ? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() : 30
  const dailyAvg = expenses.length > 0 ? totalExpenses / daysInPeriod : 0
  const overdueCount = expenses.filter((e) => e.computedStatus === "atrasada").length
  const pendingCount = expenses.filter((e) => e.computedStatus === "pendente" || e.computedStatus === "a_vencer" || e.computedStatus === "vence_hoje").length
  const categoryTotals: Record<string, number> = {}
  expenses.forEach((e) => { categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount })
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])
  const maxCatValue = sortedCategories.length > 0 ? sortedCategories[0][1] : 1

  function getRecurrencePreview(): string {
    if (formType !== "recorrente" || !form.recurrenceStart) return ""
    const start = new Date(form.recurrenceStart + "T00:00:00")
    if (form.recurrenceEnd) { const end = new Date(form.recurrenceEnd + "T00:00:00"); const m = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1; return `Serão criados ${m} lançamento(s) mensais de ${start.toLocaleDateString("pt-BR")} até ${end.toLocaleDateString("pt-BR")}.` }
    return `Será criado 1 lançamento em ${start.toLocaleDateString("pt-BR")}. Para múltiplos meses, informe a data fim.`
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-green-600" /></div>

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-zinc-900">Despesas</h1><p className="text-sm text-zinc-500">{expenses.length} registros • {formatCurrency(totalExpenses)}</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowCatManager(true)} className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50"><Settings className="h-3.5 w-3.5" />Categorias</button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50"><Download className="h-3.5 w-3.5" />CSV</button>
          <Button onClick={openCreate} className="bg-green-600 hover:bg-green-700"><Plus className="mr-2 h-4 w-4" />Nova despesa</Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3"><p className="text-[10px] text-zinc-500 mb-1">Total</p><p className="text-lg font-bold text-red-600">{formatCurrency(totalExpenses)}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-[10px] text-zinc-500 mb-1">Média/dia</p><p className="text-lg font-bold text-zinc-900">{formatCurrency(dailyAvg)}</p></CardContent></Card>
        {overdueCount > 0 && <Card className="border-red-200 bg-red-50"><CardContent className="p-3"><div className="flex items-center gap-1 mb-1"><AlertTriangle className="h-3 w-3 text-red-500" /><p className="text-[10px] text-red-600 font-medium">Atrasadas</p></div><p className="text-lg font-bold text-red-600">{overdueCount}</p></CardContent></Card>}
        {pendingCount > 0 && <Card className="border-amber-200 bg-amber-50"><CardContent className="p-3"><p className="text-[10px] text-amber-600 font-medium mb-1">Pendentes</p><p className="text-lg font-bold text-amber-600">{pendingCount}</p></CardContent></Card>}
      </div>

      {/* Period */}
      <div className="flex gap-1 overflow-x-auto pb-1">{(["today", "7days", "30days", "month", "currentMonth", "custom", "all"] as Period[]).map((p) => (<button key={p} onClick={() => setPeriod(p)} className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors ${period === p ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}>{periodLabels[p]}</button>))}</div>
      {period === "custom" && (
        <div className="flex items-center gap-2">
          <input type="date" value={customDateFrom} onChange={(e) => setCustomDateFrom(e.target.value)} className="h-8 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs text-zinc-700 focus:border-green-600 focus:outline-none" />
          <span className="text-xs text-zinc-400">até</span>
          <input type="date" value={customDateTo} onChange={(e) => setCustomDateTo(e.target.value)} className="h-8 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs text-zinc-700 focus:border-green-600 focus:outline-none" />
        </div>
      )}

      {/* Category breakdown */}
      {sortedCategories.length > 0 && <Card><CardContent className="p-4"><h3 className="text-xs font-semibold text-zinc-700 mb-3">Por Categoria</h3><div className="space-y-2">{sortedCategories.map(([cat, total]) => (<div key={cat} className="flex items-center gap-3"><span className="text-xs text-zinc-500 w-20 truncate">{cat}</span><div className="flex-1 h-2 rounded-full bg-zinc-100 overflow-hidden"><div className="h-full rounded-full bg-green-500/70" style={{ width: `${(total / maxCatValue) * 100}%` }} /></div><span className="text-xs font-bold text-zinc-700 w-20 text-right">{formatCurrency(total)}</span></div>))}</div></CardContent></Card>}

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar despesa..." className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none" />{search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600" /></button>}</div>
        <CustomSelect value={filterType} onChange={setFilterType} options={[{ value: "all", label: "Todos tipos" }, ...Object.entries(typeLabels).map(([k, v]) => ({ value: k, label: v }))]} />
        <CustomSelect value={filterStatus} onChange={(v) => setFilterStatus(v as StatusFilter)} options={[{ value: "all", label: "Todos status" }, ...Object.entries(statusLabels).filter(([k]) => k !== "all").map(([k, v]) => ({ value: k, label: v }))]} />
        <CustomSelect value={filterCategory} onChange={setFilterCategory} options={[{ value: "all", label: "Todas categorias" }, ...categories.map((c) => ({ value: c, label: categoryLabels[c] || c }))]} />
        <CustomSelect value={filterPayment} onChange={setFilterPayment} options={[{ value: "all", label: "Todos pagamentos" }, ...Object.entries(paymentLabels).map(([k, v]) => ({ value: k, label: v }))]} />
        {(filterType !== "all" || filterStatus !== "all" || filterCategory !== "all" || filterPayment !== "all" || search) && <button onClick={() => { setFilterType("all"); setFilterStatus("all"); setFilterCategory("all"); setFilterPayment("all"); setSearch("") }} className="text-xs text-zinc-400 hover:text-zinc-600">Limpar</button>}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Data</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Descrição</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Categoria</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Tipo</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Vencimento</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Pagamento</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Status</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Valor</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {expenses.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-sm text-zinc-400">Nenhuma despesa registrada</td></tr>
            )}
            {expenses.map((expense) => (
              <tr key={expense.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-3 py-2.5 text-xs text-zinc-500">{new Date(expense.createdAt).toLocaleDateString("pt-BR")}</td>
                <td className="px-3 py-2.5 font-medium text-zinc-900 max-w-[200px] truncate">{expense.description}</td>
                <td className="px-3 py-2.5"><Badge className="text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">{expense.category}</Badge></td>
                <td className="px-3 py-2.5"><Badge className={`text-xs font-medium border ${typeColors[expense.type as ExpenseType] || "bg-zinc-100 text-zinc-700 border-zinc-200"}`}>{typeLabels[expense.type as ExpenseType] || expense.type}</Badge></td>
                <td className="px-3 py-2.5 text-xs text-zinc-500">
                  {expense.type === "agendada" && expense.dueDate ? (
                    <span className={expense.computedStatus === "atrasada" ? "font-medium text-red-500" : ""}>{new Date(expense.dueDate).toLocaleDateString("pt-BR")}</span>
                  ) : expense.type === "recorrente" && expense.recurrenceStart ? (
                    <span className="text-purple-600">{new Date(expense.recurrenceStart).toLocaleDateString("pt-BR")}</span>
                  ) : "—"}
                </td>
                <td className="px-3 py-2.5 text-xs text-zinc-500">{paymentIcons[expense.paymentMethod] || ""} {paymentLabels[expense.paymentMethod] || expense.paymentMethod}</td>
                <td className="px-3 py-2.5"><Badge className={`text-xs font-medium border ${statusColors[expense.computedStatus] || "bg-zinc-100 text-zinc-700 border-zinc-200"}`}>{expense.computedStatus === "pago" ? "Pago" : expense.computedStatus === "atrasada" ? "Atrasada" : expense.computedStatus === "a_vencer" ? "A vencer" : expense.computedStatus === "vence_hoje" ? "Vence hoje" : "Pendente"}</Badge></td>
                <td className="px-3 py-2.5 text-right text-sm font-bold text-red-500">-{formatCurrency(expense.amount)}</td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(expense)} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-blue-600 transition-colors" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setConfirmDelete({ open: true, id: expense.id, description: expense.description })} className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {expenses.length > 0 && <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-2.5"><span className="text-xs text-zinc-500">{expenses.length} registros exibidos</span><span className="text-xs font-bold text-red-500">Total: {formatCurrency(totalExpenses)}</span></div>}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3"><h3 className="font-semibold text-sm text-zinc-900">{editingId ? "Editar Despesa" : "Nova Despesa"}</h3><button onClick={() => setShowForm(false)} className="rounded-lg p-1 hover:bg-zinc-100"><X className="h-4 w-4 text-zinc-400" /></button></div>
            <div className="space-y-3 p-4">
              {!editingId && (<div><label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Tipo de lançamento</label><div className="flex gap-2">{(["lancamento", "agendada", "recorrente"] as ExpenseType[]).map((t) => (<button key={t} type="button" onClick={() => setFormType(t)} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${formType === t ? (t === "recorrente" ? "border-purple-600 bg-purple-600 text-white" : t === "agendada" ? "border-blue-600 bg-blue-600 text-white" : "border-green-600 bg-green-600 text-white") : "border-zinc-200 bg-zinc-50 text-zinc-500 hover:bg-zinc-100"}`}>{typeLabels[t]}</button>))}</div></div>)}
              <div><label className="mb-1 block text-xs font-medium text-zinc-600">Descrição</label><input placeholder="Ex: Compra de gás" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none" /></div>
              <div><label className="mb-1 block text-xs font-medium text-zinc-600">Valor (R$)</label><input inputMode="numeric" placeholder="0,00" value={form.amount} onChange={(e) => setForm({ ...form, amount: maskMoneyInput(e.target.value) })} onBlur={() => { if (form.amount) setForm({ ...form, amount: formatMoneyInput(parseMoneyInput(form.amount)) }) }} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none" /></div>
              {formType === "lancamento" && <div><label className="mb-1 block text-xs font-medium text-zinc-600">Data</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none" /></div>}
              {formType === "agendada" && <div><label className="mb-1 block text-xs font-medium text-zinc-600">Data de vencimento *</label><input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none" /><p className="mt-0.5 text-[10px] text-zinc-400">Se não pagar até esta data, fica &quot;Atrasada&quot;</p></div>}
              {formType === "recorrente" && (<><div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-xs font-medium text-zinc-600">Início *</label><input type="date" value={form.recurrenceStart} onChange={(e) => setForm({ ...form, recurrenceStart: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none" /></div><div><label className="mb-1 block text-xs font-medium text-zinc-600">Fim (opcional)</label><input type="date" value={form.recurrenceEnd} onChange={(e) => setForm({ ...form, recurrenceEnd: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none" /></div></div>{getRecurrencePreview() && <div className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-[11px] text-purple-700">{getRecurrencePreview()}</div>}</>)}
              <div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-xs font-medium text-zinc-600">Categoria</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none">{categories.map((c) => <option key={c} value={c}>{categoryLabels[c] || c}</option>)}</select></div><div><label className="mb-1 block text-xs font-medium text-zinc-600">Pagamento</label><select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none">{Object.entries(paymentLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div></div>
              {cashRegister && <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-amber-200 bg-amber-50 p-2"><input type="checkbox" checked={linkToCash} onChange={(e) => setLinkToCash(e.target.checked)} className="h-4 w-4 rounded border-zinc-300 text-green-600 focus:ring-green-500" /><div><span className="text-xs font-medium text-zinc-700">Vincular ao caixa aberto</span><p className="text-[10px] text-zinc-500">Aparece no fechamento do dia</p></div></label>}
            </div>
            <div className="flex gap-2 border-t border-zinc-200 px-4 py-3"><Button onClick={() => setShowForm(false)} variant="outline" className="flex-1">Cancelar</Button><Button onClick={handleSave} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingId ? "Salvar" : formType === "recorrente" ? "Criar recorrência" : "Criar"}</Button></div>
          </div>
        </div>
      )}

      {/* Category Manager modal */}
      {showCatManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3"><h3 className="font-semibold text-sm text-zinc-900">Gerenciar Categorias</h3><button onClick={() => setShowCatManager(false)} className="rounded-lg p-1 hover:bg-zinc-100"><X className="h-4 w-4 text-zinc-400" /></button></div>
            <div className="p-4 space-y-3">
              <div className="flex gap-2"><input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddCategory()} placeholder="Nova categoria..." className="flex-1 h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none" /><Button onClick={handleAddCategory} size="sm" className="bg-green-600 hover:bg-green-700"><Plus className="h-3.5 w-3.5" /></Button></div>
              <div className="max-h-[300px] overflow-y-auto space-y-1">
                {categories.map((cat) => (
                  <div key={cat} className="flex items-center gap-2 rounded-lg border border-zinc-100 px-3 py-2 hover:bg-zinc-50">
                    {editingCat === cat ? (
                      <><input value={editCatName} onChange={(e) => setEditCatName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleRenameCategory(cat)} className="flex-1 h-7 rounded border border-zinc-200 px-2 text-xs focus:border-green-600 focus:outline-none" autoFocus /><button onClick={() => handleRenameCategory(cat)} className="text-xs text-green-600 font-medium">Salvar</button><button onClick={() => { setEditingCat(null); setEditCatName("") }} className="text-xs text-zinc-400">Cancelar</button></>
                    ) : (
                      <><span className="flex-1 text-xs text-zinc-700">{categoryLabels[cat] || cat}</span><button onClick={() => { setEditingCat(cat); setEditCatName(categoryLabels[cat] || cat) }} className="rounded p-1 text-zinc-400 hover:text-blue-600 hover:bg-zinc-100"><Pencil className="h-3 w-3" /></button><button onClick={() => handleDeleteCategory(cat)} className="rounded p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="h-3 w-3" /></button></>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete category confirmation modal */}
      {deleteCat.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-600"><AlertTriangle className="h-5 w-5" /><h3 className="font-semibold text-sm">Categoria com despesas</h3></div>
              <p className="text-xs text-zinc-600">&quot;{deleteCat.cat}&quot; tem <strong>{deleteCat.count}</strong> despesa(s) vinculada(s). O que deseja fazer?</p>
              {!deleteCatAction && (
                <div className="flex gap-2">
                  <button onClick={() => { setDeleteCatAction("rename"); setRenameValue(categoryLabels[deleteCat.cat] || deleteCat.cat) }} className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"><Pencil className="mr-1.5 h-3.5 w-3.5 inline" />Renomear</button>
                  <button onClick={() => { setDeleteCatAction("move"); setMoveToCat(categories.find((c) => c !== deleteCat.cat) || "") }} className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"><ArrowRight className="mr-1.5 h-3.5 w-3.5 inline" />Mover para</button>
                </div>
              )}
              {deleteCatAction === "rename" && (
                <div className="space-y-2"><input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleRenameCategory(deleteCat.cat)} className="w-full h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs focus:border-green-600 focus:outline-none" autoFocus /><div className="flex gap-2"><Button onClick={() => setDeleteCatAction(null)} variant="outline" size="sm" className="flex-1">Voltar</Button><Button onClick={() => handleRenameCategory(deleteCat.cat)} disabled={processing} size="sm" className="flex-1 bg-green-600 hover:bg-green-700">{processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Renomear"}</Button></div></div>
              )}
              {deleteCatAction === "move" && (
                <div className="space-y-2"><select value={moveToCat} onChange={(e) => setMoveToCat(e.target.value)} className="w-full h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs focus:border-green-600 focus:outline-none">{categories.filter((c) => c !== deleteCat.cat).map((c) => <option key={c} value={c}>{categoryLabels[c] || c}</option>)}</select><div className="flex gap-2"><Button onClick={() => setDeleteCatAction(null)} variant="outline" size="sm" className="flex-1">Voltar</Button><Button onClick={() => handleMoveCategory(deleteCat.cat, moveToCat)} disabled={processing || !moveToCat} size="sm" className="flex-1 bg-green-600 hover:bg-green-700">{processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `Mover ${deleteCat.count} despesa(s)`}</Button></div></div>
              )}
              <button onClick={() => { setDeleteCat({ open: false, cat: "", count: 0 }); setDeleteCatAction(null) }} className="w-full text-center text-xs text-zinc-400 hover:text-zinc-600">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={confirmDelete.open} title="Excluir despesa" message={`Tem certeza que deseja excluir "${confirmDelete.description}"?`} confirmLabel="Excluir" cancelLabel="Cancelar" variant="danger" confirmed={false} onConfirm={handleDelete} onCancel={() => setConfirmDelete({ open: false, id: "", description: "" })} />
    </div>
  )
}

function CustomSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
        <span className="truncate max-w-[120px]">{selected?.label}</span>
        <ChevronDown className={`h-3 w-3 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (<><div className="fixed inset-0 z-40" onClick={() => setOpen(false)} /><div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-zinc-200 bg-white shadow-lg py-1">{options.map((opt) => (<button key={opt.value} onClick={() => { onChange(opt.value); setOpen(false) }} className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${opt.value === value ? "bg-green-50 text-green-700 font-medium" : "text-zinc-600 hover:bg-zinc-50"}`}>{opt.label}</button>))}</div></>)}
    </div>
  )
}
