"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Package, Plus, Trash2, AlertTriangle, ArrowUpCircle, ArrowDownCircle, X, Tag, Truck, Edit3, DollarSign } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

import { formatCurrency } from "@/lib/utils"
import { fetchAuth } from "@/lib/fetch-auth"
import { useToast } from "@/components/toast"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { SearchableSelect } from "@/components/searchable-select"

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
  const [tab, setTab] = useState<"items" | "movements" | "suppliers">("items")
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: "", name: "" })
  const [movementError, setMovementError] = useState("")

  const [suppliers, setSuppliers] = useState<any[]>([])
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<any>(null)
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", cnpj: "", email: "", notes: "" })
  const [deleteSupplierConfirm, setDeleteSupplierConfirm] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: "", name: "" })

  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [newCatName, setNewCatName] = useState("")

  const [showItemForm, setShowItemForm] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [itemForm, setItemForm] = useState({ name: "", unit: "un", quantity: "0", minQuantity: "0", unitCost: "0", supplier: "", supplierId: "", categoryId: "" })
  const [products, setProducts] = useState<any[]>([])
  const [linkProductId, setLinkProductId] = useState("")
  const [linkQuantity, setLinkQuantity] = useState("1")
  const [linkSearch, setLinkSearch] = useState("")
  const [linkDropdownOpen, setLinkDropdownOpen] = useState(false)

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
    const resSuppliers = await fetchAuth(`/api/suppliers?establishmentId=${establishmentId}`)
    if (resSuppliers.ok) {
      setSuppliers(await resSuppliers.json())
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
    setItemForm({ name: "", unit: "un", quantity: "0", minQuantity: "0", unitCost: "0", supplier: "", supplierId: "", categoryId: "" })
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
      supplierId: item.supplierId || "",
      categoryId: item.categoryId,
    })
    setLinkProductId("")
    setLinkQuantity("1")
    setLinkSearch("")
    setLinkDropdownOpen(false)
    setShowItemForm(true)
    if (establishmentId) {
      fetchAuth(`/api/products?establishmentId=${establishmentId}&limit=15`).then((r) => r.json()).then((data) => setProducts(Array.isArray(data) ? data : [])).catch(() => setProducts([]))
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

  async function saveSupplier() {
    if (!establishmentId || !supplierForm.name.trim()) return
    const body = { ...supplierForm, establishmentId }
    if (editingSupplier) {
      await fetchAuth(`/api/suppliers`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, id: editingSupplier.id }) })
    } else {
      await fetchAuth("/api/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    }
    setSupplierForm({ name: "", phone: "", cnpj: "", email: "", notes: "" })
    setEditingSupplier(null)
    setShowSupplierForm(false)
    loadAll()
  }

  async function confirmDeleteSupplier() {
    await fetchAuth(`/api/suppliers?id=${deleteSupplierConfirm.id}`, { method: "DELETE" })
    setDeleteSupplierConfirm({ open: false, id: "", name: "" })
    window.dispatchEvent(new Event("stock-updated"))
    loadAll()
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Estoque</h2>
          <p className="text-sm text-zinc-500">Controle de insumos, mercadorias e custos operacionais</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowMovementForm(true)} className="gap-2">
            <ArrowUpCircle className="h-4 w-4" /> Movimentar
          </Button>
          <Button size="sm" onClick={() => { setEditingItem(null); setItemForm({ name: "", unit: "un", quantity: "0", minQuantity: "0", unitCost: "0", supplier: "", supplierId: "", categoryId: categories[0]?.id || "" }); setShowItemForm(true) }} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Item
          </Button>
        </div>
      </div>

      {/* Alertas */}
      {lowStockItems.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-900">Atenção: Estoque Baixo ({lowStockItems.length})</h4>
              <div className="text-xs text-amber-800 space-y-0.5 font-medium">
                {lowStockItems.map((item) => (
                  <p key={item.id}>
                    • {item.name} — <strong className="font-bold">{item.quantity} {item.unit}</strong> (mín: {item.minQuantity})
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-zinc-100 p-2">
                <Package className="h-5 w-5 text-zinc-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-900">{items.length}</p>
                <p className="text-xs text-zinc-500">Itens cadastrados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-600/10 p-2">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalStockValue)}</p>
                <p className="text-xs text-zinc-500">Valor total em estoque</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-500">{lowStockItems.length}</p>
                <p className="text-xs text-zinc-500">Abaixo do mínimo</p>
              </div>
            </div>
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
        <button onClick={() => setTab("suppliers")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "suppliers" ? "border-green-600 text-green-600" : "border-transparent text-zinc-500 hover:text-zinc-500"}`}>
          Fornecedores
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
              <div key={cat.id} className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
                {/* Cabeçalho da categoria */}
                <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-zinc-700">
                    <Tag className="h-4 w-4 text-zinc-400" />
                    <h3 className="text-sm font-bold tracking-tight text-zinc-800">{cat.name}</h3>
                  </div>
                  <span className="text-xs font-semibold text-zinc-400 bg-white border border-zinc-200 px-2 py-0.5 rounded-md">
                    {catItems.length} {catItems.length === 1 ? "item" : "itens"}
                  </span>
                </div>

                {/* Lista de itens */}
                {catItems.length === 0 ? (
                  <p className="text-sm text-zinc-400 p-4">Nenhum item nesta categoria</p>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {catItems.map((item) => {
                      const totalValue = item.quantity * item.unitCost
                      const isZero = item.quantity === 0
                      const isLow = item.minQuantity > 0 && item.quantity <= item.minQuantity && !isZero
                      return (
                        <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-zinc-50/40 transition-colors">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-zinc-900">{item.name}</h4>
                              {isZero && (
                                <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-700 ring-1 ring-inset ring-red-600/10">
                                  Zerado
                                </span>
                              )}
                              {isLow && (
                                <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-bold text-orange-700 ring-1 ring-inset ring-orange-600/10">
                                  Estoque Baixo
                                </span>
                              )}
                              {item.products && item.products.length > 0 && (
                                <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-bold text-green-700 ring-1 ring-inset ring-green-600/10">
                                  Vendável
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500">
                              <span className="font-bold text-zinc-700">{item.quantity} {item.unit}</span> × {formatCurrency(item.unitCost)}/{item.unit}
                              <span className="mx-1 text-zinc-300">|</span>
                              Total: <strong className={`font-semibold ${totalValue > 0 ? "text-green-600" : "text-zinc-400"}`}>{formatCurrency(totalValue)}</strong>
                            </p>
                            {item.supplierRef && (
                              <p className="text-xs text-zinc-400">Fornecedor: {item.supplierRef.name}</p>
                            )}
                            {item.productLinks.length > 0 && (
                              <p className="text-xs text-blue-500 mt-0.5">
                                Vinculado a: {item.productLinks.map((l: any) => l.product.name).join(", ")}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => editItem(item)} className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all shadow-sm">
                              <Edit3 className="h-3.5 w-3.5" /> Editar
                            </button>
                            <button onClick={() => handleDeleteItem(item.id, item.name)} className="rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-400 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-all shadow-sm" title="Excluir item">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
          <button onClick={() => setShowCategoryForm(true)} className="w-full rounded-lg border border-dashed border-zinc-300 p-4 text-center text-xs font-bold text-zinc-500 hover:border-zinc-400 hover:bg-zinc-50/50 hover:text-zinc-700 transition-all">
            + Adicionar nova categoria
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

      {/* Suppliers Tab */}
      {tab === "suppliers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">{suppliers.length} fornecedor(es) cadastrado(s)</p>
            <Button size="sm" onClick={() => { setEditingSupplier(null); setSupplierForm({ name: "", phone: "", cnpj: "", email: "", notes: "" }); setShowSupplierForm(true) }} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Fornecedor
            </Button>
          </div>
          {suppliers.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-8">Nenhum fornecedor cadastrado</p>
          ) : (
            <div className="space-y-2">
              {suppliers.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-white/[.04] bg-white p-3">
                  <div className="flex items-center gap-3">
                    <Truck className="h-5 w-5 text-zinc-400" />
                    <div>
                      <p className="font-medium text-zinc-900">{s.name}</p>
                      <p className="text-xs text-zinc-500">
                        {s.phone && `${s.phone}`}
                        {s.phone && s.cnpj && " • "}
                        {s.cnpj && `CNPJ: ${s.cnpj}`}
                        {!s.phone && !s.cnpj && s.email && s.email}
                      </p>
                      {s.stockItems && s.stockItems.length > 0 && (
                        <p className="text-xs text-blue-500 mt-0.5">
                          Fornece: {s.stockItems.map((i: any) => i.name).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => { setEditingSupplier(s); setSupplierForm({ name: s.name, phone: s.phone || "", cnpj: s.cnpj || "", email: s.email || "", notes: s.notes || "" }); setShowSupplierForm(true) }} className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all shadow-sm">
                      <Edit3 className="h-3.5 w-3.5" /> Editar
                    </button>
                    <button onClick={() => setDeleteSupplierConfirm({ open: true, id: s.id, name: s.name })} className="rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-400 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-all shadow-sm" title="Excluir fornecedor">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
                    <SearchableSelect value={itemForm.unit} onChange={(v) => setItemForm({ ...itemForm, unit: v })} options={units} placeholder="Selecionar..." />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">Categoria</label>
                    <SearchableSelect value={itemForm.categoryId} onChange={(v) => setItemForm({ ...itemForm, categoryId: v })} options={[{ value: "", label: "Selecionar..." }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} placeholder="Selecionar..." />
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
                    <SearchableSelect
                      value={itemForm.supplierId || ""}
                      onChange={(v) => {
                        const supp = suppliers.find((s) => s.id === v)
                        setItemForm({ ...itemForm, supplierId: v, supplier: supp?.name || "" })
                      }}
                      options={[{ value: "", label: "Nenhum" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
                      placeholder="Selecionar..."
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
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <SearchableSelect
                          value={linkProductId}
                          onChange={setLinkProductId}
                          options={products.map((p) => ({ value: p.id, label: p.name }))}
                          placeholder="Buscar produto..."
                        />
                      </div>
                      <input type="number" min="0.01" step="0.01" value={linkQuantity} onChange={(e) => setLinkQuantity(e.target.value)} className="w-16 h-10 rounded-lg border border-zinc-200 bg-zinc-50 px-2 text-xs text-zinc-700 text-center focus:border-green-600 focus:outline-none" />
                      <Button size="sm" onClick={linkProduct} disabled={!linkProductId || !linkQuantity} className="h-10 bg-green-600 hover:bg-green-700"><Plus className="h-3 w-3" /></Button>
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
                  <SearchableSelect value={movementForm.itemId} onChange={(v) => setMovementForm({ ...movementForm, itemId: v })} options={items.map((i) => ({ value: i.id, label: `${i.name} (${i.quantity} ${i.unit})` }))} placeholder="Selecionar item..." />
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

      {/* Supplier Modal */}
      {showSupplierForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">{editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}</h3>
                <button onClick={() => { setShowSupplierForm(false); setEditingSupplier(null) }}><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Nome *</label>
                  <input
                    type="text"
                    placeholder="Ex: Distribuidora ABC"
                    value={supplierForm.name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                    className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-zinc-700">Telefone</label>
                    <input
                      type="text"
                      placeholder="(11) 99999-0000"
                      value={supplierForm.phone}
                      onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                      className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-zinc-700">CNPJ</label>
                    <input
                      type="text"
                      placeholder="00.000.000/0000-00"
                      value={supplierForm.cnpj}
                      onChange={(e) => setSupplierForm({ ...supplierForm, cnpj: e.target.value })}
                      className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">E-mail</label>
                  <input
                    type="email"
                    placeholder="contato@fornecedor.com"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Observações</label>
                  <input
                    type="text"
                    placeholder="Ex: Entrega todo dia útil"
                    value={supplierForm.notes}
                    onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
                    className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setShowSupplierForm(false); setEditingSupplier(null) }}>Cancelar</Button>
                  <Button className="flex-1" onClick={saveSupplier}>{editingSupplier ? "Salvar" : "Adicionar"}</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={deleteSupplierConfirm.open}
        title="Remover fornecedor"
        message={`Tem certeza que deseja remover o fornecedor "${deleteSupplierConfirm.name}"? O vínculo com itens de estoque será removido.`}
        confirmLabel="Remover"
        variant="danger"
        onConfirm={confirmDeleteSupplier}
        onCancel={() => setDeleteSupplierConfirm({ open: false, id: "", name: "" })}
      />
    </div>
  )
}
