"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Lock, Unlock, DollarSign, TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle, Loader2, X, Plus, ArrowRightLeft } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

import { formatCurrency } from "@/lib/utils"
import { fetchAuth } from "@/lib/fetch-auth"

interface CashRegister {
  id: string
  openingAmount: number
  closingAmount: number | null
  expectedAmount: number | null
  status: string
  notes: string | null
  currentUserId: string | null
  establishmentId: string
  createdAt: string
  closedAt: string | null
  movements: CashMovement[]
  transfers: CashTransfer[]
}

interface CashMovement {
  id: string
  type: string
  amount: number
  description: string | null
  paymentMethod: string | null
  createdAt: string
}

interface CashTransfer {
  id: string
  fromUserId: string
  toUserId: string
  amount: number
  notes: string | null
  createdAt: string
}

interface User {
  id: string
  name: string
  email: string
}

export default function CaixaFinanceiroPage() {
  const searchParams = useSearchParams()
  const hookEstablishmentId = useEstablishmentId()
  const establishmentId = searchParams.get("establishment") || hookEstablishmentId

  const [register, setRegister] = useState<CashRegister | null>(null)
  const [loading, setLoading] = useState(true)
  const [openingAmount, setOpeningAmount] = useState("")
  const [closingAmount, setClosingAmount] = useState("")
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferAmount, setTransferAmount] = useState("")
  const [transferToUser, setTransferToUser] = useState("")
  const [transferNotes, setTransferNotes] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [expenseForm, setExpenseForm] = useState({ description: "", amount: "", category: "variavel" })
  const [saving, setSaving] = useState(false)

  async function loadRegister() {
    if (!establishmentId) return
    try {
      const res = await fetchAuth(`/api/cash-register?establishmentId=${establishmentId}`)
      const data = await res.json()
      setRegister(data)
    } catch {}
    setLoading(false)
  }

  async function loadUsers() {
    if (!establishmentId) return
    try {
      const res = await fetchAuth(`/api/users?establishmentId=${establishmentId}`)
      const data = await res.json()
      setUsers(data.filter((u: User) => u.id !== JSON.parse(localStorage.getItem("pedefacil-user") || "{}").id))
    } catch {}
  }

  useEffect(() => { loadRegister(); loadUsers() }, [establishmentId])

  async function openRegister() {
    setSaving(true)
    try {
      await fetchAuth("/api/cash-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openingAmount: parseFloat(openingAmount) || 0,
          establishmentId,
        }),
      })
      setOpeningAmount("")
      await loadRegister()
    } finally {
      setSaving(false)
    }
  }

  async function closeRegister() {
    if (!register) return
    setSaving(true)
    try {
      await fetchAuth(`/api/cash-register/${register.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closingAmount: parseFloat(closingAmount) || undefined,
        }),
      })
      setClosingAmount("")
      await loadRegister()
    } finally {
      setSaving(false)
    }
  }

  async function addMovement(type: "withdrawal" | "injection") {
    const desc = type === "withdrawal" ? "Sangria" : "Suprimento"
    const amount = prompt(`${desc}: Valor (R$)`)
    if (!amount || isNaN(parseFloat(amount))) return

    setSaving(true)
    try {
      await fetchAuth(`/api/cash-register/${register!.id}/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          amount: parseFloat(amount),
          description: desc,
        }),
      })
      await loadRegister()
    } finally {
      setSaving(false)
    }
  }

  async function addExpense() {
    if (!register || !expenseForm.description || !expenseForm.amount) return
    setSaving(true)
    try {
      await fetchAuth("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: expenseForm.description,
          amount: parseFloat(expenseForm.amount),
          category: expenseForm.category,
          cashRegisterId: register.id,
          establishmentId,
        }),
      })
      setExpenseForm({ description: "", amount: "", category: "variavel" })
      setShowExpenseForm(false)
      await loadRegister()
    } finally {
      setSaving(false)
    }
  }

  async function transferCashRegister() {
    if (!register || !transferToUser || !transferAmount) return
    setSaving(true)
    try {
      await fetchAuth(`/api/cash-register/${register.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUserId: transferToUser,
          amount: parseFloat(transferAmount),
          notes: transferNotes || null,
        }),
      })
      setTransferAmount("")
      setTransferToUser("")
      setTransferNotes("")
      setShowTransferModal(false)
      await loadRegister()
    } finally {
      setSaving(false)
    }
  }

  const totalIn = register?.movements.filter((m) => m.amount > 0).reduce((sum, m) => sum + m.amount, 0) || 0
  const totalOut = register?.movements.filter((m) => m.amount < 0).reduce((sum, m) => sum + Math.abs(m.amount), 0) || 0
  const currentBalance = (register?.openingAmount || 0) + totalIn - totalOut

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    )
  }

  if (!register) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-zinc-900">Caixa</h1>
        <Card>
          <CardContent className="flex flex-col items-center py-10 gap-4">
            <Lock className="h-12 w-12 text-zinc-300" />
            <p className="text-zinc-500">Nenhum caixa aberto</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Valor inicial (R$)"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                className="flex h-10 w-40 items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
              />
              <Button onClick={openRegister} disabled={saving} className="bg-green-600 hover:bg-green-700">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4 mr-2" />}
                Abrir Caixa
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Caixa Aberto</h1>
          <p className="text-xs text-zinc-500">Aberto às {new Date(register.createdAt).toLocaleTimeString("pt-BR")}</p>
        </div>
        <Button onClick={() => addMovement("injection")} variant="outline" size="sm">
          <ArrowDownCircle className="h-4 w-4 mr-1" /> Suprimento
        </Button>
      </div>

      {/* Balance */}
      <Card className="border-green-600/20 bg-green-600/10">
        <CardContent className="p-4 text-center">
          <p className="text-xs text-green-600">Saldo do Caixa</p>
          <p className="text-3xl font-bold text-green-600">{formatCurrency(currentBalance)}</p>
          <div className="flex justify-center gap-4 mt-2 text-xs text-green-600">
            <span>Abertura: {formatCurrency(register.openingAmount)}</span>
            <span>Entradas: +{formatCurrency(totalIn)}</span>
            <span>Saídas: -{formatCurrency(totalOut)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={() => addMovement("withdrawal")} variant="outline" size="sm" className="text-orange-600">
          <ArrowUpCircle className="h-4 w-4 mr-1" /> Sangria
        </Button>
        <Button onClick={() => setShowExpenseForm(true)} variant="outline" size="sm" className="text-red-400">
          <Plus className="h-4 w-4 mr-1" /> Despesa
        </Button>
        <Button onClick={() => { setTransferAmount(currentBalance.toString()); setShowTransferModal(true) }} variant="outline" size="sm" className="text-green-600">
          <ArrowRightLeft className="h-4 w-4 mr-1" /> Transferir
        </Button>
        <div className="flex-1" />
        <Button onClick={closeRegister} variant="danger" size="sm">
          <Lock className="h-4 w-4 mr-1" /> Fechar Caixa
        </Button>
      </div>

      {/* Close form */}
      <Card className="border-zinc-200">
        <CardContent className="p-3">
          <p className="text-xs text-zinc-500 mb-2">Fechar caixa — informe o valor contado:</p>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder={`Esperado: ${formatCurrency(currentBalance)}`}
              value={closingAmount}
              onChange={(e) => setClosingAmount(e.target.value)}
              className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
            />
            <Button onClick={closeRegister} disabled={saving} variant="danger">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </Button>
          </div>
          {closingAmount && parseFloat(closingAmount) !== currentBalance && (
            <p className={`text-xs mt-1 ${parseFloat(closingAmount) > currentBalance ? "text-green-600" : "text-red-400"}`}>
              {parseFloat(closingAmount) > currentBalance ? "Sobra" : "Falta"}: {formatCurrency(Math.abs(parseFloat(closingAmount) - currentBalance))}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Expense form modal */}
      {showExpenseForm && (
        <Card className="border-red-500/20">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Registrar Despesa no Caixa</h3>
              <button onClick={() => setShowExpenseForm(false)}><X className="h-4 w-4 text-zinc-400" /></button>
            </div>
            <input placeholder="Descrição" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none" />
            <input type="number" placeholder="Valor (R$)" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none" />
            <select value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm">
              <option value="fixa">Fixa</option>
              <option value="variavel">Variável</option>
              <option value="motoboy">Motoboy</option>
              <option value="insumo">Insumo</option>
              <option value="outro">Outro</option>
            </select>
            <Button onClick={addExpense} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Transfer modal */}
      {showTransferModal && (
        <Card className="border-green-600/20">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Transferir Caixa</h3>
              <button onClick={() => setShowTransferModal(false)}><X className="h-4 w-4 text-zinc-400" /></button>
            </div>
            <p className="text-xs text-zinc-500">
              Informe o valor em espécie no caixa e selecione o atendente que vai assumir.
            </p>
            <div className="rounded-lg bg-green-600/10 p-3">
              <p className="text-xs text-green-600">Saldo atual: {formatCurrency(currentBalance)}</p>
            </div>
            <input
              type="number"
              placeholder="Valor em espécie (R$)"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
            />
            <select
              value={transferToUser}
              onChange={(e) => setTransferToUser(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            >
              <option value="">Selecione o atendente</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <input
              placeholder="Observações (opcional)"
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
              className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
            />
            <Button
              onClick={transferCashRegister}
              disabled={saving || !transferToUser || !transferAmount}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar Transferência"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Movements */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 font-semibold text-sm text-zinc-900">Movimentações ({register.movements.length})</h3>
          {register.movements.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center py-4">Nenhuma movimentação</p>
          ) : (
            <div className="space-y-1">
              {register.movements.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-white/[.04] p-2">
                  <div className="flex items-center gap-2">
                    {m.amount >= 0 ? (
                      <ArrowDownCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <ArrowUpCircle className="h-4 w-4 text-red-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{m.description || m.type}</p>
                      <p className="text-[10px] text-zinc-400">{new Date(m.createdAt).toLocaleTimeString("pt-BR")}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${m.amount >= 0 ? "text-green-600" : "text-red-400"}`}>
                    {m.amount >= 0 ? "+" : ""}{formatCurrency(m.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
