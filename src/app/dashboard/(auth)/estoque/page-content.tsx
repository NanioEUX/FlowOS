"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Package, Plus, Trash2, AlertTriangle, ArrowUpCircle, ArrowDownCircle, X, Tag, Truck, Edit3, DollarSign, Search, ShoppingCart } from "lucide-react"
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
  const [tab, setTab] = useState<"items" | "movements" | "suppliers" | "compras">("items")
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: "", name: "" })
  const [movementError, setMovementError] = useState("")

  const [suppliers, setSuppliers] = useState<any[]>([])
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<any>(null)
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", cnpj: "", email: "", notes: "" })
  const [deleteSupplierConfirm, setDeleteSupplierConfirm] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: "", name: "" })

  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [newCatName, setNewCatName] = useState("")
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  const [showItemForm, setShowItemForm] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [itemForm, setItemForm] = useState({ name: "", unit: "un", quantity: "0", minQuantity: "0", unitCost: "0", supplier: "", supplierId: "", categoryId: "" })
  const [products, setProducts] = useState<any[]>([])
  const [linkProductId, setLinkProductId] = useState("")
  const [linkQuantity, setLinkQuantity] = useState("1")
  const [linkSearch, setLinkSearch] = useState("")
  const [linkDropdownOpen, setLinkDropdownOpen] = useState(false)

  const [showMovementForm, setShowMovementForm] = useState(false)
  const [movementForm, setMovementForm] = useState({ itemId: "", quantity: "1", reason: "vencimento", notes: "" })

  // Purchase entry state
  const [purchaseSupplierName, setPurchaseSupplierName] = useState("")
  const [purchaseDocument, setPurchaseDocument] = useState("")
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10))
  const [purchasePaymentMethod, setPurchasePaymentMethod] = useState("dinheiro")
  const [purchasePaymentCondition, setPurchasePaymentCondition] = useState("avista")
  const [purchaseExpenseType, setPurchaseExpenseType] = useState("lancamento")
  const [purchaseDueDate, setPurchaseDueDate] = useState("")
  const [purchaseRecurrence, setPurchaseRecurrence] = useState("mensal")
  const [purchaseNotes, setPurchaseNotes] = useState("")
  const [purchaseItems, setPurchaseItems] = useState<{ stockItemId: string; name: string; quantity: string; unit: string; unitCost: string; totalCost: number }[]>([])
  const [purchaseItemSearch, setPurchaseItemSearch] = useState("")
  const [showPurchaseItemPicker, setShowPurchaseItemPicker] = useState(false)
  const [savingPurchase, setSavingPurchase] = useState(false)
  const [recentPurchases, setRecentPurchases] = useState<any[]>([])

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
    const resPurchases = await fetchAuth(`/api/purchases?establishmentId=${establishmentId}`)
    if (resPurchases.ok) {
      setRecentPurchases(await resPurchases.json())
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

    const item = items.find((i) => i.id === movementForm.itemId)
    const qty = parseFloat(movementForm.quantity) || 0
    if (item && qty > item.quantity) {
      setMovementError(`Estoque insuficiente. Disponível: ${item.quantity} ${item.unit}`)
      return
    }

    const reasonLabels: Record<string, string> = {
      vencimento: "Produto vencido",
      quebrado: "Produto quebrado",
      perda: "Perda",
      desperdicio: "Desperdício",
      uso_interno: "Uso interno",
    }
    const notes = [reasonLabels[movementForm.reason] || movementForm.reason, movementForm.notes].filter(Boolean).join(" - ")

    const res = await fetchAuth("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "movement",
        itemId: movementForm.itemId,
        movementType: "exit",
        quantity: qty,
        unitCost: 0,
        notes,
      }),
    })
    if (res.ok) {
      toast("Saída registrada com sucesso", "success")
      window.dispatchEvent(new Event("stock-updated"))
    } else {
      const data = await res.json()
      toast(data.error || "Erro ao registrar saída", "error")
    }
    setMovementForm({ itemId: "", quantity: "1", reason: "vencimento", notes: "" })
    setShowMovementForm(false)
    loadAll()
  }

  async function updateStockItemPrices(item: any) {
    if (item.productLinks.length === 0) return

    const res = await fetchAuth("/api/products/update-prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stockItemId: item.id, rounding: "none" }),
    })

    if (res.ok) {
      const data = await res.json()
      if (data.updated > 0) {
        toast(`${data.updated} preço(s) atualizado(s)`, "success")
        window.dispatchEvent(new Event("stock-updated"))
      } else {
        toast("Todos os preços já estão atualizados", "info")
      }
    } else {
      toast("Erro ao atualizar preços", "error")
    }
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
            <ArrowDownCircle className="h-4 w-4" /> Registrar Saída
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
      <div className="flex gap-2 p-1 bg-zinc-100/80 rounded-xl">
        <button onClick={() => setTab("items")} className={`flex items-center gap-2 flex-1 justify-center px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${tab === "items" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
          <Package className="h-4 w-4" /> Itens
        </button>
        <button onClick={() => setTab("movements")} className={`flex items-center gap-2 flex-1 justify-center px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${tab === "movements" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
          <ArrowDownCircle className="h-4 w-4" /> Movimentações
        </button>
        <button onClick={() => setTab("suppliers")} className={`flex items-center gap-2 flex-1 justify-center px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${tab === "suppliers" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
          <Truck className="h-4 w-4" /> Fornecedores
        </button>
        <button onClick={() => setTab("compras")} className={`flex items-center gap-2 flex-1 justify-center px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${tab === "compras" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
          <ShoppingCart className="h-4 w-4" /> Compras
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

          {/* Category chips filter */}
          {categories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setSelectedCategoryId(null)}
                className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedCategoryId === null
                    ? "bg-green-600 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setShowCategoryForm(true)}
                className="flex-shrink-0 rounded-full border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:border-green-500 hover:text-green-600 transition-colors"
              >
                + Nova
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(selectedCategoryId === cat.id ? null : cat.id)}
                  className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedCategoryId === cat.id
                      ? "bg-green-600 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {(selectedCategoryId ? categories.filter((c) => c.id === selectedCategoryId) : categories).map((cat) => {
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
                              {item.previousUnitCost != null && Math.abs(item.unitCost - item.previousUnitCost) > 0.01 && (
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${
                                  item.unitCost > item.previousUnitCost
                                    ? "bg-amber-50 text-amber-700 ring-amber-600/10"
                                    : "bg-blue-50 text-blue-700 ring-blue-600/10"
                                }`}>
                                  {item.unitCost > item.previousUnitCost ? "Custo subiu" : "Custo caiu"}
                                </span>
                              )}
                              {item.previousUnitCost != null && Math.abs(item.unitCost - item.previousUnitCost) > 0.01 && item.productLinks.length > 0 && (
                                <button onClick={() => updateStockItemPrices(item)} className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-bold text-green-700 ring-1 ring-inset ring-green-600/10 hover:bg-green-100 transition-colors">
                                  Atualizar cardápio
                                </button>
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

      {/* Compras Tab */}
      {tab === "compras" && (
        <div className="space-y-4">
          {/* Header */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="text-sm font-semibold text-zinc-900">Nova Entrada de Compra</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Fornecedor</label>
                  <input type="text" value={purchaseSupplierName} onChange={(e) => setPurchaseSupplierName(e.target.value)} placeholder="Nome do fornecedor" className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-green-600 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Data da Compra</label>
                  <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-green-600 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Nº Documento / Cupom</label>
                  <input type="text" value={purchaseDocument} onChange={(e) => setPurchaseDocument(e.target.value)} placeholder="Número do documento" className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-green-600 focus:outline-none" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items Grid */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-900">Insumos</h3>
                <Button size="sm" onClick={() => setShowPurchaseItemPicker(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>

              {purchaseItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
                  <p className="text-sm text-zinc-500">Nenhum insumo adicionado</p>
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
                      {purchaseItems.map((item, idx) => (
                        <tr key={idx} className="border-b border-zinc-100">
                          <td className="py-2 font-medium text-zinc-900">{item.name}</td>
                          <td className="py-2">
                            <input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(e) => {
                              const updated = [...purchaseItems]
                              updated[idx] = { ...updated[idx], quantity: e.target.value, totalCost: Number(e.target.value) * Number(updated[idx].unitCost) }
                              setPurchaseItems(updated)
                            }} className="w-full rounded border border-zinc-200 px-2 py-1 text-sm" />
                          </td>
                          <td className="py-2 text-zinc-500">{item.unit}</td>
                          <td className="py-2">
                            <input type="number" min="0" step="0.01" value={item.unitCost} onChange={(e) => {
                              const updated = [...purchaseItems]
                              updated[idx] = { ...updated[idx], unitCost: e.target.value, totalCost: Number(updated[idx].quantity) * Number(e.target.value) }
                              setPurchaseItems(updated)
                            }} className="w-full rounded border border-zinc-200 px-2 py-1 text-sm" />
                          </td>
                          <td className="py-2 font-semibold text-zinc-900">{formatCurrency(item.totalCost)}</td>
                          <td className="py-2">
                            <button onClick={() => setPurchaseItems(purchaseItems.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-zinc-300">
                        <td colSpan={4} className="py-2 text-right font-semibold text-zinc-900">Total:</td>
                        <td className="py-2 text-lg font-bold text-green-600">{formatCurrency(purchaseItems.reduce((s, i) => s + i.totalCost, 0))}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Item Picker Modal */}
              {showPurchaseItemPicker && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="mx-4 w-full max-w-md rounded-xl bg-white shadow-2xl">
                    <div className="border-b border-zinc-200 px-4 py-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <input type="text" autoFocus value={purchaseItemSearch} onChange={(e) => setPurchaseItemSearch(e.target.value)} placeholder="Buscar insumo..." className="w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-3 py-2 text-sm focus:border-green-600 focus:outline-none" />
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {items.filter((i) => i.name.toLowerCase().includes(purchaseItemSearch.toLowerCase())).length === 0 ? (
                        <p className="p-4 text-sm text-zinc-400 text-center">Nenhum insumo encontrado</p>
                      ) : (
                        items.filter((i) => i.name.toLowerCase().includes(purchaseItemSearch.toLowerCase())).map((item) => (
                          <button key={item.id} onClick={() => {
                            const existing = purchaseItems.find((i) => i.stockItemId === item.id)
                            if (existing) {
                              setPurchaseItems(purchaseItems.map((i) => i.stockItemId === item.id ? { ...i, quantity: String(Number(i.quantity) + 1), totalCost: (Number(i.quantity) + 1) * Number(i.unitCost) } : i))
                            } else {
                              setPurchaseItems([...purchaseItems, { stockItemId: item.id, name: item.name, quantity: "1", unit: item.unit, unitCost: String(item.unitCost || 0), totalCost: item.unitCost || 0 }])
                            }
                            setPurchaseItemSearch(""); setShowPurchaseItemPicker(false)
                          }} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-50 border-b border-zinc-100">
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
                      <button onClick={() => setShowPurchaseItemPicker(false)} className="w-full text-sm text-zinc-500 hover:text-zinc-700 py-1">Fechar</button>
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

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-2">Tipo</label>
                <div className="flex gap-2">
                  {[{ value: "lancamento", label: "Lançamento" }, { value: "agendada", label: "Agendada" }, { value: "recorrente", label: "Recorrente" }].map((t) => (
                    <button key={t.value} onClick={() => setPurchaseExpenseType(t.value)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${purchaseExpenseType === t.value ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-2">Condição</label>
                <div className="flex gap-2">
                  <button onClick={() => setPurchasePaymentCondition("avista")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${purchasePaymentCondition === "avista" ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
                    À vista
                  </button>
                  <button onClick={() => setPurchasePaymentCondition("prazo")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${purchasePaymentCondition === "prazo" ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
                    Prazo
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Forma de Pagamento</label>
                  <select value={purchasePaymentMethod} onChange={(e) => setPurchasePaymentMethod(e.target.value)} className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-green-600 focus:outline-none">
                    <option value="dinheiro">Dinheiro</option>
                    <option value="cartao">Cartão</option>
                    <option value="pix">Pix</option>
                    <option value="transferencia">Transferência</option>
                    <option value="boleto">Boleto</option>
                  </select>
                </div>
                {purchaseExpenseType === "agendada" && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Data de Vencimento</label>
                    <input type="date" value={purchaseDueDate} onChange={(e) => setPurchaseDueDate(e.target.value)} className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-green-600 focus:outline-none" />
                  </div>
                )}
                {purchaseExpenseType === "recorrente" && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Repetir a cada</label>
                    <select value={purchaseRecurrence} onChange={(e) => setPurchaseRecurrence(e.target.value)} className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-green-600 focus:outline-none">
                      <option value="semanal">Semanal</option>
                      <option value="mensal">Mensal</option>
                      <option value="trimestral">Trimestral</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Observações</label>
                <textarea value={purchaseNotes} onChange={(e) => setPurchaseNotes(e.target.value)} rows={2} placeholder="Notas sobre a compra..." className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-green-600 focus:outline-none resize-none" />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-200">
                <div>
                  <p className="text-xs text-zinc-500">Total da compra</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(purchaseItems.reduce((s, i) => s + i.totalCost, 0))}</p>
                </div>
                <Button onClick={async () => {
                  if (purchaseItems.length === 0) return alert("Adicione pelo menos um insumo")
                  setSavingPurchase(true)
                  try {
                    const res = await fetchAuth("/api/purchases", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        supplierName: purchaseSupplierName || null,
                        documentNumber: purchaseDocument || null,
                        purchaseDate,
                        items: purchaseItems.map((i) => ({ stockItemId: i.stockItemId, stockItemName: i.name, quantity: Number(i.quantity), unit: i.unit, unitCost: Number(i.unitCost), totalCost: i.totalCost })),
                        paymentMethod: purchasePaymentMethod,
                        paymentCondition: purchasePaymentCondition,
                        expenseType: purchaseExpenseType,
                        dueDate: purchaseExpenseType === "agendada" && purchaseDueDate ? purchaseDueDate : null,
                        recurrenceFreq: purchaseExpenseType === "recorrente" ? purchaseRecurrence : null,
                        notes: purchaseNotes || null,
                      }),
                    })
                    if (!res.ok) { const err = await res.json(); alert(err.error || "Erro ao salvar"); return }
                    alert("Compra salva com sucesso!")
                    setPurchaseItems([]); setPurchaseSupplierName(""); setPurchaseDocument(""); setPurchaseNotes("")
                    loadAll()
                  } catch { alert("Erro ao salvar compra") } finally { setSavingPurchase(false) }
                }} disabled={savingPurchase || purchaseItems.length === 0}>
                  {savingPurchase ? "Salvando..." : "Salvar e atualizar estoque"}
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
                        <p className="text-sm font-medium text-zinc-900">{p.supplierName || "Compra"} {p.documentNumber ? `#${p.documentNumber}` : ""}</p>
                        <p className="text-xs text-zinc-500">{new Date(p.purchaseDate).toLocaleDateString("pt-BR")} | {p.items?.length || 0} itens</p>
                      </div>
                      <span className="text-sm font-semibold text-zinc-900">{formatCurrency(p.totalAmount)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
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
                <h3 className="font-semibold">Registrar Saída de Estoque</h3>
                <button onClick={() => setShowMovementForm(false)}><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Item</label>
                  <SearchableSelect value={movementForm.itemId} onChange={(v) => setMovementForm({ ...movementForm, itemId: v })} options={items.map((i) => ({ value: i.id, label: `${i.name} (${i.quantity} ${i.unit})` }))} placeholder="Selecionar item..." />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Motivo da saída</label>
                  <select
                    value={movementForm.reason}
                    onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })}
                    className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none"
                  >
                    <option value="vencimento">Vencido</option>
                    <option value="quebrado">Quebrado</option>
                    <option value="perda">Perda</option>
                    <option value="desperdicio">Desperdício</option>
                    <option value="uso_interno">Uso interno</option>
                  </select>
                </div>
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
                  <label className="block text-sm font-medium text-zinc-700">Observação</label>
                  <input
                    type="text"
                    placeholder="Ex: Produto danificado durante transporte"
                    value={movementForm.notes}
                    onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })}
                    className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
                {movementError && <p className="text-sm text-red-500">{movementError}</p>}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowMovementForm(false)}>Cancelar</Button>
                  <Button className="flex-1" onClick={saveMovement}>Registrar Saída</Button>
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
