"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Plus, Trash2, Loader2, X, Pencil, Download, RotateCcw, DollarSign, Image as ImageIcon, ChevronDown } from "lucide-react"
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
  paymentMethod: string
  isRecurring: boolean
  recurrenceFreq: string | null
  receiptUrl: string | null
  date: string
  cashRegisterId: string | null
  createdAt: string
}

type Period = "today" | "7days" | "30days" | "month" | "all"

const categoryLabels: Record<string, string> = {
  fixa: "Fixa",
  variavel: "Variável",
  motoboy: "Motoboy",
  insumo: "Insumo",
  salario: "Salário",
  aluguel: "Aluguel",
  energia: "Energia",
  agua: "Água",
  internet: "Internet",
  imposto: "Imposto",
  manutencao: "Manutenção",
  marketing: "Marketing",
  outro: "Outro",
}

const categoryColors: Record<string, string> = {
  fixa: "bg-green-600/15 text-green-700",
  variavel: "bg-yellow-100 text-yellow-700",
  motoboy: "bg-orange-100 text-orange-700",
  insumo: "bg-purple-100 text-purple-700",
  salario: "bg-blue-100 text-blue-700",
  aluguel: "bg-red-100 text-red-700",
  energia: "bg-amber-100 text-amber-700",
  agua: "bg-cyan-100 text-cyan-700",
  internet: "bg-indigo-100 text-indigo-700",
  imposto: "bg-rose-100 text-rose-700",
  manutencao: "bg-teal-100 text-teal-700",
  marketing: "bg-violet-100 text-violet-700",
  outro: "bg-zinc-100 text-zinc-700",
}

const paymentLabels: Record<string, string> = {
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  pix: "Pix",
  transferencia: "Transferência",
  boleto: "Boleto",
}

const paymentIcons: Record<string, string> = {
  dinheiro: "💵",
  cartao: "💳",
  pix: "📱",
  transferencia: "🏦",
  boleto: "📄",
}

const periodLabels: Record<Period, string> = {
  today: "Hoje",
  "7days": "7 dias",
  "30days": "30 dias",
  month: "Mês",
  all: "Tudo",
}

const emptyForm = {
  description: "",
  amount: "",
  category: "variavel",
  paymentMethod: "dinheiro",
  date: "",
  isRecurring: false,
  recurrenceFreq: "mensal",
}

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
  const [filterCategory, setFilterCategory] = useState("all")
  const [filterPayment, setFilterPayment] = useState("all")

  const [form, setForm] = useState(emptyForm)
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string; description: string }>({ open: false, id: "", description: "" })

  const [cashRegister, setCashRegister] = useState<any>(null)
  const [linkToCash, setLinkToCash] = useState(false)

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
    else { from = ""; to = "" }

    const params = new URLSearchParams({ establishmentId })
    if (from) params.set("from", from)
    if (to && period !== "all") params.set("to", to)

    Promise.all([
      fetchAuth(`/api/expenses?${params}`).then((r) => r.json()),
      fetchAuth(`/api/cash-register?establishmentId=${establishmentId}`).then((r) => r.json()),
    ])
      .then(([expensesData, cashData]) => {
        setExpenses(Array.isArray(expensesData) ? expensesData : [])
        setCashRegister(cashData)
      })
      .catch(() => { setExpenses([]) })
      .finally(() => setLoading(false))
  }, [establishmentId, period])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setLinkToCash(!!cashRegister)
    setShowForm(true)
  }

  function openEdit(expense: Expense) {
    setEditingId(expense.id)
    setForm({
      description: expense.description,
      amount: String(expense.amount),
      category: expense.category,
      paymentMethod: expense.paymentMethod || "dinheiro",
      date: expense.date.split("T")[0],
      isRecurring: expense.isRecurring,
      recurrenceFreq: expense.recurrenceFreq || "mensal",
    })
    setLinkToCash(false)
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.description || !form.amount) {
      toast("Preencha descrição e valor", "error")
      return
    }
    setSaving(true)
    try {
      const payload: any = {
        description: form.description,
        amount: parseFloat(form.amount),
        category: form.category,
        paymentMethod: form.paymentMethod,
        date: form.date || undefined,
        isRecurring: form.isRecurring,
        recurrenceFreq: form.isRecurring ? form.recurrenceFreq : null,
        establishmentId,
      }
      if (linkToCash && cashRegister) payload.cashRegisterId = cashRegister.id

      if (editingId) {
        const res = await fetchAuth(`/api/expenses/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const updated = await res.json()
          setExpenses(expenses.map((e) => (e.id === editingId ? updated : e)))
          toast("Despesa atualizada", "success")
        } else {
          toast("Erro ao atualizar", "error")
        }
      } else {
        const res = await fetchAuth("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const expense = await res.json()
          setExpenses([expense, ...expenses])
          toast("Despesa criada", "success")
        } else {
          toast("Erro ao criar", "error")
        }
      }
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    const res = await fetchAuth(`/api/expenses/${confirmDelete.id}`, { method: "DELETE" })
    if (res.ok) {
      setExpenses(expenses.filter((e) => e.id !== confirmDelete.id))
      toast("Despesa excluída", "success")
    }
  }

  function exportCSV() {
    const header = "Data,Descrição,Valor,Categoria,Método Pgto,Recorrente\n"
    const rows = filtered.map((e) =>
      `${new Date(e.date).toLocaleDateString("pt-BR")},"${e.description}",${e.amount},${categoryLabels[e.category] || e.category},${paymentLabels[e.paymentMethod] || e.paymentMethod},${e.isRecurring ? "Sim" : "Não"}`
    ).join("\n")
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `despesas-${period}-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast("CSV exportado", "success")
  }

  const filtered = expenses.filter((e) => {
    if (filterCategory !== "all" && e.category !== filterCategory) return false
    if (filterPayment !== "all" && e.paymentMethod !== filterPayment) return false
    return true
  })

  const totalFiltered = filtered.reduce((sum, e) => sum + e.amount, 0)
  const daysInPeriod = period === "today" ? 1 : period === "7days" ? 7 : period === "30days" ? 30 : period === "month" ? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() : 30
  const dailyAvg = filtered.length > 0 ? totalFiltered / daysInPeriod : 0

  const categoryTotals: Record<string, number> = {}
  filtered.forEach((e) => { categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount })
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])
  const maxCatValue = sortedCategories.length > 0 ? sortedCategories[0][1] : 1

  const paymentTotals: Record<string, number> = {}
  filtered.forEach((e) => { paymentTotals[e.paymentMethod] = (paymentTotals[e.paymentMethod] || 0) + e.amount })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Despesas</h1>
          <p className="text-sm text-zinc-500">{filtered.length} registros • {formatCurrency(totalFiltered)}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50">
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <Button onClick={openCreate} className="bg-green-600 hover:bg-green-700">
            <Plus className="mr-2 h-4 w-4" />
            Nova despesa
          </Button>
        </div>
      </div>

      {/* Period filter */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {(["today", "7days", "30days", "month", "all"] as Period[]).map((p) => (
          <button key={p} onClick={() => setPeriod(p)} className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors ${period === p ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}>
            {periodLabels[p]}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-zinc-500 mb-1">Total</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(totalFiltered)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-zinc-500 mb-1">Média/dia</p>
            <p className="text-lg font-bold text-zinc-900">{formatCurrency(dailyAvg)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-zinc-500 mb-1">Registros</p>
            <p className="text-lg font-bold text-zinc-900">{filtered.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Category breakdown */}
      {sortedCategories.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-xs font-semibold text-zinc-700 mb-3">Por Categoria</h3>
            <div className="space-y-2">
              {sortedCategories.map(([cat, total]) => (
                <div key={cat} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500 w-20 truncate">{categoryLabels[cat] || cat}</span>
                  <div className="flex-1 h-2 rounded-full bg-zinc-100 overflow-hidden">
                    <div className="h-full rounded-full bg-green-500/70" style={{ width: `${(total / maxCatValue) * 100}%` }} />
                  </div>
                  <span className="text-xs font-bold text-zinc-700 w-20 text-right">{formatCurrency(total)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compact filter bar */}
      <div className="flex items-center gap-2">
        <CustomSelect
          value={filterCategory}
          onChange={setFilterCategory}
          options={[{ value: "all", label: "Todas categorias" }, ...Object.entries(categoryLabels).map(([k, v]) => ({ value: k, label: v }))]}
        />
        <CustomSelect
          value={filterPayment}
          onChange={setFilterPayment}
          options={[{ value: "all", label: "Todos pagamentos" }, ...Object.entries(paymentLabels).map(([k, v]) => ({ value: k, label: v }))]}
        />
        {(filterCategory !== "all" || filterPayment !== "all") && (
          <button onClick={() => { setFilterCategory("all"); setFilterPayment("all") }} className="text-xs text-zinc-400 hover:text-zinc-600">
            Limpar
          </button>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <h3 className="font-semibold text-sm text-zinc-900">{editingId ? "Editar Despesa" : "Nova Despesa"}</h3>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1 hover:bg-zinc-100">
                <X className="h-4 w-4 text-zinc-400" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Descrição</label>
                <input placeholder="Ex: Compra de gás" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Valor (R$)</label>
                  <input type="number" step="0.01" placeholder="0,00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Data</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Categoria</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none">
                    {Object.entries(categoryLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Pagamento</label>
                  <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none">
                    {Object.entries(paymentLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isRecurring} onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })} className="h-4 w-4 rounded border-zinc-300 text-green-600 focus:ring-green-500" />
                  <span className="text-xs font-medium text-zinc-600">Recorrente</span>
                </label>
                {form.isRecurring && (
                  <select value={form.recurrenceFreq} onChange={(e) => setForm({ ...form, recurrenceFreq: e.target.value })} className="h-8 rounded-lg border border-zinc-200 bg-zinc-50 px-2 text-xs text-zinc-700 focus:border-green-600 focus:outline-none">
                    <option value="semanal">Semanal</option>
                    <option value="quinzenal">Quinzenal</option>
                    <option value="mensal">Mensal</option>
                    <option value="anual">Anual</option>
                  </select>
                )}
              </div>
              {cashRegister && (
                <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-amber-200 bg-amber-50 p-2">
                  <input type="checkbox" checked={linkToCash} onChange={(e) => setLinkToCash(e.target.checked)} className="h-4 w-4 rounded border-zinc-300 text-green-600 focus:ring-green-500" />
                  <div>
                    <span className="text-xs font-medium text-zinc-700">Vincular ao caixa aberto</span>
                    <p className="text-[10px] text-zinc-500">Aparece no fechamento do dia</p>
                  </div>
                </label>
              )}
            </div>
            <div className="flex gap-2 border-t border-zinc-200 px-4 py-3">
              <Button onClick={() => setShowForm(false)} variant="outline" className="flex-1">Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingId ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Expenses list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center py-10 text-center">
              <DollarSign className="mb-2 h-8 w-8 text-zinc-300" />
              <p className="text-sm text-zinc-500">Nenhuma despesa registrada</p>
            </CardContent>
          </Card>
        )}

        {filtered.map((expense) => (
          <Card key={expense.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-zinc-900 truncate">{expense.description}</p>
                  <Badge className={`text-[10px] ${categoryColors[expense.category] || categoryColors.outro}`}>
                    {categoryLabels[expense.category] || expense.category}
                  </Badge>
                  {expense.isRecurring && (
                    <Badge className="text-[10px] bg-amber-100 text-amber-700">
                      <RotateCcw className="mr-1 h-2.5 w-2.5" />
                      {expense.recurrenceFreq || "mensal"}
                    </Badge>
                  )}
                  {expense.receiptUrl && (
                    <Badge className="text-[10px] bg-blue-100 text-blue-700">
                      <ImageIcon className="mr-1 h-2.5 w-2.5" />
                      Comprovante
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <p className="text-[10px] text-zinc-400">
                    {new Date(expense.date).toLocaleDateString("pt-BR")}
                  </p>
                  <span className="text-[10px] text-zinc-400">
                    {paymentIcons[expense.paymentMethod] || ""} {paymentLabels[expense.paymentMethod] || expense.paymentMethod}
                  </span>
                  {expense.cashRegisterId && (
                    <span className="text-[10px] text-amber-600 font-medium">Vinculado ao caixa</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold text-red-500 mr-1">-{formatCurrency(expense.amount)}</span>
                <button onClick={() => openEdit(expense)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-blue-600 transition-colors" title="Editar">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setConfirmDelete({ open: true, id: expense.id, description: expense.description })} className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="Excluir">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={confirmDelete.open}
        title="Excluir despesa"
        message={`Tem certeza que deseja excluir "${confirmDelete.description}"?`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        confirmed={false}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete({ open: false, id: "", description: "" })}
      />
    </div>
  )
}

function CustomSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
      >
        <span className="truncate max-w-[120px]">{selected?.label}</span>
        <ChevronDown className={`h-3 w-3 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-zinc-200 bg-white shadow-lg py-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${opt.value === value ? "bg-green-50 text-green-700 font-medium" : "text-zinc-600 hover:bg-zinc-50"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
