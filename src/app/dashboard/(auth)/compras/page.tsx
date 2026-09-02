"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { fetchAuth } from "@/lib/fetch-auth"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2, Plus, Search, ShoppingCart } from "lucide-react"

interface StockItem {
  id: string
  name: string
  unit: string
  unitCost: number
  quantity: number
  categoryId: string
  category?: { name: string }
}

interface PurchaseItemForm {
  stockItemId: string
  name: string
  quantity: string
  unit: string
  unitCost: string
  totalCost: number
}

export default function ComprasPage() {
  const searchParams = useSearchParams()
  const hookEstablishmentId = useEstablishmentId()
  const establishmentId = searchParams.get("establishment") || hookEstablishmentId

  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [supplierName, setSupplierName] = useState("")
  const [documentNumber, setDocumentNumber] = useState("")
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState("dinheiro")
  const [paymentCondition, setPaymentCondition] = useState("avista")
  const [expenseType, setExpenseType] = useState("lancamento")
  const [dueDate, setDueDate] = useState("")
  const [recurrenceFreq, setRecurrenceFreq] = useState("mensal")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<PurchaseItemForm[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [showItemPicker, setShowItemPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [recentPurchases, setRecentPurchases] = useState<any[]>([])

  const totalAmount = items.reduce((sum, item) => sum + item.totalCost, 0)

  useEffect(() => {
    if (!establishmentId) return
    fetchAuth(`/api/stock-items?establishmentId=${establishmentId}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setStockItems)
      .catch(() => {})
    fetchAuth(`/api/purchases?establishmentId=${establishmentId}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setRecentPurchases)
      .catch(() => {})
  }, [establishmentId])

  const filteredItems = stockItems.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const addItem = (item: StockItem) => {
    const existing = items.find((i) => i.stockItemId === item.id)
    if (existing) {
      setItems(items.map((i) =>
        i.stockItemId === item.id
          ? { ...i, quantity: String(Number(i.quantity) + 1), totalCost: (Number(i.quantity) + 1) * Number(i.unitCost) }
          : i
      ))
    } else {
      setItems([...items, {
        stockItemId: item.id,
        name: item.name,
        quantity: "1",
        unit: item.unit,
        unitCost: String(item.unitCost || 0),
        totalCost: item.unitCost || 0,
      }])
    }
    setSearchTerm("")
    setShowItemPicker(false)
  }

  const updateItem = (index: number, field: keyof PurchaseItemForm, value: any) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    if (field === "quantity" || field === "unitCost") {
      updated[index].totalCost = Number(updated[index].quantity || 0) * Number(updated[index].unitCost || 0)
    }
    setItems(updated)
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (items.length === 0) return alert("Adicione pelo menos um insumo")
    setSaving(true)
    try {
      const res = await fetchAuth("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierName: supplierName || null,
          documentNumber: documentNumber || null,
          purchaseDate,
          items: items.map((i) => ({
            stockItemId: i.stockItemId,
            stockItemName: i.name,
            quantity: Number(i.quantity),
            unit: i.unit,
            unitCost: Number(i.unitCost),
            totalCost: i.totalCost,
          })),
          paymentMethod,
          paymentCondition,
          expenseType,
          dueDate: expenseType === "agendada" && dueDate ? dueDate : null,
          recurrenceFreq: expenseType === "recorrente" ? recurrenceFreq : null,
          notes: notes || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || "Erro ao salvar")
        return
      }
      alert("Compra salva com sucesso!")
      setItems([])
      setSupplierName("")
      setDocumentNumber("")
      setNotes("")
      fetchAuth(`/api/purchases?establishmentId=${establishmentId}`)
        .then((r) => r.ok ? r.json() : [])
        .then(setRecentPurchases)
    } catch {
      alert("Erro ao salvar compra")
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h2 className="text-2xl font-bold text-zinc-900">Nova Entrada de Compra</h2>

      {/* Header */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Fornecedor</label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Nome do fornecedor"
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-green-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Data da Compra</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-green-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Nº Documento / Cupom</label>
              <input
                type="text"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="Número do documento"
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-green-600 focus:outline-none"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items Grid */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900">Insumos</h3>
            <Button size="sm" onClick={() => setShowItemPicker(true)}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
              <ShoppingCart className="mx-auto h-8 w-8 text-zinc-300" />
              <p className="mt-2 text-sm text-zinc-500">Nenhum insumo adicionado</p>
              <p className="text-xs text-zinc-400">Clique em "Adicionar" para começar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs font-medium text-zinc-500">
                    <th className="pb-2">Insumo</th>
                    <th className="pb-2 w-20">Qtd</th>
                    <th className="pb-2 w-16">Un</th>
                    <th className="pb-2 w-28">Preço Unit.</th>
                    <th className="pb-2 w-28">Total</th>
                    <th className="pb-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b border-zinc-100">
                      <td className="py-2 font-medium text-zinc-900">{item.name}</td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                          className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="py-2 text-zinc-500">{item.unit}</td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitCost}
                          onChange={(e) => updateItem(idx, "unitCost", e.target.value)}
                          className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="py-2 font-semibold text-zinc-900">{formatCurrency(item.totalCost)}</td>
                      <td className="py-2">
                        <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-zinc-300">
                    <td colSpan={4} className="py-2 text-right font-semibold text-zinc-900">Total:</td>
                    <td className="py-2 text-lg font-bold text-green-600">{formatCurrency(totalAmount)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Item Picker Modal */}
          {showItemPicker && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="mx-4 w-full max-w-md rounded-xl bg-white shadow-2xl">
                <div className="border-b border-zinc-200 px-4 py-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      autoFocus
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar insumo..."
                      className="w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-3 py-2 text-sm focus:border-green-600 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {filteredItems.length === 0 ? (
                    <p className="p-4 text-sm text-zinc-400 text-center">Nenhum insumo encontrado</p>
                  ) : (
                    filteredItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => addItem(item)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-50 border-b border-zinc-100"
                      >
                        <div>
                          <p className="text-sm font-medium text-zinc-900">{item.name}</p>
                          <p className="text-xs text-zinc-500">{item.unit} | Estoque: {item.quantity}</p>
                        </div>
                        <span className="text-xs text-zinc-400">{formatCurrency(item.unitCost)}/{item.unit}</span>
                      </button>
                    ))
                  )}
                </div>
                <div className="border-t border-zinc-200 px-4 py-2">
                  <button onClick={() => setShowItemPicker(false)} className="w-full text-sm text-zinc-500 hover:text-zinc-700 py-1">
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Financial Section */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-900">Pagamento</h3>

          {/* Tipo */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-2">Tipo</label>
            <div className="flex gap-2">
              {[
                { value: "lancamento", label: "Lançamento" },
                { value: "agendada", label: "Agendada" },
                { value: "recorrente", label: "Recorrente" },
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => setExpenseType(t.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    expenseType === t.value
                      ? "bg-green-600 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Condição */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-2">Condição</label>
            <div className="flex gap-2">
              <button
                onClick={() => setPaymentCondition("avista")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  paymentCondition === "avista"
                    ? "bg-green-600 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                À vista
              </button>
              <button
                onClick={() => setPaymentCondition("prazo")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  paymentCondition === "prazo"
                    ? "bg-green-600 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                Prazo
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Forma de Pagamento */}
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Forma de Pagamento</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-green-600 focus:outline-none"
              >
                <option value="dinheiro">💵 Dinheiro</option>
                <option value="cartao">💳 Cartão</option>
                <option value="pix">📱 Pix</option>
                <option value="transferencia">🏦 Transferência</option>
                <option value="boleto">📄 Boleto</option>
              </select>
            </div>

            {/* Data de vencimento (se agendada) */}
            {expenseType === "agendada" && (
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Data de Vencimento</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-green-600 focus:outline-none"
                />
              </div>
            )}

            {/* Recorrência (se recorrente) */}
            {expenseType === "recorrente" && (
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Repetir a cada</label>
                <select
                  value={recurrenceFreq}
                  onChange={(e) => setRecurrenceFreq(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-green-600 focus:outline-none"
                >
                  <option value="semanal">Semanal</option>
                  <option value="mensal">Mensal</option>
                  <option value="trimestral">Trimestral</option>
                </select>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Observações</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Notas sobre a compra..."
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-green-600 focus:outline-none resize-none"
            />
          </div>

          {/* Save */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-200">
            <div>
              <p className="text-xs text-zinc-500">Total da compra</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(totalAmount)}</p>
            </div>
            <Button onClick={handleSave} disabled={saving || items.length === 0}>
              {saving ? "Salvando..." : "Salvar e atualizar estoque"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Purchases */}
      {recentPurchases.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-zinc-900 mb-3">Últimas Compras</h3>
            <div className="space-y-2">
              {recentPurchases.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {p.supplierName || "Compra"} {p.documentNumber ? `#${p.documentNumber}` : ""}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {new Date(p.purchaseDate).toLocaleDateString("pt-BR")} | {p.items?.length || 0} itens
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-zinc-900">{formatCurrency(p.totalAmount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
