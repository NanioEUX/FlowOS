"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Plus, Trash2, Loader2, X, Filter } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { fetchAuth } from "@/lib/fetch-auth"

interface Expense {
  id: string
  description: string
  amount: number
  category: string
  date: string
  createdAt: string
}

const categoryLabels: Record<string, string> = {
  fixa: "Fixa",
  variavel: "Variável",
  motoboy: "Motoboy",
  insumo: "Insumo",
  outro: "Outro",
}

const categoryColors: Record<string, string> = {
  fixa: "bg-green-600/15 text-green-600",
  variavel: "bg-yellow-100 text-yellow-700",
  motoboy: "bg-orange-100 text-orange-700",
  insumo: "bg-purple-100 text-purple-700",
  outro: "bg-zinc-100 text-zinc-700",
}

export default function DespesasPage() {
  const searchParams = useSearchParams()
  const hookEstablishmentId = useEstablishmentId()
  const establishmentId = searchParams.get("establishment") || hookEstablishmentId

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterCategory, setFilterCategory] = useState("all")
  const [form, setForm] = useState({ description: "", amount: "", category: "variavel", date: "" })

  useEffect(() => {
    if (!establishmentId) return
    fetchAuth(`/api/expenses?establishmentId=${establishmentId}`)
      .then((r) => r.json())
      .then(setExpenses)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [establishmentId])

  async function handleCreate() {
    if (!form.description || !form.amount) return
    setSaving(true)
    try {
      const res = await fetchAuth("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: form.description,
          amount: parseFloat(form.amount),
          category: form.category,
          date: form.date || undefined,
          establishmentId,
        }),
      })
      if (res.ok) {
        const expense = await res.json()
        setExpenses([expense, ...expenses])
        setShowForm(false)
        setForm({ description: "", amount: "", category: "variavel", date: "" })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir despesa?")) return
    await fetchAuth(`/api/expenses/${id}`, { method: "DELETE" })
    setExpenses(expenses.filter((e) => e.id !== id))
  }

  const filtered = filterCategory === "all" ? expenses : expenses.filter((e) => e.category === filterCategory)
  const totalFiltered = filtered.reduce((sum, e) => sum + e.amount, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Despesas</h1>
          <p className="text-sm text-zinc-500">{filtered.length} despesas • {formatCurrency(totalFiltered)}</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-green-600 hover:bg-green-700">
          <Plus className="mr-2 h-4 w-4" />
          Nova despesa
        </Button>
      </div>

      {/* Category filter */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {["all", "fixa", "variavel", "motoboy", "insumo", "outro"].map((cat) => (
          <button key={cat} onClick={() => setFilterCategory(cat)} className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors ${filterCategory === cat ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-white/[.08]"}`}>
            {cat === "all" ? "Todas" : categoryLabels[cat]}
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Nova Despesa</h3>
              <button onClick={() => setShowForm(false)}><X className="h-4 w-4 text-zinc-400" /></button>
            </div>
            <input placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none" />
            <input type="number" placeholder="Valor (R$)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none" />
            <div className="grid grid-cols-2 gap-3">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm">
                <option value="fixa">Fixa</option>
                <option value="variavel">Variável</option>
                <option value="motoboy">Motoboy</option>
                <option value="insumo">Insumo</option>
                <option value="outro">Outro</option>
              </select>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none" />
            </div>
            <Button onClick={handleCreate} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Criar despesa
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Expenses list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center py-10 text-center">
              <p className="text-sm text-zinc-500">Nenhuma despesa registrada</p>
            </CardContent>
          </Card>
        )}

        {filtered.map((expense) => (
          <Card key={expense.id}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-zinc-900 truncate">{expense.description}</p>
                  <Badge className={`text-[10px] ${categoryColors[expense.category] || categoryColors.outro}`}>
                    {categoryLabels[expense.category] || expense.category}
                  </Badge>
                </div>
                <p className="text-[10px] text-zinc-400">
                  {new Date(expense.date).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-red-400">-{formatCurrency(expense.amount)}</span>
                <button onClick={() => handleDelete(expense.id)} className="text-zinc-700 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
