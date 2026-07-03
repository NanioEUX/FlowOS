"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Package, Plus, Trash2, AlertTriangle, ArrowUpCircle, ArrowDownCircle, X, Tag } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import { formatCurrency } from "@/lib/utils"
import { fetchAuth } from "@/lib/fetch-auth"
import { useToast } from "@/components/toast"
import { ConfirmDialog } from "@/components/confirm-dialog"

const units = [
  { value: "un", label: "Unidade" },
  { value: "kg", label: "Quilograma" },
  { value: "g", label: "Grama" },
  { value: "L", label: "Litro" },
  { value: "ml", label: "Mililitro" },
  { value: "cx", label: "Caixa" },
  { value: "pct", label: "Pacote" },
  { value: "dz", label: "Dúzia" },
]

export default function EstoquePage() {
  const searchParams = useSearchParams()
  const hookEstablishmentId = useEstablishmentId()
  const searchParamsEstablishmentId = searchParams.get("establishment")
  const establishmentId = searchParamsEstablishmentId || hookEstablishmentId
  const { toast } = useToast()
  const [categories, setCategories] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"items" | "movements">("items")
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: "", name: "" })
  const [movementError, setMovementError] = useState("")

  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [newCatName, setNewCatName] = useState("")

  const [showItemForm, setShowItemForm] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [itemForm, setItemForm] = useState({ name: "", unit: "un", quantity: "0", minQuantity: "0", unitCost: "0", supplier: "", categoryId: "" })
  const [products, setProducts] = useState<any[]>([])
  const [linkProductId, setLinkProductId] = useState("")
  const [linkQuantity, setLinkQuantity] = useState("1")

  const [showMovementForm, setShowMovementForm] = useState(false)
  const [movementForm, setMovementForm] = useState({ itemId: "", movementType: "entry", quantity: "1", unitCost: "0", notes: "" })

  async function loadAll() {
    if (!establishmentId) return
    const res = await fetchAuth(`/api/stock?establishmentId=${establishmentId}`)
    if (res.ok) {
      const data = await res.json()
      setCategories(data.categories)
      setItems(data.items)
      setMovements(data.movements)
    }
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [establishmentId])

  const lowStockItems = items.filter((i) => i.minQuantity > 0 && i.quantity <= i.minQuantity)
  const totalStockValue = items.reduce((s, i) => s + i.quantity * i.unitCost, 0)

  async function addCategory() {
    if (!newCatName.trim() || !establishmentId) return
    await fetchAuth("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "category", name: newCatName, establishmentId }),
    })
    setNewCatName("")
    setShowCategoryForm(false)
    loadAll()
  }

  async function saveItem() {
    if (!establishmentId || !itemForm.name || !itemForm.categoryId) return
    const body = {
      ...itemForm,
      type: "item",
      quantity: parseFloat(itemForm.quantity) || 0,
      minQuantity: parseFloat(itemForm.minQuantity) || 0,
      unitCost: parseFloat(itemForm.unitCost) || 0,
      establishmentId,
    }
    if (editingItem) {
      await fetchAuth(`/api/stock/${editingItem.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    } else {
      await fetchAuth("/api/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    }
    setItemForm({ name: "", unit: "un", quantity: "0", minQuantity: "0", unitCost: "0", supplier: "", categoryId: "" })
    setEditingItem(null)
    setShowItemForm(false)
    loadAll()
    window.dispatchEvent(new Event("stock-updated"))
  }

  function editItem(item: any) {
    setEditingItem(item)
    setItemForm({
      name: item.name,
      unit: item.unit,
      quantity: String(item.quantity),
      minQuantity: String(item.minQuantity),
      unitCost: String(item.unitCost),
      supplier: item.supplier || "",
      categoryId: item.categoryId,
    })
    setLinkProductId("")
    setLinkQuantity("1")
    setShowItemForm(true)
    if (establishmentId) {
      fetchAuth(`/api/products?establishmentId=${establishmentId}`).then((r) => r.json()).then((data) => setProducts(Array.isArray(data) ? data : [])).catch(() => setProducts([]))
    }
  }

  async function linkProduct() {
    if (!editingItem || !linkProductId || !linkQuantity) return
    const res = await fetchAuth("/api/stock/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stockItemId: editingItem.id, productId: linkProductId, quantity: parseFloat(linkQuantity) }),
    })
    if (res.ok) {
      toast("Produto vinculado", "success")
      setLinkProductId("")
      setLinkQuantity("1")
      loadAll()
    } else {
      const data = await res.json()
      toast(data.error || "Erro ao vincular", "error")
    }
  }

  async function unlinkProduct(productId: string) {
    if (!editingItem) return
    const res = await fetchAuth("/api/stock/links", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stockItemId: editingItem.id, productId }),
    })
    if (res.ok) {
      toast("Produto desvinculado", "success")
      loadAll()
    }
  }

  function handleDeleteItem(id: string, name: string) {
    setDeleteConfirm({ open: true, id, name })
  }

  async function confirmDeleteItem() {
    await fetchAuth(`/api/stock/${deleteConfirm.id}`, { method: "DELETE" })
    toast("Item removido com sucesso", "success"); window.dispatchEvent(new Event("stock-updated"))
    setDeleteConfirm({ open: false, id: "", name: "" })
    loadAll()
  }

  async function saveMovement() {
    if (!movementForm.itemId || !movementForm.quantity) return
    setMovementError("")

    if (movementForm.movementType === "exit") {
      const item = items.find((i) => i.id === movementForm.itemId)
      const qty = parseFloat(movementForm.quantity) || 0
      if (item && qty > item.quantity) {
        setMovementError(`Estoque insuficiente. Disponível: ${item.quantity} ${item.unit}`)
        return
      }
    }

    const res = await fetchAuth("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "movement",
        itemId: movementForm.itemId,
        movementType: movementForm.movementType,
        quantity: parseFloat(movementForm.quantity) || 0,
        unitCost: parseFloat(movementForm.unitCost) || 0,
        notes: movementForm.notes,
      }),
    })
    if (res.ok) {
      toast("Movimentação registrada", "success"); window.dispatchEvent(new Event("stock-updated"))
    } else {
      const data = await res.json()
      toast(data.error || "Erro ao registrar movimentação", "error")
    }
    setMovementForm({ itemId: "", movementType: "entry", quantity: "1", unitCost: "0", notes: "" })
    setShowMovementForm(false)
    loadAll()
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-900">Estoque</h2>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => { setEditingItem(null); setItemForm({ name: "", unit: "un", quantity: "0", minQuantity: "0", unitCost: "0", supplier: "", categoryId: categories[0]?.id || "" }); setShowItemForm(true) }} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Item
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowMovementForm(true)} className="gap-2">
            <ArrowUpCircle className="h-4 w-4" /> Movimentar
          </Button>
        </div>
      </div>

      {/* Alertas */}
      {lowStockItems.length > 0 && (
        <Card className="border-amber-500/20 bg-amber-500/10">
          <CardContent className="p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-400 mb-2">
              <AlertTriangle className="h-4 w-4" />
              Estoque Baixo ({lowStockItems.length})
            </h3>
            <div className="space-y-1">
              {lowStockItems.map((item) => (
                <p key={item.id} className="text-sm text-amber-400">
                  {item.name} — {item.quantity} {item.unit} (mín: {item.minQuantity})
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-zinc-900">{items.length}</p>
            <p className="text-xs text-zinc-500">Itens cadastrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-green-600">{formatCurrency(totalStockValue)}</p>
            <p className="text-xs text-zinc-500">Valor em estoque</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-amber-400">{lowStockItems.length}</p>
            <p className="text-xs text-zinc-500">Abaixo do mínimo</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200">
        <button onClick={() => setTab("items")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "items" ? "border-green-600 text-green-600" : "border-transparent text-zinc-500 hover:text-zinc-500"}`}>
          Itens
        </button>
        <button onClick={() => setTab("movements")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "movements" ? "border-green-600 text-green-600" : "border-transparent text-zinc-500 hover:text-zinc-500"}`}>
          Movimentações
        </button>
      </div>

      {/* Items Tab */}
      {tab === "items" && (
        <div className="space-y-4">
          {categories.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-4">
              Crie categorias primeiro para organizar seus insumos.
              <button onClick={() => setShowCategoryForm(true)} className="ml-2 text-green-600 underline">Criar categoria</button>
            </p>
          )}
          {categories.map((cat) => {
            const catItems = items.filter((i) => i.categoryId === cat.id)
            return (
              <Card key={cat.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
                      <Tag className="h-4 w-4 text-zinc-400" />
                      {cat.name}
                    </h3>
                    <span className="text-xs text-zinc-400">{catItems.length} itens</span>
                  </div>
                  {catItems.length === 0 ? (
                    <p className="text-sm text-zinc-400">Nenhum item nesta categoria</p>
                  ) : (
                    <div className="space-y-2">
                      {catItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded-lg border border-white/[.04] bg-zinc-50 p-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-zinc-900">{item.name}</p>
                              {item.minQuantity > 0 && item.quantity <= item.minQuantity && (
                                <Badge variant="warning">Estoque baixo</Badge>
                              )}
                              {item.products && item.products.length > 0 && (
                                <Badge variant="success">Vendável</Badge>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500">
                              {item.quantity} {item.unit} • {formatCurrency(item.unitCost)}/{item.unit}
                              {item.supplier && ` • ${item.supplier}`}
                            </p>
                            {item.productLinks.length > 0 && (
                              <p className="text-xs text-blue-500 mt-0.5">
                                Vinculado a: {item.productLinks.map((l: any) => l.product.name).join(", ")}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => editItem(item)} className="text-zinc-400 hover:text-zinc-400 text-xs">Editar</button>
                            <button onClick={() => handleDeleteItem(item.id, item.name)} className="text-red-400 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
          <button onClick={() => setShowCategoryForm(true)} className="w-full rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3 text-sm text-zinc-500 hover:bg-zinc-100">
            + Adicionar categoria
          </button>
        </div>
      )}

      {/* Movements Tab */}
      {tab === "movements" && (
        <div className="space-y-2">
          {movements.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-8">Nenhuma movimentação registrada</p>
          ) : (
            movements.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg border border-white/[.04] bg-white p-3">
                <div className="flex items-center gap-3">
                  {m.type === "entry" ? (
                    <ArrowUpCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <ArrowDownCircle className="h-5 w-5 text-red-500" />
                  )}
                  <div>
                    <p className="font-medium text-zinc-900">{m.item.name}</p>
                    <p className="text-xs text-zinc-500">
                      {m.type === "entry" ? "Entrada" : "Saída"} • {m.quantity} {m.item.unit}
                      {m.unitCost ? ` • ${formatCurrency(m.unitCost)}` : ""}
                    </p>
                    {m.notes && <p className="text-xs text-zinc-400 italic">{m.notes}</p>}
                  </div>
                </div>
                <p className="text-xs text-zinc-400">{new Date(m.createdAt).toLocaleString("pt-BR")}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Category Modal */}
      {showCategoryForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Nova Categoria</h3>
                <button onClick={() => setShowCategoryForm(false)}><X className="h-5 w-5" /></button>
              </div>
              <input
                type="text"
                placeholder="Ex: Insumos, Embalagens..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                autoFocus
                className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
              />
              <div className="flex gap-2 mt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowCategoryForm(false)}>Cancelar</Button>
                <Button className="flex-1" onClick={addCategory}>Criar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Item Modal */}
      {showItemForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">{editingItem ? "Editar Item" : "Novo Item"}</h3>
                <button onClick={() => { setShowItemForm(false); setEditingItem(null) }}><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Nome</label>
                  <input
                    type="text"
                    placeholder="Ex: Farinha de trigo"
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">Unidade</label>
                    <select value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm">
                      {units.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">Categoria</label>
                    <select value={itemForm.categoryId} onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })} className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm">
                      <option value="">Selecionar...</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-zinc-700">Quantidade</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={itemForm.quantity}
                      onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })}
                      className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-zinc-700">Estoque mínimo</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={itemForm.minQuantity}
                      onChange={(e) => setItemForm({ ...itemForm, minQuantity: e.target.value })}
                      className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-zinc-700">Custo unitário (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={itemForm.unitCost}
                      onChange={(e) => setItemForm({ ...itemForm, unitCost: e.target.value })}
                      className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-zinc-700">Fornecedor</label>
                    <input
                      type="text"
                      placeholder="Opcional"
                      value={itemForm.supplier}
                      onChange={(e) => setItemForm({ ...itemForm, supplier: e.target.value })}
                      className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                    />
                  </div>
                </div>
                {editingItem && (
                  <div className="border-t border-zinc-200 pt-3 space-y-2">
                    <p className="text-xs font-semibold text-zinc-500 uppercase">Vincular ao Cardápio</p>
                    {editingItem.productLinks && editingItem.productLinks.length > 0 && (
                      <div className="space-y-1">
                        {editingItem.productLinks.map((link: any) => (
                          <div key={link.id} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-1.5">
                            <span className="text-xs text-zinc-700">{link.product.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-zinc-400">x{link.quantity} {editingItem.unit}</span>
                              <button onClick={() => unlinkProduct(link.productId)} className="text-zinc-400 hover:text-red-500"><X className="h-3 w-3" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <select value={linkProductId} onChange={(e) => setLinkProductId(e.target.value)} className="flex-1 h-8 rounded-lg border border-zinc-200 bg-zinc-50 px-2 text-xs text-zinc-700 focus:border-green-600 focus:outline-none">
                        <option value="">Selecionar produto...</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <input type="number" min="0.01" step="0.01" value={linkQuantity} onChange={(e) => setLinkQuantity(e.target.value)} className="w-16 h-8 rounded-lg border border-zinc-200 bg-zinc-50 px-2 text-xs text-zinc-700 text-center focus:border-green-600 focus:outline-none" />
                      <Button size="sm" onClick={linkProduct} disabled={!linkProductId || !linkQuantity} className="h-8 bg-green-600 hover:bg-green-700"><Plus className="h-3 w-3" /></Button>
                    </div>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setShowItemForm(false); setEditingItem(null) }}>Cancelar</Button>
                  <Button className="flex-1" onClick={saveItem}>{editingItem ? "Salvar" : "Adicionar"}</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Movement Modal */}
      {showMovementForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Movimentar Estoque</h3>
                <button onClick={() => setShowMovementForm(false)}><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Item</label>
                  <select value={movementForm.itemId} onChange={(e) => setMovementForm({ ...movementForm, itemId: e.target.value })} className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm">
                    <option value="">Selecionar item...</option>
                    {items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.quantity} {i.unit})</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setMovementForm({ ...movementForm, movementType: "entry" })} className={`flex-1 flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors ${movementForm.movementType === "entry" ? "border-green-600 bg-green-600/10 text-green-600" : "border-zinc-200 text-zinc-400"}`}>
                    <ArrowUpCircle className="h-4 w-4" /> Entrada
                  </button>
                  <button type="button" onClick={() => setMovementForm({ ...movementForm, movementType: "exit" })} className={`flex-1 flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors ${movementForm.movementType === "exit" ? "border-red-500 bg-red-500/10 text-red-400" : "border-zinc-200 text-zinc-400"}`}>
                    <ArrowDownCircle className="h-4 w-4" /> Saída
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-zinc-700">Quantidade</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={movementForm.quantity}
                      onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })}
                      className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-zinc-700">Custo unitário (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={movementForm.unitCost}
                      onChange={(e) => setMovementForm({ ...movementForm, unitCost: e.target.value })}
                      className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Observação</label>
                  <input
                    type="text"
                    placeholder="Ex: Compra no atacado"
                    value={movementForm.notes}
                    onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })}
                    className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
                {movementError && <p className="text-sm text-red-500">{movementError}</p>}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowMovementForm(false)}>Cancelar</Button>
                  <Button className="flex-1" onClick={saveMovement}>Registrar</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirm.open}
        title="Remover insumo"
        message={`Tem certeza que deseja remover o insumo "${deleteConfirm.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Remover"
        variant="danger"
        onConfirm={confirmDeleteItem}
        onCancel={() => setDeleteConfirm({ open: false, id: "", name: "" })}
      />
    </div>
  )
}
