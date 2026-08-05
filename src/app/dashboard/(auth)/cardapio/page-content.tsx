"use client"

import { useEffect, useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Plus, Pencil, Trash2, UtensilsCrossed, X, GripVertical, Star, Sparkles, Tag, Image as ImageIcon, Upload, Eye, Save, Loader2, Palette, Clock, ExternalLink, Percent } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"


import { formatCurrency } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { fetchAuth } from "@/lib/fetch-auth"
import { useToast } from "@/components/toast"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { SearchableSelect } from "@/components/searchable-select"
import { convertQuantity } from "@/lib/units"

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  image: string | null
  isAvailable: boolean
  sendToPrep: boolean
  order: number
  badge: string | null
  categoryId: string
  stockItemId: string | null
}

interface Category {
  id: string
  name: string
  order: number
  products: Product[]
  targetMarginPercent?: number | null
  marginFormula?: string | null
}

const BADGE_OPTIONS = [
  { value: "", label: "Nenhum", icon: null },
  { value: "mais_vendido", label: "Mais Vendido", icon: Star, color: "text-amber-500 bg-amber-500/10" },
  { value: "novo", label: "Novo", icon: Sparkles, color: "text-blue-500 bg-green-600/10" },
  { value: "promocao", label: "Promoção", icon: Tag, color: "text-red-500 bg-red-500/10" },
]

function getBadgeDisplay(badge: string | null) {
  const found = BADGE_OPTIONS.find((b) => b.value === badge)
  if (!found || !found.icon) return null
  const Icon = found.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${found.color}`}>
      <Icon className="h-3 w-3" />
      {found.label}
    </span>
  )
}

type Tab = "produtos" | "aparencia" | "cores"

export default function CardapioPage() {
  const searchParams = useSearchParams()
  const hookEstablishmentId = useEstablishmentId()
  const searchParamsEstablishmentId = searchParams.get("establishment")
  const establishmentId = searchParamsEstablishmentId || hookEstablishmentId
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<Tab>("produtos")
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [establishmentSlug, setEstablishmentSlug] = useState<string>("")
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [showProductForm, setShowProductForm] = useState(false)
  const [productTab, setProductTab] = useState<"basico" | "onde" | "ficha">("basico")
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState("")
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    price: "",
    categoryId: "",
    image: "",
    badge: "",
    stockItemId: "",
    sendToPrep: false,
    availableOnline: true,
    availablePresencial: true,
    availableWhatsapp: true,
  })
  const [stockItems, setStockItems] = useState<any[]>([])
  const [productLinks, setProductLinks] = useState<{ stockItemId: string; quantity: string; unit: string }[]>([])
  const [estMarginConfig, setEstMarginConfig] = useState<{ targetMarginPercent: number | null; marginFormula: string }>({ targetMarginPercent: null, marginFormula: "selling" })

  // Custo automático da ficha técnica (info only — não editável)
  const { fichaTecnicaCost, hasUnitError } = useMemo(() => {
    let cost = 0
    let unitError = false
    for (const link of productLinks) {
      const item = stockItems.find((s) => s.id === link.stockItemId)
      if (!item) continue
      const qty = Number(link.quantity) || 0
      const linkUnit = link.unit || "un"
      const stockUnit = item.unit || "un"
      const converted = convertQuantity(qty, linkUnit, stockUnit)
      if (converted === null) { unitError = true; continue }
      cost += converted * (item.unitCost || 0)
    }
    return { fichaTecnicaCost: cost, hasUnitError: unitError }
  }, [productLinks, stockItems])

  const suggestedPrice = useMemo(() => {
    if (fichaTecnicaCost <= 0) return null
    const cat = categories.find((c) => c.id === productForm.categoryId)
    const m = cat?.targetMarginPercent
    if (!m) return null
    const margin = m / 100
    if ((cat.marginFormula || "selling") === "selling") {
      return margin >= 1 ? null : fichaTecnicaCost / (1 - margin)
    }
    return fichaTecnicaCost * (1 + margin)
  }, [fichaTecnicaCost, productForm.categoryId, categories])

  // Aparência state
  const [form, setForm] = useState({
    name: "",
    phone: "",
    logo: "",
    cover: "",
    instagramUrl: "",
    pickupMessage: "Vai ser um prazer recebê-lo. Estamos lhe aguardando!",
    deliveryMessage: "Obrigado pelo seu pedido!",
    confirmationTitle: "Pedido enviado!",
    confirmationImage: "",
    closedTitle: "",
    closedSub: "",
  })
  const [savingAppearance, setSavingAppearance] = useState(false)
  const [savedAppearance, setSavedAppearance] = useState(false)

  // Cores state
  const [colors, setColors] = useState({
    primaryColor: "#16a34a",
    backgroundColor: "#ffffff",
    textColor: "#1a1a2e",
    headerColor: "#ffffff",
  })
  const [colorsPublished, setColorsPublished] = useState(false)
  const [savingColors, setSavingColors] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; type: "category" | "product"; id: string; name: string; productCount?: number }>({ open: false, type: "category", id: "", name: "" })
  const [marginCatId, setMarginCatId] = useState<string | null>(null)
  const [marginCatPercent, setMarginCatPercent] = useState("")
  const [marginCatFormula, setMarginCatFormula] = useState<"selling" | "cost">("selling")
  const [savingMarginCat, setSavingMarginCat] = useState(false)

  async function loadData() {
    if (!establishmentId) return
    setLoading(true)
    const [catRes, stockRes, estRes] = await Promise.all([
      fetchAuth(`/api/categories?establishmentId=${establishmentId}`, { cache: "no-store" }),
      fetchAuth(`/api/stock?establishmentId=${establishmentId}`),
      fetchAuth(`/api/establishments?id=${establishmentId}`),
    ])
    if (catRes.ok) setCategories(await catRes.json())
    if (stockRes.ok) {
      const data = await stockRes.json()
      setStockItems(data.items)
    }
    if (estRes.ok) {
      const data = await estRes.json()
      setForm({
        name: data.name || "",
        phone: data.phone || "",
        logo: data.logo || "",
        cover: data.cover || "",
        instagramUrl: data.instagramUrl || "",
        pickupMessage: data.pickupMessage || "Vai ser um prazer recebê-lo. Estamos lhe aguardando!",
        deliveryMessage: data.deliveryMessage || "Obrigado pelo seu pedido!",
        confirmationTitle: data.confirmationTitle || "Pedido enviado!",
        confirmationImage: data.confirmationImage || "",
        closedTitle: data.closedTitle || "",
        closedSub: data.closedSub || "",
      })
      setColors({
        primaryColor: data.primaryColor || "#16a34a",
        backgroundColor: data.backgroundColor || "#ffffff",
        textColor: data.textColor || "#1a1a2e",
        headerColor: data.headerColor || "#ffffff",
      })
      setColorsPublished(data.colorsPublished || false)
      setEstablishmentSlug(data.slug || "")
      setEstMarginConfig({ targetMarginPercent: data.targetMarginPercent ?? null, marginFormula: data.marginFormula || "selling" })
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [establishmentId])

  async function addCategory() {
    if (!newCategoryName.trim() || !establishmentId) return
    await fetchAuth("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "category",
        name: newCategoryName,
        establishmentId,
      }),
    })
    setNewCategoryName("")
    setShowCategoryForm(false)
    loadData()
  }

  async function renameCategory(id: string) {
    if (!editingCategoryName.trim()) return
    await fetchAuth(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingCategoryName }),
    })
    setEditingCategoryId(null)
    setEditingCategoryName("")
    toast("Categoria renomeada", "success")
    loadData()
  }

  async function saveMarginCategory() {
    if (!marginCatId) return
    setSavingMarginCat(true)
    await fetchAuth(`/api/categories/${marginCatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetMarginPercent: marginCatPercent ? Number(marginCatPercent) : null,
        marginFormula: marginCatFormula,
      }),
    })
    setMarginCatId(null)
    setSavingMarginCat(false)
    toast("Margem salva", "success")
    loadData()
  }

  function getCategorySuggestedPrice(category: any, cost: number): number | null {
    const m = category.targetMarginPercent
    if (!m || cost <= 0) return null
    const margin = m / 100
    if ((category.marginFormula || "selling") === "selling") {
      return margin >= 1 ? null : cost / (1 - margin)
    }
    return cost * (1 + margin)
  }

  function handleDeleteCategory(id: string, name: string, productCount: number) {
    setDeleteConfirm({ open: true, type: "category", id, name, productCount })
  }

  async function confirmDelete() {
    if (deleteConfirm.type === "category") {
      await fetchAuth(`/api/categories/${deleteConfirm.id}`, { method: "DELETE" })
      toast("Categoria removida com sucesso", "success")
    } else {
      await fetchAuth(`/api/products/${deleteConfirm.id}`, { method: "DELETE" })
      toast("Produto removido com sucesso", "success")
    }
    setDeleteConfirm({ open: false, type: "category", id: "", name: "" })
    loadData()
  }

  async function saveProduct() {
    if (!establishmentId || !productForm.categoryId) return

    const formData = new FormData()
    formData.append("name", productForm.name)
    formData.append("description", productForm.description)
    formData.append("price", productForm.price)
    formData.append("categoryId", productForm.categoryId)
    formData.append("establishmentId", establishmentId)
    if (productForm.badge) formData.append("badge", productForm.badge)
    if (productForm.stockItemId) formData.append("stockItemId", productForm.stockItemId)
    formData.append("sendToPrep", String(productForm.sendToPrep))
    formData.append("availableOnline", String(productForm.availableOnline))
    formData.append("availablePresencial", String(productForm.availablePresencial))
    formData.append("availableWhatsapp", String(productForm.availableWhatsapp))

    // Handle image
    if (productForm.image && productForm.image.startsWith("data:")) {
      const parts = productForm.image.split(",")
      const mime = parts[0].match(/:(.*?);/)?.[1] || "image/jpeg"
      const bstr = atob(parts[1])
      const arr = new Uint8Array(bstr.length)
      for (let i = 0; i < bstr.length; i++) arr[i] = bstr.charCodeAt(i)
      const blob = new Blob([arr], { type: mime })
      formData.append("file", blob, "product.jpg")
    } else if (!productForm.image) {
      formData.append("image", "null")
    }

    let productId = editingProduct?.id

    try {
      if (editingProduct) {
        const res = await fetchAuth(`/api/products/${editingProduct.id}`, {
          method: "PATCH",
          body: formData,
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Erro desconhecido" }))
          alert(`Erro ao salvar: ${err.error || res.statusText}`)
          return
        }
      } else {
        const maxOrder = categories.find((c) => c.id === productForm.categoryId)?.products.length || 0
        formData.append("order", String(maxOrder))
        const res = await fetchAuth("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "product",
            name: productForm.name,
            description: productForm.description,
            price: parseFloat(productForm.price),
            image: productForm.image || null,
            badge: productForm.badge || null,
            stockItemId: productForm.stockItemId || null,
            sendToPrep: productForm.sendToPrep,
            availableOnline: productForm.availableOnline,
            availablePresencial: productForm.availablePresencial,
            availableWhatsapp: productForm.availableWhatsapp,
            establishmentId,
            categoryId: productForm.categoryId,
            order: maxOrder,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Erro desconhecido" }))
          alert(`Erro ao criar: ${err.error || res.statusText}`)
          return
        }
        const data = await res.json()
        productId = data.id
      }
    } catch (e: any) {
      alert(`Erro de rede: ${e.message}`)
      return
    }

    if (productId) {
      // Estratégia: deleta todos os links existentes e recria do zero.
      // Garante consistência entre o estado da UI e o banco.
      try {
        await fetchAuth(`/api/products/${productId}/stock-links/reset`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            links: productLinks
              .filter((l) => l.stockItemId && parseFloat(l.quantity) > 0)
              .map((l) => ({
                stockItemId: l.stockItemId,
                quantity: parseFloat(l.quantity),
                unit: l.unit || "un",
              })),
          }),
        })
      } catch (e) {
        console.error("Erro ao salvar links:", e)
      }
    }

    toast("Produto salvo com sucesso!", "success")
    // NÃO fecha o modal — mantém aberto pra ver o que salvou.
    // Atualiza editingProduct com dados novos (cache: no-store evita cache de 30s)
    if (productId) {
      const res = await fetchAuth(`/api/products/${productId}`, { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setEditingProduct(data)
        const links = (data as any).stockLinks || []
        setProductLinks(links.map((l: any) => ({ stockItemId: l.stockItemId, quantity: String(l.quantity), unit: l.unit || "un" })))
      }
    }
    await loadData()
  }

  function handleDeleteProduct(id: string, name: string) {
    setDeleteConfirm({ open: true, type: "product", id, name })
  }

  async function toggleSendToPrep(productId: string, currentValue: boolean) {
    if (!establishmentId) return
    const newValue = !currentValue
    try {
      const res = await fetchAuth(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendToPrep: newValue }),
      })
      if (!res.ok) {
        const err = await res.json()
        console.error("[toggleSendToPrep] API error:", err)
        toast(err.error || "Erro ao atualizar produto", "error")
        return
      }
      const data = await res.json()
      console.log("[toggleSendToPrep] saved:", data.sendToPrep)
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          products: cat.products.map((p) =>
            p.id === productId ? { ...p, sendToPrep: newValue } : p
          ),
        }))
      )
      toast(newValue ? "Item irá para preparo" : "Item não vai para preparo", "success")
    } catch (err) {
      console.error("[toggleSendToPrep] error:", err)
      toast("Erro ao atualizar produto", "error")
    }
  }

  function editProduct(product: Product) {
    // Usa dados do produto da lista pra abrir rápido, mas força refetch em background
    // pra garantir que stockLinks estão atualizados (evita cache de 30s do /api/categories)
    setEditingProduct(product)
    setProductForm({
      name: product.name,
      description: product.description || "",
      price: String(product.price),
      categoryId: product.categoryId,
      image: product.image || "",
      badge: product.badge || "",
      stockItemId: product.stockItemId || "",
      sendToPrep: product.sendToPrep || false,
      availableOnline: (product as any).availableOnline ?? true,
      availablePresencial: (product as any).availablePresencial ?? true,
      availableWhatsapp: (product as any).availableWhatsapp ?? true,
    })
    const links = (product as any).stockLinks || []
    setProductLinks(links.map((l: any) => ({ stockItemId: l.stockItemId, quantity: String(l.quantity), unit: l.unit || "un" })))
    setProductTab("basico")
    setShowProductForm(true)
    // Refetch em background pra atualizar stockLinks (cache: no-store evita o cache de 30s)
    fetchAuth(`/api/products/${product.id}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return
        setEditingProduct(data)
        const freshLinks = (data as any).stockLinks || []
        setProductLinks(freshLinks.map((l: any) => ({ stockItemId: l.stockItemId, quantity: String(l.quantity), unit: l.unit || "un" })))
        setProductForm((prev) => ({
          ...prev,
          availableOnline: data.availableOnline ?? true,
          availablePresencial: data.availablePresencial ?? true,
          availableWhatsapp: data.availableWhatsapp ?? true,
        }))
      })
      .catch(() => {})
  }

  function openNewProduct(categoryId: string) {
    setEditingProduct(null)
    setProductForm({ name: "", description: "", price: "", categoryId, image: "", badge: "", stockItemId: "", sendToPrep: false, availableOnline: true, availablePresencial: true, availableWhatsapp: true })
    setProductLinks([])
    setProductTab("basico")
    setShowProductForm(true)
  }

  async function moveProduct(productId: string, categoryId: string, direction: "up" | "down") {
    const cat = categories.find((c) => c.id === categoryId)
    if (!cat) return
    const sorted = [...cat.products].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex((p) => p.id === productId)
    if (idx === -1) return
    const swapIdx = direction === "up" ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return

    const a = sorted[idx]
    const b = sorted[swapIdx]

    await fetchAuth(`/api/products/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: b.order }),
    })
    await fetchAuth(`/api/products/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: a.order }),
    })
    loadData()
  }

  async function saveAppearance() {
    if (!establishmentId) return
    setSavingAppearance(true)
    setSavedAppearance(false)
    try {
      const res = await fetchAuth(`/api/establishments/${establishmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logo: form.logo,
          cover: form.cover,
          instagramUrl: form.instagramUrl,
          pickupMessage: form.pickupMessage,
          deliveryMessage: form.deliveryMessage,
          confirmationTitle: form.confirmationTitle,
          confirmationImage: form.confirmationImage,
          closedTitle: form.closedTitle,
          closedSub: form.closedSub,
        }),
      })
      if (res.ok) {
        setSavedAppearance(true)
        setTimeout(() => setSavedAppearance(false), 3000)
      }
    } finally {
      setSavingAppearance(false)
    }
  }

  async function saveColors(publish: boolean) {
    if (!establishmentId) return
    setSavingColors(true)
    try {
      const res = await fetchAuth(`/api/establishments/${establishmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...colors,
          colorsPublished: publish,
        }),
      })
      if (res.ok) {
        setColorsPublished(publish)
      }
    } finally {
      setSavingColors(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="flex items-center gap-2 text-2xl font-bold text-zinc-900">
        Cardápio
        {establishmentSlug && (
          <a href={`/${establishmentSlug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm font-normal text-green-600 hover:text-green-700">
            <ExternalLink className="h-4 w-4" />
            Ver público
          </a>
        )}
      </h2>

      {/* Tabs */}
      <div className="flex gap-2 rounded-lg border border-zinc-200 bg-zinc-100 p-1">
        <button
          onClick={() => setActiveTab("produtos")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "produtos"
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-500"
          }`}
        >
          <UtensilsCrossed className="h-4 w-4" />
          Produtos
        </button>
        <button
          onClick={() => setActiveTab("aparencia")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "aparencia"
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-500"
          }`}
        >
          <ImageIcon className="h-4 w-4" />
          Aparência
        </button>
        <button
          onClick={() => setActiveTab("cores")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "cores"
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-500"
          }`}
        >
          <Palette className="h-4 w-4" />
          Cores
        </button>
      </div>

      {/* Produtos Tab */}
      {activeTab === "produtos" && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">Gerencie as categorias e produtos do seu cardápio</p>
            <Button onClick={() => setShowCategoryForm(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Nova Categoria
            </Button>
          </div>

          {categories.map((cat) => {
            const sorted = [...cat.products].sort((a, b) => a.order - b.order)
            return (
              <Card key={cat.id}>
                <CardContent className="p-4">
                  <div className="mb-4 flex items-center justify-between">
                    {editingCategoryId === cat.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          value={editingCategoryName}
                          onChange={(e) => setEditingCategoryName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") renameCategory(cat.id)
                            if (e.key === "Escape") setEditingCategoryId(null)
                          }}
                          className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-lg font-semibold text-zinc-900 focus:border-green-600 focus:outline-none"
                          autoFocus
                        />
                        <Button size="sm" onClick={() => renameCategory(cat.id)}>Salvar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingCategoryId(null)}>Cancelar</Button>
                      </div>
                    ) : (
                      <h3 className="text-lg font-semibold text-zinc-900 cursor-pointer hover:text-green-600" onClick={() => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name) }}>
                        {cat.name}
                      </h3>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setMarginCatId(cat.id)
                          setMarginCatPercent(cat.targetMarginPercent != null ? String(cat.targetMarginPercent) : "")
                          setMarginCatFormula((cat.marginFormula || "selling") as "selling" | "cost")
                        }}
                        className={`p-1 rounded transition-colors ${cat.targetMarginPercent != null ? "text-green-600 hover:text-green-700" : "text-zinc-400 hover:text-zinc-600"}`}
                        title={cat.targetMarginPercent != null ? `Margem: ${cat.targetMarginPercent}%` : "Configurar margem"}
                      >
                        <Percent className="h-4 w-4" />
                      </button>
                      <Button size="sm" variant="ghost" onClick={() => openNewProduct(cat.id)}>
                        <Plus className="h-4 w-4" />
                        Adicionar
                      </Button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id, cat.name, cat.products.length)}
                        className="text-red-400 hover:text-red-400 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {marginCatId === cat.id && (
                    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 mb-2">
                      <div className="flex items-center gap-2">
                        <Percent className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-zinc-700">Margem:</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setMarginCatFormula("selling")} className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${marginCatFormula === "selling" ? "bg-green-600 text-white" : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300"}`}>Sobre preço</button>
                        <button onClick={() => setMarginCatFormula("cost")} className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${marginCatFormula === "cost" ? "bg-green-600 text-white" : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300"}`}>Markup</button>
                      </div>
                      <div className="relative">
                        <input type="number" min={0} max={100} step="0.1" placeholder="60" value={marginCatPercent} onChange={(e) => setMarginCatPercent(e.target.value)} className="h-8 w-20 rounded-lg border border-zinc-200 bg-white px-2 pr-6 text-sm focus:border-green-600 focus:outline-none" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400">%</span>
                      </div>
                      <Button size="sm" onClick={saveMarginCategory} disabled={savingMarginCat}>
                        {savingMarginCat ? "..." : "Salvar"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setMarginCatId(null)}>Cancelar</Button>
                    </div>
                  )}

                  {sorted.length === 0 ? (
                    <p className="py-4 text-center text-sm text-zinc-400">
                      Nenhum produto nesta categoria
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {sorted.map((product, idx) => (
                        <div
                          key={product.id}
                          className="flex items-center gap-3 rounded-lg border border-white/[.04] bg-zinc-50 p-3"
                        >
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => moveProduct(product.id, cat.id, "up")}
                              disabled={idx === 0}
                              className="text-zinc-700 hover:text-zinc-400 disabled:opacity-30"
                            >
                              <GripVertical className="h-3 w-3 -rotate-90" />
                            </button>
                            <button
                              onClick={() => moveProduct(product.id, cat.id, "down")}
                              disabled={idx === sorted.length - 1}
                              className="text-zinc-700 hover:text-zinc-400 disabled:opacity-30"
                            >
                              <GripVertical className="h-3 w-3 rotate-90" />
                            </button>
                          </div>

                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="h-12 w-12 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/[.08] text-xl">
                              🍕
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-zinc-900">{product.name}</p>
                              {!product.isAvailable && <Badge variant="danger">Indisponível</Badge>}
                              {product.stockItemId && <Badge variant="success">Vendável</Badge>}
                              {getBadgeDisplay(product.badge)}
                            </div>
                            {product.description && (
                              <p className="text-sm text-zinc-500 truncate">{product.description}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="font-bold text-green-600">
                                {formatCurrency(product.price)}
                              </span>
                              {(() => {
                                const links = (product as any).stockLinks || []
                                if (links.length === 0 || !cat.targetMarginPercent) return null
                                let cost = 0
                                for (const link of links) {
                                  const item = stockItems.find((s: any) => s.id === link.stockItemId)
                                  if (!item) continue
                                  const qty = Number(link.quantity) || 0
                                  const linkUnit = link.unit || "un"
                                  const stockUnit = item.unit || "un"
                                  const converted = convertQuantity(qty, linkUnit, stockUnit)
                                  if (converted === null) continue
                                  cost += converted * (item.unitCost || 0)
                                }
                                const suggested = getCategorySuggestedPrice(cat, cost)
                                if (!suggested) return null
                                return <p className="text-[10px] text-green-600 font-medium">Sug: {formatCurrency(suggested)}</p>
                              })()}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSendToPrep(product.id, product.sendToPrep) }}
                              className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors shrink-0 ${
                                product.sendToPrep
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-zinc-100 text-zinc-400"
                              }`}
                              title={product.sendToPrep ? "Entra no preparo (clique para desativar)" : "Não vai para preparo (clique para ativar)"}
                            >
                              <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                                product.sendToPrep ? "bg-orange-500" : "bg-zinc-300"
                              }`}>
                                <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${
                                  product.sendToPrep ? "translate-x-3.5" : "translate-x-0.5"
                                }`} />
                              </span>
                              {product.sendToPrep ? "Preparo" : "Sem preparo"}
                            </button>
                            <button
                              onClick={() => editProduct(product)}
                              className="text-zinc-400 hover:text-zinc-400"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product.id, product.name)}
                              className="text-red-400 hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}

          {categories.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/[.08] p-12 text-center">
              <UtensilsCrossed className="mx-auto h-8 w-8 text-zinc-700" />
              <p className="mt-2 text-sm text-zinc-500">Crie uma categoria para começar</p>
            </div>
          )}
        </>
      )}

      {/* Aparência Tab */}
      {activeTab === "aparencia" && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">Aparência do Cardápio</h3>
            <p className="text-sm text-zinc-500">Personalize a visualização do seu cardápio público.</p>
            
            {/* Preview do cardápio */}
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs text-zinc-400 mb-3">Pré-visualização</p>
              <div className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm border border-white/[.04]">
                {form.logo ? (
                  <img src={form.logo} alt="Logo" className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600/10">
                    <ImageIcon className="h-5 w-5 text-green-600" />
                  </div>
                )}
                <div>
                  <p className="font-bold text-zinc-900">{form.name || "Nome do Estabelecimento"}</p>
                  <p className="text-xs text-zinc-500">{form.phone || "Telefone"}</p>
                </div>
              </div>
            </div>

            {/* Upload da Logo */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Logo do Estabelecimento</label>
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/[.08] bg-white px-4 py-3 text-sm text-zinc-400 hover:bg-zinc-100 hover:border-green-600/50 transition-colors">
                  <Upload className="h-4 w-4" />
                  <span>Selecionar imagem</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onloadend = () => setForm({ ...form, logo: reader.result as string })
                        reader.readAsDataURL(file)
                      }
                    }}
                  />
                </label>
                {form.logo && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, logo: "" })}
                    className="text-xs text-red-500 hover:text-red-400"
                  >
                    Remover
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-zinc-400">Ou cole a URL da imagem abaixo</p>
              <input
                type="text"
                placeholder="https://..."
                value={form.logo.startsWith("data:") ? "" : form.logo}
                onChange={(e) => setForm({ ...form, logo: e.target.value })}
                className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Link do Instagram</label>
              <input
                type="text"
                id="instagramUrl"
                placeholder="https://instagram.com/seuperfil"
                value={form.instagramUrl}
                onChange={(e) => setForm({ ...form, instagramUrl: e.target.value })}
                className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
              />
              <p className="mt-1 text-xs text-zinc-400">Aparecerá no cardápio público como &quot;Siga-nos&quot; vinculado à logo</p>
            </div>

            <div className="border-t border-white/[.04] pt-4">
              <h4 className="text-sm font-semibold text-zinc-900 mb-3">Mensagens de Pedido</h4>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Título de Confirmação</label>
                  <input
                    placeholder="Pedido enviado!"
                    value={form.confirmationTitle}
                    onChange={(e) => setForm({ ...form, confirmationTitle: e.target.value })}
                    className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-zinc-400">Título exibido ao cliente após finalizar o pedido</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Imagem de Confirmação</label>
                  <div className="flex items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/[.08] bg-white px-4 py-3 text-sm text-zinc-400 hover:bg-zinc-100 hover:border-green-600/50 transition-colors">
                      <Upload className="h-4 w-4" />
                      <span>Selecionar imagem</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onloadend = () => {
                            const img = new window.Image()
                            img.onload = () => {
                              const MAX = 600
                              let w = img.width, h = img.height
                              if (w > MAX || h > MAX) {
                                if (w > h) { h = Math.round(h * MAX / w); w = MAX }
                                else { w = Math.round(w * MAX / h); h = MAX }
                              }
                              const canvas = document.createElement("canvas")
                              canvas.width = w
                              canvas.height = h
                              canvas.getContext("2d")!.drawImage(img, 0, 0, w, h)
                              setForm({ ...form, confirmationImage: canvas.toDataURL("image/jpeg", 0.7) })
                            }
                            img.src = reader.result as string
                          }
                          reader.readAsDataURL(file)
                        }}
                      />
                    </label>
                    {form.confirmationImage && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, confirmationImage: "" })}
                        className="text-xs text-red-500 hover:text-red-400"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">Imagem exibida no card de confirmação. Se vazia, usa a logo.</p>
                  {form.confirmationImage && (
                    <img src={form.confirmationImage} alt="Preview" className="mt-2 h-16 w-16 rounded-xl object-cover" />
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Mensagem de Retirada</label>
                  <textarea
                    placeholder="Vai ser um prazer recebê-lo. Estamos lhe aguardando!"
                    value={form.pickupMessage}
                    onChange={(e) => setForm({ ...form, pickupMessage: e.target.value })}
                    rows={3}
                    className="flex w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-zinc-400">Mensagem exibida ao cliente ao finalizar um pedido de retirada</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Mensagem de Entrega</label>
                  <textarea
                    placeholder="Obrigado pelo seu pedido!"
                    value={form.deliveryMessage}
                    onChange={(e) => setForm({ ...form, deliveryMessage: e.target.value })}
                    rows={3}
                    className="flex w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-zinc-400">Mensagem exibida ao cliente ao finalizar um pedido de entrega</p>
                </div>
              </div>

              {/* Mensagem de Fechamento */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400" />
                  <h4 className="text-sm font-semibold text-amber-800">Mensagem quando fechado</h4>
                </div>
                <p className="text-xs text-amber-400">Personalize a mensagem exibida quando o estabelecimento estiver fechado. Use {'{day}'} e {'{time}'} para preencher automaticamente.</p>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Título</label>
                  <input
                    placeholder="Encerramos por hoje, mas {day} às {time} retornamos"
                    value={form.closedTitle}
                    onChange={(e) => setForm({ ...form, closedTitle: e.target.value })}
                    className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Submensagem</label>
                  <input
                    placeholder="Aguarde, estaremos de volta!"
                    value={form.closedSub}
                    onChange={(e) => setForm({ ...form, closedSub: e.target.value })}
                    className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
                {/* Preview */}
                <div className="rounded-lg border border-amber-500/20 bg-white p-3">
                  <p className="mb-2 text-[10px] font-medium text-zinc-400 uppercase">Preview (simula terça às 14:00)</p>
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-center">
                    <p className="text-sm font-medium text-amber-800">
                      {form.closedTitle
                        ? form.closedTitle.replace(/\{day\}/g, "quarta").replace(/\{time\}/g, "09:00")
                        : "Encerramos por hoje, mas quarta às 09:00 retornamos"}
                    </p>
                    <p className="mt-1 text-xs text-amber-400">
                      {form.closedSub || "Aguarde, estaremos de volta!"}
                    </p>
                    <p className="mt-1 text-xs font-medium text-amber-400 underline">Ver horários de funcionamento</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="button" onClick={saveAppearance} disabled={savingAppearance}>
                {savingAppearance ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar aparência
              </Button>
              {savedAppearance && <span className="flex items-center gap-1 text-sm text-green-600"><Save className="h-4 w-4" />Salvo!</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cores Tab */}
      {activeTab === "cores" && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
                  <Palette className="h-5 w-5 text-[#FF6B35]" />
                  Personalização de Cores
                </h3>
                <p className="text-sm text-zinc-500">Customize as cores do seu cardápio público.</p>
              </div>
              <div className="flex items-center gap-2">
                {colorsPublished ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-600/10 px-2 py-1 text-xs font-medium text-green-600">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-600"></div>
                    Publicado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-400">
                    <div className="h-1.5 w-1.5 rounded-full bg-zinc-400"></div>
                    Rascunho
                  </span>
                )}
              </div>
            </div>

            {/* Color Picker + Preview */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Color Pickers */}
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Cor primária (botões, destaques)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colors.primaryColor}
                      onChange={(e) => setColors({ ...colors, primaryColor: e.target.value })}
                      className="h-10 w-10 cursor-pointer rounded border-0"
                    />
                    <input
                      type="text"
                      value={colors.primaryColor}
                      onChange={(e) => setColors({ ...colors, primaryColor: e.target.value })}
                      className="flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Cor de fundo</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colors.backgroundColor}
                      onChange={(e) => setColors({ ...colors, backgroundColor: e.target.value })}
                      className="h-10 w-10 cursor-pointer rounded border-0"
                    />
                    <input
                      type="text"
                      value={colors.backgroundColor}
                      onChange={(e) => setColors({ ...colors, backgroundColor: e.target.value })}
                      className="flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Cor do texto</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colors.textColor}
                      onChange={(e) => setColors({ ...colors, textColor: e.target.value })}
                      className="h-10 w-10 cursor-pointer rounded border-0"
                    />
                    <input
                      type="text"
                      value={colors.textColor}
                      onChange={(e) => setColors({ ...colors, textColor: e.target.value })}
                      className="flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Cor do header</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colors.headerColor}
                      onChange={(e) => setColors({ ...colors, headerColor: e.target.value })}
                      className="h-10 w-10 cursor-pointer rounded border-0"
                    />
                    <input
                      type="text"
                      value={colors.headerColor}
                      onChange={(e) => setColors({ ...colors, headerColor: e.target.value })}
                      className="flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Live Preview */}
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs text-zinc-400 mb-3">Pré-visualização ao vivo</p>
                <div
                  className="rounded-lg overflow-hidden shadow-sm"
                  style={{ backgroundColor: colors.backgroundColor }}
                >
                  {/* Header Preview */}
                  <div
                    className="p-3 flex items-center gap-2"
                    style={{ backgroundColor: colors.headerColor }}
                  >
                    {form.logo ? (
                      <img src={form.logo} alt="Logo" className="h-6 w-6 rounded object-cover" />
                    ) : (
                      <div className="h-6 w-6 rounded" style={{ backgroundColor: colors.primaryColor + "30" }}></div>
                    )}
                    <span className="font-bold text-sm" style={{ color: colors.textColor }}>
                      {form.name || "Seu Restaurante"}
                    </span>
                  </div>
                  {/* Content Preview */}
                  <div className="p-3 space-y-2">
                    <div className="rounded-lg p-2" style={{ backgroundColor: colors.backgroundColor === "#ffffff" ? "#f9fafb" : colors.backgroundColor }}>
                      <div className="h-2 w-16 rounded mb-1" style={{ backgroundColor: colors.textColor + "30" }}></div>
                      <div className="h-2 w-24 rounded mb-2" style={{ backgroundColor: colors.textColor + "20" }}></div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold" style={{ color: colors.primaryColor }}>R$ 45,00</span>
                        <div
                          className="rounded px-2 py-0.5 text-[10px] font-medium text-white"
                          style={{ backgroundColor: colors.primaryColor }}
                        >
                          Adicionar
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => saveColors(false)}
                disabled={savingColors}
              >
                {savingColors ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar rascunho
              </Button>
              <Button
                type="button"
                onClick={() => saveColors(true)}
                disabled={savingColors}
                className="bg-[#FF6B35] hover:bg-[#E55A2B]"
              >
                {savingColors ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                Publicar
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setColors({
                    primaryColor: "#16a34a",
                    backgroundColor: "#ffffff",
                    textColor: "#1a1a2e",
                    headerColor: "#ffffff",
                  })
                }}
              >
                Resetar cores
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category Modal */}
      {showCategoryForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Nova Categoria</h3>
                <button onClick={() => setShowCategoryForm(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <input
                placeholder="Ex: Bebidas, Sobremesas..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                autoFocus
                className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
              />
              <div className="mt-4 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowCategoryForm(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={addCategory}>
                  Criar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Product Modal */}
      {showProductForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto p-4">
          <Card className="w-full max-w-lg my-8 max-h-[calc(100vh-4rem)] flex flex-col">
            <CardContent className="p-6 overflow-y-auto flex-1">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {editingProduct ? "Editar Produto" : "Novo Produto"}
                </h3>
                <button onClick={() => { setShowProductForm(false); setEditingProduct(null) }}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-3">
                {/* Tab Navigation */}
                <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1">
                  {([
                    { key: "basico", label: "Básico" },
                    { key: "onde", label: "Onde aparece" },
                    { key: "ficha", label: "Ficha técnica" },
                  ] as const).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setProductTab(tab.key)}
                      className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        productTab === tab.key
                          ? "bg-white text-zinc-900 shadow-sm"
                          : "text-zinc-500 hover:text-zinc-700"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Aba Básico */}
                {productTab === "basico" && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-zinc-700">Nome</label>
                      <input
                        placeholder="Ex: Pizza Calabresa"
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-zinc-700">Descrição</label>
                      <textarea
                        placeholder="Ex: Molho, mussarela, calabresa..."
                        value={productForm.description}
                        onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                        rows={2}
                        className="flex w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-zinc-700">Preço de venda</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="29,90"
                          value={Number(productForm.price || 0).toFixed(2)}
                          onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                          className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 pl-10 pr-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                        />
                      </div>
                    </div>
                    {fichaTecnicaCost > 0 && (
                      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5">
                        <p className="text-xs text-zinc-500">Custo (ficha técnica)</p>
                        <p className="text-sm font-semibold text-zinc-700">{formatCurrency(fichaTecnicaCost)}</p>
                      </div>
                    )}
                    {suggestedPrice != null && (
                      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2.5">
                        <p className="text-xs text-green-600">Preço sugerido</p>
                        <p className="text-sm font-bold text-green-700">{formatCurrency(suggestedPrice)}</p>
                      </div>
                    )}
                    {hasUnitError && (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5">
                        <p className="text-xs text-amber-700">⚠️ Unidades incompatíveis no estoque — o custo pode estar incompleto. Verifique as unidades dos insumos.</p>
                      </div>
                    )}
                    {/* Image */}
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700">
                        <ImageIcon className="mr-1 inline h-3 w-3" />
                        Imagem do Produto
                      </label>
                      <div className="flex items-center gap-3">
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/[.08] bg-white px-4 py-3 text-sm text-zinc-400 hover:bg-zinc-100 hover:border-green-600/50 transition-colors">
                          <Upload className="h-4 w-4" />
                          <span>Selecionar foto</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              const reader = new FileReader()
                              reader.onloadend = () => {
                                const img = new window.Image()
                                img.onload = () => {
                                  const MAX = 600
                                  let w = img.width, h = img.height
                                  if (w > MAX || h > MAX) {
                                    if (w > h) { h = Math.round(h * MAX / w); w = MAX }
                                    else { w = Math.round(w * MAX / h); h = MAX }
                                  }
                                  const canvas = document.createElement("canvas")
                                  canvas.width = w
                                  canvas.height = h
                                  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h)
                                  const compressed = canvas.toDataURL("image/jpeg", 0.7)
                                  setProductForm({ ...productForm, image: compressed })
                                }
                                img.src = reader.result as string
                              }
                              reader.readAsDataURL(file)
                            }}
                          />
                        </label>
                        {productForm.image && (
                          <button
                            type="button"
                            onClick={() => setProductForm({ ...productForm, image: "" })}
                            className="text-xs text-red-500 hover:text-red-400"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-zinc-400">Ou cole a URL da imagem abaixo</p>
                      <input
                        placeholder="https://exemplo.com/foto.jpg"
                        value={productForm.image.startsWith("data:") ? "" : productForm.image}
                        onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
                        className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                      />
                      {productForm.image && (
                        <img
                          src={productForm.image}
                          alt="Preview"
                          className="mt-2 h-20 w-20 rounded-lg object-cover"
                          onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Aba Onde aparece */}
                {productTab === "onde" && (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700">Categoria</label>
                      <SearchableSelect
                        value={productForm.categoryId}
                        onChange={(v) => setProductForm({ ...productForm, categoryId: v })}
                        options={categories.map((c) => ({ value: c.id, label: c.name }))}
                        placeholder="Selecionar categoria..."
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700">Destaque</label>
                      <div className="flex flex-wrap gap-2">
                        {BADGE_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setProductForm({ ...productForm, badge: productForm.badge === opt.value ? "" : opt.value })}
                            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                              productForm.badge === opt.value
                                ? "border-green-600 bg-green-600/10 text-green-600"
                                : "border-zinc-200 text-zinc-400 hover:bg-zinc-100"
                            }`}
                          >
                            {opt.icon && <opt.icon className="mr-1 inline h-3 w-3" />}
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Flags de disponibilidade */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Disponibilidade</p>
                      {([
                        { key: "availableOnline", emoji: "🌐", title: "Cardápio online", desc: "Aparece no cardápio público" },
                        { key: "availablePresencial", emoji: "🪑", title: "Pedidos presenciais/mesa", desc: "Aparece no caixa e mesa" },
                        { key: "availableWhatsapp", emoji: "💬", title: "WhatsApp/bot", desc: "Aparece no atendimento por WhatsApp" },
                      ] as const).map((flag) => (
                        <div
                          key={flag.key}
                          className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
                            (productForm as any)[flag.key]
                              ? "border-green-200 bg-green-50"
                              : "border-zinc-200"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{flag.emoji}</span>
                            <div>
                              <p className="text-sm font-medium text-zinc-900">{flag.title}</p>
                              <p className="text-xs text-zinc-500">{flag.desc}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setProductForm({ ...productForm, [flag.key]: !(productForm as any)[flag.key] })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              (productForm as any)[flag.key] ? "bg-green-500" : "bg-zinc-300"
                            }`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              (productForm as any)[flag.key] ? "translate-x-6" : "translate-x-1"
                            }`} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {/* Enviar para preparo */}
                    <div className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
                      productForm.sendToPrep ? "border-orange-300 bg-orange-50" : "border-zinc-200"
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className="text-xl">👨‍🍳</span>
                        <div>
                          <p className="text-sm font-medium text-zinc-900">Enviar para preparo</p>
                          <p className="text-xs text-zinc-500">Aparece no módulo Pedidos para a cozinha</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setProductForm({ ...productForm, sendToPrep: !productForm.sendToPrep })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          productForm.sendToPrep ? "bg-orange-500" : "bg-zinc-300"
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          productForm.sendToPrep ? "translate-x-6" : "translate-x-1"
                        }`} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Aba Ficha técnica */}
                {productTab === "ficha" && (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700">
                        Vincular ao Estoque (venda direta)
                      </label>
                      <SearchableSelect
                        value={productForm.stockItemId}
                        onChange={(v) => setProductForm({ ...productForm, stockItemId: v })}
                        options={[{ value: "", label: "Nenhum (sem controle de estoque)" }, ...stockItems.map((item) => ({ value: item.id, label: item.name, sub: `(${item.quantity} ${item.unit})` }))]}
                        placeholder="Buscar item de estoque..."
                      />
                      <p className="mt-1 text-xs text-zinc-400">
                        Selecione um item do estoque para debitar automaticamente ao vender
                      </p>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700">
                        Vincular Insumos (receita)
                      </label>
                      {stockItems.length === 0 ? (
                        <p className="text-xs text-zinc-400">Cadastre insumos no estoque primeiro</p>
                      ) : (
                        <div className="space-y-2">
                          {productLinks.length > 0 && (
                            <div className="space-y-1.5">
                              {productLinks.map((link) => {
                                const item = stockItems.find((s) => s.id === link.stockItemId)
                                if (!item) return null
                                return (
                                  <div key={link.stockItemId} className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-1.5">
                                    <span className="flex-1 text-xs text-zinc-700">{item.name}</span>
                                    <input
                                      type="number"
                                      min="0.01"
                                      step="0.01"
                                      value={link.quantity}
                                      onChange={(e) =>
                                        setProductLinks(
                                          productLinks.map((l) =>
                                            l.stockItemId === link.stockItemId ? { ...l, quantity: e.target.value } : l
                                          )
                                        )
                                      }
                                      className="h-7 w-16 rounded border border-zinc-200 bg-white px-1.5 text-xs text-center text-zinc-700 focus:border-green-600 focus:outline-none"
                                    />
                                    <select
                                      value={link.unit}
                                      onChange={(e) =>
                                        setProductLinks(
                                          productLinks.map((l) =>
                                            l.stockItemId === link.stockItemId ? { ...l, unit: e.target.value } : l
                                          )
                                        )
                                      }
                                      className="h-7 rounded border border-zinc-200 bg-white px-1.5 text-xs text-zinc-700 focus:border-green-600 focus:outline-none"
                                    >
                                      <option value="g">g</option>
                                      <option value="kg">kg</option>
                                      <option value="ml">ml</option>
                                      <option value="L">L</option>
                                      <option value="un">un</option>
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => setProductLinks(productLinks.filter((l) => l.stockItemId !== link.stockItemId))}
                                      className="text-zinc-400 hover:text-red-500"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                          <SearchableSelect
                            value=""
                            onChange={(v) => {
                              if (v && !productLinks.find((l) => l.stockItemId === v)) {
                                const item = stockItems.find((s) => s.id === v)
                                const defaultUnit = item?.unit || "un"
                                setProductLinks([...productLinks, { stockItemId: v, quantity: "1", unit: defaultUnit }])
                              }
                            }}
                            options={stockItems.filter((s) => !productLinks.find((l) => l.stockItemId === s.id)).map((item) => ({ value: item.id, label: item.name, sub: `(${item.quantity} ${item.unit})` }))}
                            placeholder="Adicionar insumo..."
                          />
                        </div>
                      )}
                    </div>
                    {fichaTecnicaCost > 0 && (
                      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5">
                        <p className="text-xs text-zinc-500">Custo total da ficha técnica</p>
                        <p className="text-sm font-semibold text-zinc-700">{formatCurrency(fichaTecnicaCost)}</p>
                      </div>
                    )}
                    {suggestedPrice != null && (
                      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2.5">
                        <p className="text-xs text-green-600">Preço sugerido</p>
                        <p className="text-sm font-bold text-green-700">{formatCurrency(suggestedPrice)}</p>
                      </div>
                    )}
                    {hasUnitError && (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5">
                        <p className="text-xs text-amber-700">⚠️ Unidades incompatíveis — o custo pode estar incompleto. Verifique se as unidades dos insumos são compatíveis com as do estoque.</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => { setShowProductForm(false); setEditingProduct(null) }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => { setShowProductForm(false); setEditingProduct(null) }}
                  >
                    Fechar
                  </Button>
                  <Button className="flex-1" onClick={saveProduct}>
                    {editingProduct ? "Salvar" : "Adicionar"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirm.open}
        title={deleteConfirm.type === "category" ? "Remover categoria" : "Remover produto"}
        message={
          deleteConfirm.type === "category"
            ? `Tem certeza que deseja remover a categoria "${deleteConfirm.name}" e seus ${deleteConfirm.productCount || 0} produtos? Esta ação não pode ser desfeita.`
            : `Tem certeza que deseja remover o produto "${deleteConfirm.name}"? Esta ação não pode ser desfeita.`
        }
        confirmLabel="Remover"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ open: false, type: "category", id: "", name: "" })}
      />
    </div>
  )
}
