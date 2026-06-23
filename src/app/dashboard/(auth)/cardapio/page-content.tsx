"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Plus, Pencil, Trash2, UtensilsCrossed, X, GripVertical, Star, Sparkles, Tag, Image as ImageIcon, Upload, Eye, Save, Loader2, Palette } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { fetchAuth } from "@/lib/fetch-auth"

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  image: string | null
  isAvailable: boolean
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
}

const BADGE_OPTIONS = [
  { value: "", label: "Nenhum", icon: null },
  { value: "mais_vendido", label: "Mais Vendido", icon: Star, color: "text-amber-500 bg-amber-50" },
  { value: "novo", label: "Novo", icon: Sparkles, color: "text-blue-500 bg-blue-50" },
  { value: "promocao", label: "Promoção", icon: Tag, color: "text-red-500 bg-red-50" },
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
  const [activeTab, setActiveTab] = useState<Tab>("produtos")
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [showProductForm, setShowProductForm] = useState(false)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    price: "",
    categoryId: "",
    image: "",
    badge: "",
    stockItemId: "",
  })
  const [stockItems, setStockItems] = useState<any[]>([])
  const [productLinks, setProductLinks] = useState<{ stockItemId: string; quantity: string }[]>([])

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

  async function loadData() {
    if (!establishmentId) return
    setLoading(true)
    const [catRes, stockRes, estRes] = await Promise.all([
      fetchAuth(`/api/categories?establishmentId=${establishmentId}`),
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
      })
      setColors({
        primaryColor: data.primaryColor || "#16a34a",
        backgroundColor: data.backgroundColor || "#ffffff",
        textColor: data.textColor || "#1a1a2e",
        headerColor: data.headerColor || "#ffffff",
      })
      setColorsPublished(data.colorsPublished || false)
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

  async function deleteCategory(id: string) {
    if (!confirm("Remover esta categoria e todos os produtos?")) return
    await fetchAuth(`/api/categories/${id}`, { method: "DELETE" })
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
            name: productForm.name,
            description: productForm.description,
            price: parseFloat(productForm.price),
            image: productForm.image || null,
            badge: productForm.badge || null,
            stockItemId: productForm.stockItemId || null,
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
      for (const link of productLinks) {
        if (link.stockItemId && parseFloat(link.quantity) > 0) {
          await fetchAuth("/api/stock/links", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId, stockItemId: link.stockItemId, quantity: parseFloat(link.quantity) }),
          })
        }
      }
    }

    setShowProductForm(false)
    setEditingProduct(null)
    setProductForm({ name: "", description: "", price: "", categoryId: "", image: "", badge: "", stockItemId: "" })
    setProductLinks([])
    loadData()
  }

  async function deleteProduct(id: string) {
    if (!confirm("Remover este produto?")) return
    await fetchAuth(`/api/products/${id}`, { method: "DELETE" })
    loadData()
  }

  function editProduct(product: Product) {
    setEditingProduct(product)
    setProductForm({
      name: product.name,
      description: product.description || "",
      price: String(product.price),
      categoryId: product.categoryId,
      image: product.image || "",
      badge: product.badge || "",
      stockItemId: product.stockItemId || "",
    })
    const links = (product as any).stockLinks || []
    setProductLinks(links.map((l: any) => ({ stockItemId: l.stockItemId, quantity: String(l.quantity) })))
    setShowProductForm(true)
  }

  function openNewProduct(categoryId: string) {
    setEditingProduct(null)
    setProductForm({ name: "", description: "", price: "", categoryId, image: "", badge: "", stockItemId: "" })
    setProductLinks([])
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
      <h2 className="text-2xl font-bold text-zinc-900">Cardápio</h2>

      {/* Tabs */}
      <div className="flex gap-2 rounded-lg border border-zinc-200 bg-zinc-100 p-1">
        <button
          onClick={() => setActiveTab("produtos")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "produtos"
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-700"
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
              : "text-zinc-500 hover:text-zinc-700"
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
              : "text-zinc-500 hover:text-zinc-700"
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
                    <h3 className="text-lg font-semibold text-zinc-900">{cat.name}</h3>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openNewProduct(cat.id)}>
                        <Plus className="h-4 w-4" />
                        Adicionar
                      </Button>
                      <button
                        onClick={() => deleteCategory(cat.id)}
                        className="text-red-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {sorted.length === 0 ? (
                    <p className="py-4 text-center text-sm text-zinc-400">
                      Nenhum produto nesta categoria
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {sorted.map((product, idx) => (
                        <div
                          key={product.id}
                          className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3"
                        >
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => moveProduct(product.id, cat.id, "up")}
                              disabled={idx === 0}
                              className="text-zinc-300 hover:text-zinc-600 disabled:opacity-30"
                            >
                              <GripVertical className="h-3 w-3 -rotate-90" />
                            </button>
                            <button
                              onClick={() => moveProduct(product.id, cat.id, "down")}
                              disabled={idx === sorted.length - 1}
                              className="text-zinc-300 hover:text-zinc-600 disabled:opacity-30"
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
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-200 text-xl">
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
                            <span className="font-bold text-green-600">
                              {formatCurrency(product.price)}
                            </span>
                            <button
                              onClick={() => editProduct(product)}
                              className="text-zinc-400 hover:text-zinc-600"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => deleteProduct(product.id)}
                              className="text-red-400 hover:text-red-600"
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
            <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center">
              <UtensilsCrossed className="mx-auto h-8 w-8 text-zinc-300" />
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
              <div className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm border border-zinc-100">
                {form.logo ? (
                  <img src={form.logo} alt="Logo" className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
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
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-600 hover:bg-zinc-50 hover:border-green-400 transition-colors">
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
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remover
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-zinc-400">Ou cole a URL da imagem abaixo</p>
              <Input label="" id="logo" placeholder="https://..." value={form.logo.startsWith("data:") ? "" : form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Link do Instagram</label>
              <Input
                id="instagramUrl"
                placeholder="https://instagram.com/seuperfil"
                value={form.instagramUrl}
                onChange={(e) => setForm({ ...form, instagramUrl: e.target.value })}
              />
              <p className="mt-1 text-xs text-zinc-400">Aparecerá no cardápio público como &quot;Siga-nos&quot; vinculado à logo</p>
            </div>

            <div className="border-t border-zinc-100 pt-4">
              <h4 className="text-sm font-semibold text-zinc-900 mb-3">Mensagens de Pedido</h4>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Título de Confirmação</label>
                  <Input
                    placeholder="Pedido enviado!"
                    value={form.confirmationTitle}
                    onChange={(e) => setForm({ ...form, confirmationTitle: e.target.value })}
                  />
                  <p className="mt-1 text-xs text-zinc-400">Título exibido ao cliente após finalizar o pedido</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Imagem de Confirmação</label>
                  <div className="flex items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-600 hover:bg-zinc-50 hover:border-green-400 transition-colors">
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
                        className="text-xs text-red-500 hover:text-red-700"
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
                  <Textarea
                    placeholder="Vai ser um prazer recebê-lo. Estamos lhe aguardando!"
                    value={form.pickupMessage}
                    onChange={(e) => setForm({ ...form, pickupMessage: e.target.value })}
                  />
                  <p className="mt-1 text-xs text-zinc-400">Mensagem exibida ao cliente ao finalizar um pedido de retirada</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Mensagem de Entrega</label>
                  <Textarea
                    placeholder="Obrigado pelo seu pedido!"
                    value={form.deliveryMessage}
                    onChange={(e) => setForm({ ...form, deliveryMessage: e.target.value })}
                  />
                  <p className="mt-1 text-xs text-zinc-400">Mensagem exibida ao cliente ao finalizar um pedido de entrega</p>
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
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div>
                    Publicado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
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
                      className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
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
                      className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
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
                      className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
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
                      className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
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
              <Input
                placeholder="Ex: Bebidas, Sobremesas..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                autoFocus
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto">
          <Card className="w-full max-w-lg my-8">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {editingProduct ? "Editar Produto" : "Novo Produto"}
                </h3>
                <button onClick={() => { setShowProductForm(false); setEditingProduct(null) }}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <Input
                  label="Nome"
                  placeholder="Ex: Pizza Calabresa"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                />
                <Textarea
                  label="Descrição"
                  placeholder="Ex: Molho, mussarela, calabresa..."
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                />
                <Input
                  label="Preço"
                  type="number"
                  step="0.01"
                  placeholder="29.90"
                  value={productForm.price}
                  onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                />

                {/* Image */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    <ImageIcon className="mr-1 inline h-3 w-3" />
                    Imagem do Produto
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-600 hover:bg-zinc-50 hover:border-green-400 transition-colors">
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
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">Ou cole a URL da imagem abaixo</p>
                  <Input
                    placeholder="https://exemplo.com/foto.jpg"
                    value={productForm.image.startsWith("data:") ? "" : productForm.image}
                    onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
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

                {/* Badge */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Destaque</label>
                  <div className="flex flex-wrap gap-2">
                    {BADGE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setProductForm({ ...productForm, badge: opt.value })}
                        className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                          productForm.badge === opt.value
                            ? "border-green-500 bg-green-50 text-green-700"
                            : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                        }`}
                      >
                        {opt.icon && <opt.icon className="mr-1 inline h-3 w-3" />}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stock Item Link (direct sale) */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Vincular ao Estoque (venda direta)
                  </label>
                  <select
                    value={productForm.stockItemId}
                    onChange={(e) => setProductForm({ ...productForm, stockItemId: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 focus:border-green-500 focus:outline-none"
                  >
                    <option value="">Nenhum (sem controle de estoque)</option>
                    {stockItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.quantity} {item.unit} disponível)
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-zinc-400">
                    Selecione um item do estoque para debitar automaticamente ao vender
                  </p>
                </div>

                {/* BOM Links */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Vincular Insumos (receita)
                  </label>
                  {stockItems.length === 0 ? (
                    <p className="text-xs text-zinc-400">Cadastre insumos no estoque primeiro</p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {stockItems.map((item) => {
                        const link = productLinks.find((l) => l.stockItemId === item.id)
                        return (
                          <div key={item.id} className="flex items-center gap-2">
                            <label className="flex items-center gap-2 flex-1 text-sm text-zinc-700">
                              <input
                                type="checkbox"
                                checked={!!link}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setProductLinks([...productLinks, { stockItemId: item.id, quantity: "1" }])
                                  } else {
                                    setProductLinks(productLinks.filter((l) => l.stockItemId !== item.id))
                                  }
                                }}
                                className="rounded"
                              />
                              {item.name}
                            </label>
                            {link && (
                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={link.quantity}
                                onChange={(e) =>
                                  setProductLinks(
                                    productLinks.map((l) =>
                                      l.stockItemId === item.id ? { ...l, quantity: e.target.value } : l
                                    )
                                  )
                                }
                                className="w-20"
                                placeholder="Qtd"
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => { setShowProductForm(false); setEditingProduct(null) }}
                  >
                    Cancelar
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
    </div>
  )
}
