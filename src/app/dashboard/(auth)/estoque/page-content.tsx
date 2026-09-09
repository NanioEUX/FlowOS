"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Package, Plus, Trash2, AlertTriangle, ArrowUpCircle, ArrowDownCircle, X, Tag, Edit3, Search, ShoppingCart } from "lucide-react"
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
  { value: "fardo", label: "Fardo" },
  { value: "saco", label: "Saco" },
  { value: "dz", label: "Dúzia" },
]

const packageUnits = ["cx", "pct", "fardo", "saco"]

const useUnits = [
  { value: "un", label: "Unidade" },
  { value: "kg", label: "Quilograma" },
  { value: "g", label: "Grama" },
  { value: "L", label: "Litro" },
  { value: "ml", label: "Mililitro" },
]

const familyTypes = [
  { value: "alimentos", label: "Alimentos" },
  { value: "operacional", label: "Operacional" },
  { value: "embalagens", label: "Embalagens" },
]

export default function EstoquePage() {
  const searchParams = useSearchParams()
  const hookEstablishmentId = useEstablishmentId()
  const searchParamsEstablishmentId = searchParams.get("establishment")
  const establishmentId = searchParamsEstablishmentId || hookEstablishmentId
  const { toast } = useToast()
  const [families, setFamilies] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"items" | "movements" | "suppliers" | "compras" | "saida">("items")
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: "", name: "" })
  const [movementError, setMovementError] = useState("")

  const [suppliers, setSuppliers] = useState<any[]>([])
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<any>(null)
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", cnpj: "", email: "", notes: "" })
  const [deleteSupplierConfirm, setDeleteSupplierConfirm] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: "", name: "" })

  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [newCatName, setNewCatName] = useState("")
  const [newCatFamilyId, setNewCatFamilyId] = useState("")

  const [showFamilyForm, setShowFamilyForm] = useState(false)
  const [newFamilyName, setNewFamilyName] = useState("")
  const [selectedFamilyFilter, setSelectedFamilyFilter] = useState<string | null>(null)
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null)

  const [showItemForm, setShowItemForm] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [inlineForm, setInlineForm] = useState<"family" | "category" | "supplier" | null>(null)
  const [inlineFormName, setInlineFormName] = useState("")
  const [itemForm, setItemForm] = useState({
    name: "", unit: "un", quantity: "0", minQuantity: "0", unitCost: "0",
    supplier: "", supplierId: "", categoryId: "", familyId: "",
    packageQty: "", useUnit: "un",
  })
  const [products, setProducts] = useState<any[]>([])
  const [linkProductId, setLinkProductId] = useState("")
  const [linkQuantity, setLinkQuantity] = useState("1")

  const [showMovementForm, setShowMovementForm] = useState(false)
  const [movementForm, setMovementForm] = useState({ itemId: "", quantity: "1", reason: "vencimento", notes: "" })

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

  const isPackageUnit = packageUnits.includes(itemForm.unit)

  const filteredByFamily = selectedFamilyFilter
    ? categories.filter((c) => c.familyId === selectedFamilyFilter)
    : categories

  const filteredCategories = selectedCategoryFilter
    ? filteredByFamily.filter((c) => c.id === selectedCategoryFilter)
    : filteredByFamily

  async function loadAll() {
    if (!establishmentId) return
    const res = await fetchAuth(`/api/stock?establishmentId=${establishmentId}`)
    if (res.ok) {
      const data = await res.json()
      setFamilies(data.families || [])
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

  async function addFamily() {
    if (!newFamilyName.trim() || !establishmentId) return
    await fetchAuth("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "family", name: newFamilyName, establishmentId }),
    })
    setNewFamilyName("")
    setShowFamilyForm(false)
    loadAll()
  }

  async function addCategory() {
    if (!newCatName.trim() || !establishmentId) return
    await fetchAuth("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "category", name: newCatName, familyId: newCatFamilyId || null, establishmentId }),
    })
    setNewCatName("")
    setNewCatFamilyId("")
    setShowCategoryForm(false)
    loadAll()
  }

  async function saveItem() {
    if (!establishmentId || !itemForm.name || !itemForm.categoryId) return
    const isPackage = packageUnits.includes(itemForm.unit)
    const pkgQty = isPackage ? (parseFloat(itemForm.packageQty) || 1) : 1
    const body: any = {
      ...itemForm,
      type: "item",
      quantity: pkgQty,
      minQuantity: parseFloat(itemForm.minQuantity) || 0,
      unitCost: parseFloat(itemForm.unitCost) || 0,
      packageQty: isPackage ? pkgQty : null,
      useUnit: isPackage ? (itemForm.useUnit || "un") : null,
      establishmentId,
    }
    if (editingItem) {
      await fetchAuth(`/api/stock/${editingItem.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    } else {
      await fetchAuth("/api/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    }
    resetItemForm()
    loadAll()
    window.dispatchEvent(new Event("stock-updated"))
  }

  function resetItemForm() {
    setItemForm({ name: "", unit: "un", quantity: "0", minQuantity: "0", unitCost: "0", supplier: "", supplierId: "", categoryId: "", familyId: "", packageQty: "", useUnit: "un" })
    setEditingItem(null)
    setShowItemForm(false)
    setInlineForm(null)
    setInlineFormName("")
  }

  function editItem(item: any) {
    const cat = categories.find((c) => c.id === item.categoryId)
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
      familyId: cat?.familyId || "",
      packageQty: item.packageQty ? String(item.packageQty) : "",
      useUnit: item.useUnit || "un",
    })
    setLinkProductId("")
    setLinkQuantity("1")
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
    toast("Item removido com sucesso", "success")
    window.dispatchEvent(new Event("stock-updated"))
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
      body: JSON.stringify({ type: "movement", itemId: movementForm.itemId, movementType: "exit", quantity: qty, unitCost: 0, notes }),
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

  function getItemDisplayUnit(item: any): string {
    if (item.useUnit) return item.useUnit
    return item.unit
  }

  function getItemDisplayQty(item: any): number {
    if (item.packageQty && item.useUnit) return item.packageQty
    return item.quantity
  }

  const stockItems = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Estoque</h2>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowFamilyForm(true)} className="bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 text-white">
            <Plus className="mr-1 h-3 w-3" /> Família
          </Button>
          <Button size="sm" onClick={() => setShowCategoryForm(true)} className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white">
            <Tag className="mr-1 h-3 w-3" /> Categoria
          </Button>
          <Button size="sm" onClick={() => { resetItemForm(); setShowItemForm(true) }} className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white">
            <Plus className="mr-1 h-3 w-3" /> Item
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {families.map((f) => (
          <button
            key={f.id}
            onClick={() => {
              if (selectedFamilyFilter === f.id) {
                setSelectedFamilyFilter(null)
                setSelectedCategoryFilter(null)
              } else {
                setSelectedFamilyFilter(f.id)
                setSelectedCategoryFilter(null)
              }
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${selectedFamilyFilter === f.id ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
          >
            {f.name}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filteredByFamily.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCategoryFilter(selectedCategoryFilter === c.id ? null : c.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${selectedCategoryFilter === c.id ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {categories.length === 0 && items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-zinc-500">
            <Package className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
            <p className="font-medium">Nenhum item cadastrado</p>
            <p className="mt-1 text-xs">Comece criando uma categoria ou item</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredCategories.map((cat) => {
            const catItems = items.filter((i) => i.categoryId === cat.id)
            return (
              <div key={cat.id} className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 border-b border-zinc-100">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-zinc-400" />
                    <span className="font-semibold text-zinc-800">{cat.name}</span>
                    <span className="text-xs text-zinc-400">{catItems.length} itens</span>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-green-200 text-green-700 hover:bg-green-50" onClick={() => { resetItemForm(); setItemForm((prev) => ({ ...prev, categoryId: cat.id })); setShowItemForm(true) }}>
                    <Plus className="mr-1 h-3 w-3" /> Adicionar
                  </Button>
                </div>
                {catItems.length > 0 ? (
                  <div className="divide-y divide-zinc-100">
                    {catItems.map((item) => {
                      const displayUnit = getItemDisplayUnit(item)
                      const displayQty = getItemDisplayQty(item)
                      const totalValue = item.quantity * item.unitCost
                      return (
                        <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-zinc-800">{item.name}</span>
                              {item.productLinks && item.productLinks.length > 0 && (
                                <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full border border-green-200">Vendável</span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {displayQty} {displayUnit} × {formatCurrency(item.unitCost)}/{displayUnit}
                              <span className="text-zinc-400 mx-1">|</span>
                              <span className="font-medium text-green-700">Total: {formatCurrency(totalValue)}</span>
                            </p>
                            {item.productLinks && item.productLinks.length > 0 && (
                              <p className="text-[11px] text-blue-500 mt-0.5">
                                Vinculado a: {item.productLinks.map((pl: any) => pl.product?.name).join(", ")}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => editItem(item)} className="p-1.5 hover:bg-zinc-200 rounded-lg transition-colors">
                              <Edit3 className="h-4 w-4 text-zinc-500" />
                            </button>
                            <button onClick={() => handleDeleteItem(item.id, item.name)} className="p-1.5 hover:bg-red-100 rounded-lg transition-colors">
                              <Trash2 className="h-4 w-4 text-zinc-400 hover:text-red-500" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="px-4 py-4 text-center text-xs text-zinc-400">
                    Nenhum item nesta categoria
                  </div>
                )}
              </div>
            )
          })}

          {items.filter((i) => !categories.find((c) => c.id === i.categoryId)).length > 0 && !selectedCategoryFilter && (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-zinc-400" />
                  <span className="font-semibold text-zinc-800">Sem categoria</span>
                </div>
              </div>
              <div className="divide-y divide-zinc-100">
                {items.filter((i) => !categories.find((c) => c.id === i.categoryId)).map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors">
                    <div>
                      <span className="text-sm font-semibold text-zinc-800">{item.name}</span>
                      <p className="text-xs text-zinc-500">{item.quantity} {item.unit} × {formatCurrency(item.unitCost)}/{item.unit}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => editItem(item)} className="p-1.5 hover:bg-zinc-200 rounded-lg"><Edit3 className="h-4 w-4 text-zinc-500" /></button>
                      <button onClick={() => handleDeleteItem(item.id, item.name)} className="p-1.5 hover:bg-red-100 rounded-lg"><Trash2 className="h-4 w-4 text-zinc-400 hover:text-red-500" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setShowCategoryForm(true)}
            className="w-full rounded-xl border-2 border-dashed border-zinc-200 py-3 text-sm font-medium text-zinc-400 hover:border-green-300 hover:text-green-600 transition-colors"
          >
            + Adicionar nova categoria
          </button>
        </div>
      )}
    </div>
  )

  const movementTab = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Movimentações</h2>
      </div>
      <div className="space-y-2">
        {movements.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              {m.type === "entry" ? (
                <ArrowUpCircle className="h-5 w-5 text-green-500" />
              ) : (
                <ArrowDownCircle className="h-5 w-5 text-red-500" />
              )}
              <div>
                <p className="text-sm font-medium text-zinc-800">{m.item?.name}</p>
                <p className="text-xs text-zinc-500">{m.notes || (m.type === "entry" ? "Entrada" : "Saída")}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-sm font-semibold ${m.type === "entry" ? "text-green-600" : "text-red-600"}`}>
                {m.type === "entry" ? "+" : "-"}{m.quantity} {m.item?.unit}
              </p>
              <p className="text-[10px] text-zinc-400">{new Date(m.createdAt).toLocaleDateString("pt-BR")}</p>
            </div>
          </div>
        ))}
        {movements.length === 0 && (
          <Card><CardContent className="p-6 text-center text-zinc-500 text-sm">Nenhuma movimentação registrada</CardContent></Card>
        )}
      </div>
    </div>
  )

  const suppliersTab = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Fornecedores</h2>
        <Button size="sm" onClick={() => { setEditingSupplier(null); setSupplierForm({ name: "", phone: "", cnpj: "", email: "", notes: "" }); setShowSupplierForm(true) }} className="bg-green-600 hover:bg-green-700">
          <Plus className="mr-1 h-3 w-3" /> Fornecedor
        </Button>
      </div>
      <div className="space-y-2">
        {suppliers.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-medium text-zinc-800">{s.name}</p>
              <p className="text-xs text-zinc-500">{s.phone || "Sem telefone"}{s.cnpj ? ` · CNPJ: ${s.cnpj}` : ""}</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => { setEditingSupplier(s); setSupplierForm({ name: s.name, phone: s.phone || "", cnpj: s.cnpj || "", email: s.email || "", notes: s.notes || "" }); setShowSupplierForm(true) }} className="p-1 hover:bg-zinc-100 rounded"><Edit3 className="h-4 w-4 text-zinc-500" /></button>
              <button onClick={() => setDeleteSupplierConfirm({ open: true, id: s.id, name: s.name })} className="p-1 hover:bg-red-100 rounded"><Trash2 className="h-4 w-4 text-zinc-400 hover:text-red-500" /></button>
            </div>
          </div>
        ))}
        {suppliers.length === 0 && (
          <Card><CardContent className="p-6 text-center text-zinc-500 text-sm">Nenhum fornecedor cadastrado</CardContent></Card>
        )}
      </div>
    </div>
  )

  const saidaTab = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Registrar Saída</h2>
      </div>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Item</label>
            <SearchableSelect value={movementForm.itemId} onChange={(v) => setMovementForm({ ...movementForm, itemId: v })} options={items.map((i) => ({ value: i.id, label: `${i.name} (${i.quantity} ${i.unit})` }))} placeholder="Selecionar item..." />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-700">Motivo da saída</label>
            <select value={movementForm.reason} onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none">
              <option value="vencimento">Vencido</option>
              <option value="quebrado">Quebrado/Avaria</option>
              <option value="perda">Perda</option>
              <option value="desperdicio">Desperdício</option>
              <option value="uso_interno">Uso Interno</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-700">Quantidade</label>
            <input type="number" step="0.01" min="0.01" value={movementForm.quantity} onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none" />
          </div>
          {movementError && <p className="text-xs text-red-600">{movementError}</p>}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-700">Observações (opcional)</label>
            <input type="text" value={movementForm.notes} onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none" placeholder="Ex: Lote 12345..." />
          </div>
          <Button className="w-full bg-red-600 hover:bg-red-700" onClick={saveMovement}>Registrar Saída</Button>
        </CardContent>
      </Card>
    </div>
  )

  const comprasTab = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Compras</h2>
      </div>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">Fornecedor</label>
              <SearchableSelect value={purchaseSupplierName} onChange={setPurchaseSupplierName} options={[{ value: "", label: "Selecionar..." }, ...suppliers.map((s) => ({ value: s.name, label: s.name }))]} placeholder="Fornecedor..." />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">Data</label>
              <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-green-600 focus:outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">Documento (NF)</label>
              <input type="text" value={purchaseDocument} onChange={(e) => setPurchaseDocument(e.target.value)} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-green-600 focus:outline-none" placeholder="Nº da nota..." />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">Forma de Pagamento</label>
              <select value={purchasePaymentMethod} onChange={(e) => setPurchasePaymentMethod(e.target.value)} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-green-600 focus:outline-none">
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="cartao">Cartão</option>
                <option value="boleto">Boleto</option>
                <option value="credito_loja">Crédito Loja</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">Condição</label>
              <select value={purchasePaymentCondition} onChange={(e) => setPurchasePaymentCondition(e.target.value)} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-green-600 focus:outline-none">
                <option value="avista">À Vista</option>
                <option value="prazo">A Prazo</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">Tipo</label>
              <select value={purchaseExpenseType} onChange={(e) => setPurchaseExpenseType(e.target.value)} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-green-600 focus:outline-none">
                <option value="lancamento">Lançamento Único</option>
                <option value="recorrente">Recorrência</option>
              </select>
            </div>
          </div>
          {(purchasePaymentCondition === "prazo" || purchaseExpenseType === "recorrente") && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-600">Vencimento</label>
                <input type="date" value={purchaseDueDate} onChange={(e) => setPurchaseDueDate(e.target.value)} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-green-600 focus:outline-none" />
              </div>
              {purchaseExpenseType === "recorrente" && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-600">Recorrência</label>
                  <select value={purchaseRecurrence} onChange={(e) => setPurchaseRecurrence(e.target.value)} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-green-600 focus:outline-none">
                    <option value="semanal">Semanal</option>
                    <option value="quinzenal">Quinzenal</option>
                    <option value="mensal">Mensal</option>
                    <option value="bimestral">Bimestral</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="semestral">Semestral</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
              )}
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600">Observações</label>
            <input type="text" value={purchaseNotes} onChange={(e) => setPurchaseNotes(e.target.value)} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-green-600 focus:outline-none" placeholder="Observações..." />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-700">Itens da Compra</h3>
            <Button size="sm" variant="outline" onClick={() => setShowPurchaseItemPicker(!showPurchaseItemPicker)}>
              <ShoppingCart className="mr-1 h-3 w-3" /> Adicionar Item
            </Button>
          </div>
          {showPurchaseItemPicker && (
            <div className="space-y-2">
              {purchaseItemSearch && items
                .filter((i) => i.name.toLowerCase().includes(purchaseItemSearch.toLowerCase()))
                .slice(0, 5)
                .map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 hover:bg-zinc-100 cursor-pointer" onClick={() => {
                    setPurchaseItems([...purchaseItems, { stockItemId: item.id, name: item.name, quantity: "1", unit: item.unit, unitCost: String(item.unitCost), totalCost: item.unitCost }])
                    setPurchaseItemSearch("")
                    setShowPurchaseItemPicker(false)
                  }}>
                    <span className="text-sm">{item.name}</span>
                    <span className="text-xs text-zinc-500">{formatCurrency(item.unitCost)}/{item.unit}</span>
                  </div>
                ))}
              <input type="text" value={purchaseItemSearch} onChange={(e) => setPurchaseItemSearch(e.target.value)} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-green-600 focus:outline-none" placeholder="Buscar item..." />
            </div>
          )}
          {purchaseItems.map((pi, idx) => (
            <div key={idx} className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-800">{pi.name}</p>
              </div>
              <input type="number" min="0.01" step="0.01" value={pi.quantity} onChange={(e) => {
                const qty = parseFloat(e.target.value) || 0
                const cost = parseFloat(pi.unitCost) || 0
                const updated = [...purchaseItems]
                updated[idx] = { ...pi, quantity: e.target.value, totalCost: qty * cost }
                setPurchaseItems(updated)
              }} className="w-16 h-8 rounded border border-zinc-200 bg-white px-2 text-xs text-center focus:border-green-600 focus:outline-none" />
              <span className="text-xs text-zinc-500">{pi.unit}</span>
              <input type="number" min="0.01" step="0.01" value={pi.unitCost} onChange={(e) => {
                const cost = parseFloat(e.target.value) || 0
                const qty = parseFloat(pi.quantity) || 0
                const updated = [...purchaseItems]
                updated[idx] = { ...pi, unitCost: e.target.value, totalCost: qty * cost }
                setPurchaseItems(updated)
              }} className="w-20 h-8 rounded border border-zinc-200 bg-white px-2 text-xs text-center focus:border-green-600 focus:outline-none" />
              <span className="text-xs font-medium text-zinc-700 w-20 text-right">{formatCurrency(pi.totalCost)}</span>
              <button onClick={() => setPurchaseItems(purchaseItems.filter((_, i) => i !== idx))} className="p-1 hover:bg-red-100 rounded">
                <Trash2 className="h-3 w-3 text-zinc-400 hover:text-red-500" />
              </button>
            </div>
          ))}
          {purchaseItems.length > 0 && (
            <div className="flex items-center justify-between border-t border-zinc-200 pt-2">
              <span className="text-sm font-medium text-zinc-600">Total</span>
              <span className="text-sm font-bold text-green-700">{formatCurrency(purchaseItems.reduce((s, pi) => s + pi.totalCost, 0))}</span>
            </div>
          )}
          {purchaseItems.length > 0 && (
            <Button className="w-full bg-green-600 hover:bg-green-700" onClick={async () => {
              if (!establishmentId) return
              setSavingPurchase(true)
              const res = await fetchAuth("/api/purchases", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  establishmentId, supplierName: purchaseSupplierName, document: purchaseDocument,
                  date: purchaseDate, paymentMethod: purchasePaymentMethod, paymentCondition: purchasePaymentCondition,
                  expenseType: purchaseExpenseType, dueDate: purchasePaymentCondition === "prazo" || purchaseExpenseType === "recorrente" ? purchaseDueDate : null,
                  recurrence: purchaseExpenseType === "recorrente" ? purchaseRecurrence : null, notes: purchaseNotes,
                  items: purchaseItems.map((pi) => ({ stockItemId: pi.stockItemId, quantity: parseFloat(pi.quantity), unitCost: parseFloat(pi.unitCost) })),
                }),
              })
              if (res.ok) {
                toast("Compra registrada com sucesso!", "success")
                setPurchaseItems([]); setPurchaseSupplierName(""); setPurchaseDocument(""); setPurchaseNotes("")
                loadAll()
              } else {
                const data = await res.json()
                toast(data.error || "Erro ao registrar compra", "error")
              }
              setSavingPurchase(false)
            }} disabled={savingPurchase}>
              {savingPurchase ? "Salvando..." : "Registrar Compra"}
            </Button>
          )}
        </CardContent>
      </Card>
      {recentPurchases.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-700">Últimas Compras</h3>
          {recentPurchases.map((p) => (
            <div key={p.id} className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-800">{p.supplierName || "Sem fornecedor"}</p>
                  <p className="text-xs text-zinc-500">{new Date(p.date).toLocaleDateString("pt-BR")} {p.document ? `· NF ${p.document}` : ""}</p>
                </div>
                <span className="text-sm font-bold text-green-700">{formatCurrency(p.totalCost)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Estoque</h1>
          <p className="text-sm text-zinc-500">Controle de insumos, mercadorias e custos operacionais</p>
        </div>
        <Button onClick={() => { resetItemForm(); setShowItemForm(true) }} className="bg-green-600 hover:bg-green-700">
          <Plus className="mr-1 h-4 w-4" /> Novo Item
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <Package className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-green-600 uppercase">Itens cadastrados</p>
                <p className="text-2xl font-bold text-green-700">{items.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <span className="text-lg font-bold text-green-600">$</span>
              </div>
              <div>
                <p className="text-xs font-medium text-green-600 uppercase">Valor total em estoque</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(totalStockValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={lowStockItems.length > 0 ? "bg-gradient-to-br from-red-50 to-orange-50 border-red-200" : "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200"}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${lowStockItems.length > 0 ? "bg-red-100" : "bg-amber-100"}`}>
                <AlertTriangle className={`h-5 w-5 ${lowStockItems.length > 0 ? "text-red-600" : "text-amber-600"}`} />
              </div>
              <div>
                <p className={`text-xs font-medium uppercase ${lowStockItems.length > 0 ? "text-red-600" : "text-amber-600"}`}>Abaixo do mínimo</p>
                <p className={`text-2xl font-bold ${lowStockItems.length > 0 ? "text-red-700" : "text-amber-700"}`}>{lowStockItems.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-1 rounded-xl bg-zinc-100 p-1">
        {([
          { key: "items", label: "Itens", icon: Package },
          { key: "movements", label: "Movimentações", icon: ArrowDownCircle },
          { key: "suppliers", label: "Fornecedores", icon: Tag },
          { key: "compras", label: "Compras", icon: ShoppingCart },
          { key: "saida", label: "Registrar Saída", icon: AlertTriangle },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors ${tab === key ? "bg-white text-zinc-800 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "items" && stockItems}
      {tab === "movements" && movementTab}
      {tab === "suppliers" && suppliersTab}
      {tab === "compras" && comprasTab}
      {tab === "saida" && saidaTab}

      {/* Family Form Modal */}
      {showFamilyForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Nova Família</h3>
                <button onClick={() => setShowFamilyForm(false)}><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Nome</label>
                  <input type="text" placeholder="Ex: Alimentos, Limpeza..." value={newFamilyName} onChange={(e) => setNewFamilyName(e.target.value)} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none" />
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setShowFamilyForm(false)}>Cancelar</Button>
                  <Button className="flex-1 bg-violet-600 hover:bg-violet-700" onClick={addFamily}>Criar</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category Form Modal */}
      {showCategoryForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Nova Categoria</h3>
                <button onClick={() => setShowCategoryForm(false)}><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Nome</label>
                  <input type="text" placeholder="Ex: Carnes, Laticínios..." value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Família (opcional)</label>
                  <select value={newCatFamilyId} onChange={(e) => setNewCatFamilyId(e.target.value)} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none">
                    <option value="">Nenhuma</option>
                    {families.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
                  </select>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setShowCategoryForm(false)}>Cancelar</Button>
                  <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={addCategory}>Criar</Button>
                </div>
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
                <button onClick={resetItemForm}><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Nome do item</label>
                  <input type="text" placeholder="Ex: Farinha de trigo" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    {inlineForm === "family" ? (
                      <>
                        <div className="flex items-center gap-1.5 mb-1">
                          <label className="text-sm font-medium text-zinc-700">Família</label>
                          <button type="button" onClick={() => { setInlineForm(null); setInlineFormName("") }} className="text-xs text-green-600 hover:text-green-700 font-medium">Fechar</button>
                          <button type="button" onClick={async () => {
                            if (!inlineFormName.trim() || !establishmentId) return
                            const res = await fetchAuth("/api/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "family", name: inlineFormName, establishmentId }) })
                            if (res.ok) { const f = await res.json(); setItemForm({ ...itemForm, familyId: f.id }); setInlineForm(null); setInlineFormName(""); loadAll() }
                          }} className="text-xs text-green-600 hover:text-green-700 font-medium">Salvar</button>
                        </div>
                        <input type="text" value={inlineFormName} onChange={(e) => setInlineFormName(e.target.value)} placeholder="Nome da família" className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-green-600 focus:outline-none" autoFocus onKeyDown={async (e) => {
                          if (e.key === "Enter" && inlineFormName.trim() && establishmentId) {
                            const res = await fetchAuth("/api/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "family", name: inlineFormName, establishmentId }) })
                            if (res.ok) { const f = await res.json(); setItemForm({ ...itemForm, familyId: f.id }); setInlineForm(null); setInlineFormName(""); loadAll() }
                          }
                          if (e.key === "Escape") { setInlineForm(null); setInlineFormName("") }
                        }} />
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 mb-1">
                          <label className="text-sm font-medium text-zinc-700">Família</label>
                          <button type="button" onClick={() => { setInlineForm("family"); setInlineFormName("") }} className="text-xs text-green-600 hover:text-green-700 font-medium">+ Nova</button>
                        </div>
                        <select value={itemForm.familyId} onChange={(e) => setItemForm({ ...itemForm, familyId: e.target.value, categoryId: "" })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none">
                          <option value="">Nenhuma</option>
                          {families.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
                        </select>
                      </>
                    )}
                  </div>
                  <div>
                    {inlineForm === "category" ? (
                      <>
                        <div className="flex items-center gap-1.5 mb-1">
                          <label className="text-sm font-medium text-zinc-700">Categoria</label>
                          <button type="button" onClick={() => { setInlineForm(null); setInlineFormName("") }} className="text-xs text-green-600 hover:text-green-700 font-medium">Fechar</button>
                          <button type="button" onClick={async () => {
                            if (!inlineFormName.trim() || !establishmentId) return
                            const res = await fetchAuth("/api/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "category", name: inlineFormName, familyId: itemForm.familyId || null, establishmentId }) })
                            if (res.ok) { const c = await res.json(); setItemForm({ ...itemForm, categoryId: c.id }); setInlineForm(null); setInlineFormName(""); loadAll() }
                          }} className="text-xs text-green-600 hover:text-green-700 font-medium">Salvar</button>
                        </div>
                        <input type="text" value={inlineFormName} onChange={(e) => setInlineFormName(e.target.value)} placeholder="Nome da categoria" className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-green-600 focus:outline-none" autoFocus onKeyDown={async (e) => {
                          if (e.key === "Enter" && inlineFormName.trim() && establishmentId) {
                            const res = await fetchAuth("/api/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "category", name: inlineFormName, familyId: itemForm.familyId || null, establishmentId }) })
                            if (res.ok) { const c = await res.json(); setItemForm({ ...itemForm, categoryId: c.id }); setInlineForm(null); setInlineFormName(""); loadAll() }
                          }
                          if (e.key === "Escape") { setInlineForm(null); setInlineFormName("") }
                        }} />
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 mb-1">
                          <label className="text-sm font-medium text-zinc-700">Categoria</label>
                          <button type="button" onClick={() => { setInlineForm("category"); setInlineFormName("") }} className="text-xs text-green-600 hover:text-green-700 font-medium">+ Nova</button>
                        </div>
                        <SearchableSelect value={itemForm.categoryId} onChange={(v) => setItemForm({ ...itemForm, categoryId: v })} options={[{ value: "", label: "Selecionar..." }, ...(itemForm.familyId ? categories.filter((c) => c.familyId === itemForm.familyId) : categories).map((c) => ({ value: c.id, label: c.name }))]} placeholder="Selecionar..." />
                      </>
                    )}
                  </div>
                </div>

                <div className="border-t border-zinc-100 pt-3 space-y-3">
                  <p className="text-xs font-semibold text-zinc-500 uppercase">Unidade e Custo</p>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-zinc-700">Unidade de compra</label>
                    <SearchableSelect value={itemForm.unit} onChange={(v) => setItemForm({ ...itemForm, unit: v, packageQty: "" })} options={units} placeholder="Selecionar..." />
                  </div>

                  {isPackageUnit && (
                    <>
                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-zinc-700">Unidade de uso</label>
                        <SearchableSelect value={itemForm.useUnit || "un"} onChange={(v) => setItemForm({ ...itemForm, useUnit: v })} options={useUnits} placeholder="Selecionar..." />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-zinc-700">Contém</label>
                          <div className="flex gap-1">
                            <input type="number" min="1" step="1" value={itemForm.packageQty} onChange={(e) => setItemForm({ ...itemForm, packageQty: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none" placeholder="Ex: 10" />
                            <span className="flex h-10 w-14 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 text-xs text-zinc-500">{itemForm.useUnit || "un"}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-zinc-700">Custo (R$)</label>
                          <input type="number" step="0.01" min="0" value={itemForm.unitCost} onChange={(e) => setItemForm({ ...itemForm, unitCost: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none" />
                        </div>
                      </div>
                      {parseFloat(itemForm.packageQty) > 0 && parseFloat(itemForm.unitCost) > 0 && (
                        <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2">
                          <span className="text-xs text-green-700">
                            Custo da embalagem: <span className="font-bold">{formatCurrency(parseFloat(itemForm.unitCost) * parseFloat(itemForm.packageQty))}</span>
                            {" "}({itemForm.packageQty} × {formatCurrency(parseFloat(itemForm.unitCost))})
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {!isPackageUnit && (
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-zinc-700">Custo unitário (R$)</label>
                      <input type="number" step="0.01" min="0" value={itemForm.unitCost} onChange={(e) => setItemForm({ ...itemForm, unitCost: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none" />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-zinc-700">Estoque mínimo</label>
                    <input type="number" step="0.01" min="0" value={itemForm.minQuantity} onChange={(e) => setItemForm({ ...itemForm, minQuantity: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none" />
                  </div>

                  <div className="space-y-1">
                    {inlineForm === "supplier" ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          <label className="text-sm font-medium text-zinc-700">Fornecedor</label>
                          <button type="button" onClick={() => { setInlineForm(null); setInlineFormName("") }} className="text-xs text-green-600 hover:text-green-700 font-medium">Fechar</button>
                          <button type="button" onClick={async () => {
                            if (!inlineFormName.trim() || !establishmentId) return
                            const res = await fetchAuth("/api/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: inlineFormName, establishmentId }) })
                            if (res.ok) { const s = await res.json(); setItemForm({ ...itemForm, supplierId: s.id, supplier: s.name }); setInlineForm(null); setInlineFormName(""); loadAll() }
                          }} className="text-xs text-green-600 hover:text-green-700 font-medium">Salvar</button>
                        </div>
                        <input type="text" value={inlineFormName} onChange={(e) => setInlineFormName(e.target.value)} placeholder="Nome do fornecedor" className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-green-600 focus:outline-none" autoFocus onKeyDown={async (e) => {
                          if (e.key === "Enter" && inlineFormName.trim() && establishmentId) {
                            const res = await fetchAuth("/api/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: inlineFormName, establishmentId }) })
                            if (res.ok) { const s = await res.json(); setItemForm({ ...itemForm, supplierId: s.id, supplier: s.name }); setInlineForm(null); setInlineFormName(""); loadAll() }
                          }
                          if (e.key === "Escape") { setInlineForm(null); setInlineFormName("") }
                        }} />
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5">
                          <label className="text-sm font-medium text-zinc-700">Fornecedor</label>
                          <button type="button" onClick={() => { setInlineForm("supplier"); setInlineFormName("") }} className="text-xs text-green-600 hover:text-green-700 font-medium">+ Novo</button>
                        </div>
                        <SearchableSelect value={itemForm.supplierId || ""} onChange={(v) => { const supp = suppliers.find((s) => s.id === v); setItemForm({ ...itemForm, supplierId: v, supplier: supp?.name || "" }) }} options={[{ value: "", label: "Nenhum" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]} placeholder="Selecionar..." />
                      </>
                    )}
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
                        <SearchableSelect value={linkProductId} onChange={setLinkProductId} options={products.map((p) => ({ value: p.id, label: p.name }))} placeholder="Buscar produto..." />
                      </div>
                      <input type="number" min="0.01" step="0.01" value={linkQuantity} onChange={(e) => setLinkQuantity(e.target.value)} className="w-16 h-10 rounded-lg border border-zinc-200 bg-zinc-50 px-2 text-xs text-zinc-700 text-center focus:border-green-600 focus:outline-none" />
                      <Button size="sm" onClick={linkProduct} disabled={!linkProductId || !linkQuantity} className="h-10 bg-green-600 hover:bg-green-700"><Plus className="h-3 w-3" /></Button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={resetItemForm}>Cancelar</Button>
                  <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={saveItem}>{editingItem ? "Salvar" : "Adicionar"}</Button>
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
                  <select value={movementForm.reason} onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none">
                    <option value="vencimento">Vencido</option>
                    <option value="quebrado">Quebrado/Avaria</option>
                    <option value="perda">Perda</option>
                    <option value="desperdicio">Desperdício</option>
                    <option value="uso_interno">Uso Interno</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Quantidade</label>
                  <input type="number" step="0.01" min="0.01" value={movementForm.quantity} onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none" />
                </div>
                {movementError && <p className="text-xs text-red-600">{movementError}</p>}
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Observações (opcional)</label>
                  <input type="text" value={movementForm.notes} onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none" placeholder="Ex: Lote 12345..." />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowMovementForm(false)}>Cancelar</Button>
                  <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={saveMovement}>Registrar Saída</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Supplier Form Modal */}
      {showSupplierForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">{editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}</h3>
                <button onClick={() => setShowSupplierForm(false)}><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-600">Nome *</label>
                  <input type="text" value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-green-600 focus:outline-none" placeholder="Nome do fornecedor..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-600">Telefone</label>
                    <input type="tel" value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-green-600 focus:outline-none" placeholder="(11) 99999-9999" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-600">CNPJ</label>
                    <input type="text" value={supplierForm.cnpj} onChange={(e) => setSupplierForm({ ...supplierForm, cnpj: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-green-600 focus:outline-none" placeholder="00.000.000/0001-00" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-600">E-mail</label>
                  <input type="email" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-green-600 focus:outline-none" placeholder="contato@fornecedor.com" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-600">Observações</label>
                  <input type="text" value={supplierForm.notes} onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })} className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-green-600 focus:outline-none" placeholder="Notas gerais..." />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowSupplierForm(false)}>Cancelar</Button>
                  <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={async () => {
                    if (!supplierForm.name.trim()) return
                    const body = { ...supplierForm, establishmentId }
                    if (editingSupplier) {
                      await fetchAuth(`/api/suppliers/${editingSupplier.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
                    } else {
                      await fetchAuth("/api/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
                    }
                    setSupplierForm({ name: "", phone: "", cnpj: "", email: "", notes: "" })
                    setEditingSupplier(null)
                    setShowSupplierForm(false)
                    loadAll()
                  }}>{editingSupplier ? "Salvar" : "Criar"}</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirm.open}
        onCancel={() => setDeleteConfirm({ ...deleteConfirm, open: false })}
        title="Remover item"
        message={`Tem certeza que deseja remover "${deleteConfirm.name}"?`}
        onConfirm={confirmDeleteItem}
      />
      <ConfirmDialog
        open={deleteSupplierConfirm.open}
        onCancel={() => setDeleteSupplierConfirm({ open: false, id: "", name: "" })}
        title="Remover fornecedor"
        message={`Tem certeza que deseja remover "${deleteSupplierConfirm.name}"?`}
        onConfirm={async () => {
          await fetchAuth(`/api/suppliers/${deleteSupplierConfirm.id}`, { method: "DELETE" })
          toast("Fornecedor removido", "success")
          setDeleteSupplierConfirm({ open: false, id: "", name: "" })
          loadAll()
        }}
      />
    </div>
  )
}
