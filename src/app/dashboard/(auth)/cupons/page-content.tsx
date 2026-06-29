"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Tag, Plus, Trash2, ToggleLeft, ToggleRight, Percent, DollarSign, Loader2, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { fetchAuth } from "@/lib/fetch-auth"
import { useToast } from "@/components/toast"
import { ConfirmDialog } from "@/components/confirm-dialog"

interface Coupon {
  id: string
  code: string
  type: string
  value: number
  minOrder: number
  maxUses: number | null
  usedCount: number
  active: boolean
  expiresAt: string | null
  createdAt: string
}

export default function CuponsPage() {
  const searchParams = useSearchParams()
  const hookEstablishmentId = useEstablishmentId()
  const establishmentId = searchParams.get("establishment") || hookEstablishmentId
  const { toast } = useToast()

  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string }>({ open: false, id: "" })
  const [codeError, setCodeError] = useState("")
  const [form, setForm] = useState({
    code: "",
    type: "percent",
    value: "",
    minOrder: "",
    maxUses: "",
    expiresAt: "",
  })

  useEffect(() => {
    if (!establishmentId) return
    fetchAuth(`/api/coupons?establishmentId=${establishmentId}`)
      .then((r) => r.json())
      .then(setCoupons)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [establishmentId])

  function handleCodeChange(value: string) {
    const sanitized = value.toUpperCase().replace(/[^A-Z0-9_]/g, "")
    setForm({ ...form, code: sanitized })
    setCodeError("")
  }

  async function handleCreate() {
    if (!form.code || !form.value) return
    if (form.code.length < 3) {
      setCodeError("Código deve ter pelo menos 3 caracteres")
      return
    }
    setSaving(true)
    try {
      const res = await fetchAuth("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          type: form.type,
          value: parseFloat(form.value),
          minOrder: form.minOrder ? parseFloat(form.minOrder) : 0,
          maxUses: form.maxUses ? parseInt(form.maxUses) : null,
          expiresAt: form.expiresAt || null,
          establishmentId,
        }),
      })
      if (res.ok) {
        const coupon = await res.json()
        setCoupons([coupon, ...coupons])
        setShowForm(false)
        setForm({ code: "", type: "percent", value: "", minOrder: "", maxUses: "", expiresAt: "" })
        toast("Cupom criado com sucesso", "success")
      } else {
        const data = await res.json()
        toast(data.error || "Erro ao criar cupom", "error")
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(coupon: Coupon) {
    await fetchAuth(`/api/coupons/${coupon.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !coupon.active }),
    })
    setCoupons(coupons.map((c) => c.id === coupon.id ? { ...c, active: !c.active } : c))
  }

  function handleDeleteClick(id: string) {
    setDeleteConfirm({ open: true, id })
  }

  async function confirmDelete() {
    await fetchAuth(`/api/coupons/${deleteConfirm.id}`, { method: "DELETE" })
    setCoupons(coupons.filter((c) => c.id !== deleteConfirm.id))
    toast("Cupom removido", "success")
    setDeleteConfirm({ open: false, id: "" })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-flow-blue" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-flow-white">Cupons de Desconto</h1>
          <p className="text-sm text-zinc-500">{coupons.length} cupons</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-flow-blue hover:bg-green-700">
          <Plus className="mr-2 h-4 w-4" />
          Novo cupom
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Novo Cupom</h3>
              <button onClick={() => setShowForm(false)}>
                <X className="h-5 w-5 text-zinc-400" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500">Código</label>
                <Input
                  placeholder="DESCONTO10"
                  value={form.code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  className="uppercase"
                />
                {codeError && <p className="mt-1 text-xs text-red-500">{codeError}</p>}
              </div>
              <div>
                <label className="text-xs text-zinc-500">Tipo</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full rounded-lg border border-white/[.06] px-3 py-2 text-sm"
                >
                  <option value="percent">Percentual (%)</option>
                  <option value="fixed">Fixo (R$)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500">Valor</label>
                <Input
                  type="number"
                  placeholder={form.type === "percent" ? "10" : "5.00"}
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500">Pedido mínimo (R$)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.minOrder}
                  onChange={(e) => setForm({ ...form, minOrder: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500">Máx. usos</label>
                <Input
                  type="number"
                  placeholder="Ilimitado"
                  value={form.maxUses}
                  onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500">Expira em</label>
                <Input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                />
              </div>
            </div>
            <Button onClick={handleCreate} disabled={saving} className="bg-flow-blue hover:bg-green-700">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Criar cupom
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {coupons.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center py-10 text-center">
              <Tag className="h-10 w-10 text-zinc-300 mb-2" />
              <p className="text-sm text-zinc-500">Nenhum cupom criado</p>
            </CardContent>
          </Card>
        )}

        {coupons.map((coupon) => (
          <Card key={coupon.id} className={!coupon.active ? "opacity-50" : ""}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-flow-blue/10 text-flow-blue font-bold text-sm">
                {coupon.type === "percent" ? `${coupon.value}%` : `R$${coupon.value}`}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-mono font-bold text-sm text-flow-white">{coupon.code}</p>
                  {coupon.minOrder > 0 && (
                    <Badge variant="info" className="text-[10px]">
                      min R${coupon.minOrder}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-zinc-500">
                  {coupon.usedCount} uso{coupon.usedCount !== 1 ? "s" : ""}
                  {coupon.maxUses ? ` / ${coupon.maxUses} máx.` : " / ilimitado"}
                  {coupon.expiresAt && ` • expira ${new Date(coupon.expiresAt).toLocaleDateString("pt-BR")}`}
                </p>
              </div>
              <button onClick={() => toggleActive(coupon)}>
                {coupon.active ? (
                  <ToggleRight className="h-7 w-7 text-flow-blue" />
                ) : (
                  <ToggleLeft className="h-7 w-7 text-zinc-300" />
                )}
              </button>
              <button onClick={() => handleDeleteClick(coupon.id)} className="text-red-400 hover:text-red-400">
                <Trash2 className="h-4 w-4" />
              </button>
            </CardContent>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={deleteConfirm.open}
        title="Remover cupom"
        message="Tem certeza que deseja remover este cupom? Esta ação não pode ser desfeita."
        confirmLabel="Remover"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ open: false, id: "" })}
      />
    </div>
  )
}
