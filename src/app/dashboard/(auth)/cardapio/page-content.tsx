"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Plus, Pencil, Trash2, UtensilsCrossed, X, GripVertical, Star, Sparkles, Image as ImageIcon, Upload, Eye, Save, Loader2, Palette, Clock, ExternalLink, Percent, AlertTriangle, ArrowUp, ArrowDown, Search, Tag, DollarSign, Download } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { IfoodCatalogWizard } from "@/components/ifood-catalog-wizard"


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
  onSale: boolean
  order: number
  badge: string | null
  categoryId: string
}

interface Category {
  id: string
  name: string
  order: number
  products: Product[]
  targetMarginPercent?: number | null
  priceRounding?: string | null
}

const BADGE_OPTIONS = [
  { value: "", label: "Nenhum", icon: null },
  { value: "mais_vendido", label: "Mais Vendido", icon: Star, color: "text-amber-500 bg-amber-500/10" },
  { value: "novo", label: "Novo", icon: Sparkles, color: "text-blue-500 bg-green-600/10" },
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

type Tab = "produtos" | "destaques" | "aparencia" | "cores" | "preparo" | "promocao"

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
  const [priceUpdateModal, setPriceUpdateModal] = useState<{ open: boolean; category: any | null; products: any[]; rounding: string }>({ open: false, category: null, products: [], rounding: "none" })
  const [productTab, setProductTab] = useState<"basico" | "onde" | "ficha" | "adicionais">("basico")
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
    sendToPrep: false,
    onSale: false,
    promoPrice: "",
    featured: false,
    featuredDiscountPrice: "",
    availableOnline: true,
    availablePresencial: true,
    availableWhatsapp: true,
  })
  const [stockItems, setStockItems] = useState<any[]>([])
  const [productLinks, setProductLinks] = useState<{ stockItemId: string; quantity: string; unit: string }[]>([])
  const [promoModal, setPromoModal] = useState<{ open: boolean; productId: string; productName: string; currentPrice: number; currentOnSale: boolean; currentPromoPrice: number | null }>({
    open: false, productId: "", productName: "", currentPrice: 0, currentOnSale: false, currentPromoPrice: null
  })
  const [promoForm, setPromoForm] = useState({ adjustPrice: false, promoPrice: "" })
  const [featuredModal, setFeaturedModal] = useState<{ open: boolean; productId: string; productName: string; currentPrice: number; currentFeatured: boolean; currentBadge: string; currentDiscountPrice: number | null }>({
    open: false, productId: "", productName: "", currentPrice: 0, currentFeatured: false, currentBadge: "", currentDiscountPrice: null
  })
  const [featuredForm, setFeaturedForm] = useState({ badge: "", adjustPrice: false, discountPrice: "" })
  const [productAdditionalOptions, setProductAdditionalOptions] = useState<{ id?: string; name: string; price: string; selectionType: string; inputType: string; groupName: string; headerText: string; maxSelection: string; consumesStock: boolean; stockProductId: string; stockQuantity: string }[]>([])
  const [showIfoodWizard, setShowIfoodWizard] = useState(false)

  // Stories state
  const [stories, setStories] = useState<any[]>([])
  const [autoStories, setAutoStories] = useState<any[]>([])
  const [editingStory, setEditingStory] = useState<any>(null)
  const [showStoryForm, setShowStoryForm] = useState(false)
  const [storyForm, setStoryForm] = useState({ name: "", emoji: "🔥", gradientFrom: "from-red-500", gradientTo: "to-orange-500", type: "manual" as "auto" | "manual", autoType: "" })
  const [savingStory, setSavingStory] = useState(false)
  const [allProducts, setAllProducts] = useState<{ id: string; name: string; price: number; image: string | null }[]>([])
  const [productSearch, setProductSearch] = useState("")
  const [deleteStoryConfirm, setDeleteStoryConfirm] = useState<string | null>(null)

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
    return margin >= 1 ? null : fichaTecnicaCost / (1 - margin)
  }, [fichaTecnicaCost, productForm.categoryId, categories])

  // CMV por produto (para exibir nos cards)
  function computeProductCMV(product: any): number {
    const links = product.stockLinks || []
    if (links.length === 0) return 0
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
    return cost
  }

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
  const [conflictConfirm, setConflictConfirm] = useState<{ open: boolean; type: "promo-to-featured" | "featured-to-promo" | "on-sale-confirm" | "featured-confirm"; productName: string; productId: string; callback: () => void; editCallback?: () => void } | null>(null)
  const [marginCatId, setMarginCatId] = useState<string | null>(null)

  // Preview state
  const [showPreview, setShowPreview] = useState(false)
  const [previewMaximized, setPreviewMaximized] = useState(false)
  const previewIframeRef = useRef<HTMLIFrameElement>(null)
  const previewIframeMobileRef = useRef<HTMLIFrameElement>(null)
  const [previewKey, setPreviewKey] = useState(0)
  const refreshPreview = () => setPreviewKey((k) => k + 1)
  const [previewPos, setPreviewPos] = useState({ x: -1, y: -1 })
  const dragRef = useRef({ dragging: false, offsetX: 0, offsetY: 0 })
  const previewContainerRef = useRef<HTMLDivElement>(null)

  // Drag handlers for phone preview
  function handleDragStart(e: React.MouseEvent) {
    e.preventDefault()
    const el = previewContainerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    dragRef.current = { dragging: true, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top }
    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current.dragging) return
      setPreviewPos({ x: ev.clientX - dragRef.current.offsetX, y: ev.clientY - dragRef.current.offsetY })
    }
    const handleUp = () => {
      dragRef.current.dragging = false
      document.removeEventListener("mousemove", handleMove)
      document.removeEventListener("mouseup", handleUp)
    }
    document.addEventListener("mousemove", handleMove)
    document.addEventListener("mouseup", handleUp)
  }

  function getPreviewStyle(): React.CSSProperties {
    if (previewMaximized) return { inset: "16px" }
    if (previewPos.x >= 0 && previewPos.y >= 0) {
      return { left: previewPos.x, top: previewPos.y, bottom: "auto", right: "auto" }
    }
    return { bottom: "24px", right: "24px" }
  }

  const [marginCatPercent, setMarginCatPercent] = useState("")
  const [marginCatRounding, setMarginCatRounding] = useState("none")
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
    }
    setLoading(false)
  }

  async function loadStoriesData() {
    if (!establishmentId) return
    try {
      const res = await fetchAuth(`/api/admin/stories?establishmentId=${establishmentId}`)
      if (res.ok) {
        const data = await res.json()
        setStories(data.filter((s: any) => s.type === "manual"))
        setAutoStories(data.filter((s: any) => s.type === "auto"))
      }
    } catch {}
    try {
      const res = await fetchAuth(`/api/categories?establishmentId=${establishmentId}`)
      if (res.ok) {
        const cats = await res.json()
        setAllProducts(cats.flatMap((c: any) => c.products || []))
      }
    } catch {}
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
    refreshPreview()
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
    refreshPreview()
  }

  async function saveMarginCategory() {
    if (!marginCatId) return
    setSavingMarginCat(true)
    await fetchAuth(`/api/categories/${marginCatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetMarginPercent: marginCatPercent ? Number(marginCatPercent) : null,
        priceRounding: marginCatRounding,
      }),
    })
    setMarginCatId(null)
    setSavingMarginCat(false)
    toast("Margem salva", "success")
    loadData()
    refreshPreview()
  }

  async function updateCategoryPrices(category: any) {
    if (!category.targetMarginPercent) return

    const links = category.products.flatMap((p: any) => (p.stockLinks || []).map((l: any) => ({ ...l, productName: p.name, productId: p.id })))
    if (links.length === 0) {
      toast("Nenhum insumo vinculado nesta categoria", "error")
      return
    }

    const updates: { productId: string; productName: string; oldPrice: number; newPrice: number }[] = []

    for (const product of category.products) {
      const productLinks = (product as any).stockLinks || []
      if (productLinks.length === 0) continue

      let cost = 0
      for (const link of productLinks) {
        const item = stockItems.find((s: any) => s.id === link.stockItemId)
        if (!item) continue
        const qty = Number(link.quantity) || 0
        const linkUnit = link.unit || "un"
        const stockUnit = item.unit || "un"
        const converted = convertQuantity(qty, linkUnit, stockUnit)
        if (converted === null) continue
        cost += converted * (item.unitCost || 0)
      }

      if (cost <= 0) continue

      const margin = category.targetMarginPercent / 100
      if (margin >= 1) continue

      const suggested = cost / (1 - margin)

      if (Math.abs(suggested - product.price) > 0.01) {
        updates.push({ productId: product.id, productName: product.name, oldPrice: product.price, newPrice: suggested })
      }
    }

    if (updates.length === 0) {
      toast("Todos os preços já estão atualizados", "info")
      return
    }

    setPriceUpdateModal({ open: true, category, products: updates, rounding: category.priceRounding || "none" })
  }

  async function confirmPriceUpdate() {
    if (!priceUpdateModal.category) return

    const res = await fetchAuth("/api/products/update-prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: priceUpdateModal.category.id, rounding: priceUpdateModal.rounding }),
    })

    if (res.ok) {
      const data = await res.json()
      toast(`${data.updated} preço(s) atualizado(s)`, "success")
      setPriceUpdateModal({ open: false, category: null, products: [], rounding: "none" })
      loadData()
    } else {
      toast("Erro ao atualizar preços", "error")
    }
  }

  function getRoundedPrice(price: number, method: string): number {
    if (method === "integer") {
      return Math.round(price)
    }
    if (method === "point90") {
      const floor = Math.floor(price)
      return (price - floor <= 0.9) ? floor + 0.9 : floor + 1.9
    }
    return Math.round(price * 100) / 100
  }

  function getCategorySuggestedPrice(category: any, cost: number): number | null {
    const m = category.targetMarginPercent
    if (!m || cost <= 0) return null
    const margin = m / 100
    return margin >= 1 ? null : cost / (1 - margin)
  }

  function hasCostAlert(product: any): boolean {
    const links = product.stockLinks || []
    for (const link of links) {
      const item = stockItems.find((s: any) => s.id === link.stockItemId)
      if (item && item.previousUnitCost != null && Math.abs(item.unitCost - item.previousUnitCost) > 0.01) {
        return true
      }
    }
    return false
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
    refreshPreview()
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
    const firstLink = productLinks.find((l) => l.stockItemId && parseFloat(l.quantity) > 0)
    if (firstLink) formData.append("stockItemId", firstLink.stockItemId)
    formData.append("sendToPrep", String(productForm.sendToPrep))
    formData.append("onSale", String(productForm.onSale))
    if (productForm.onSale && productForm.promoPrice) {
      formData.append("promoPrice", productForm.promoPrice)
    } else if (!productForm.onSale) {
      formData.append("promoPrice", "null")
    }
    formData.append("featured", String(productForm.featured))
    if (productForm.featured && productForm.featuredDiscountPrice) {
      formData.append("featuredDiscountPrice", productForm.featuredDiscountPrice)
    } else if (!productForm.featured) {
      formData.append("featuredDiscountPrice", "null")
    }
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
            stockItemId: productLinks.find((l) => l.stockItemId && parseFloat(l.quantity) > 0)?.stockItemId || null,
            sendToPrep: productForm.sendToPrep,
            availableOnline: productForm.availableOnline,
            availablePresencial: productForm.availablePresencial,
            availableWhatsapp: productForm.availableWhatsapp,
            establishmentId,
            categoryId: productForm.categoryId,
            order: maxOrder,
            onSale: productForm.onSale,
            promoPrice: productForm.onSale && productForm.promoPrice ? productForm.promoPrice : null,
            featured: productForm.featured,
            featuredDiscountPrice: productForm.featured && productForm.featuredDiscountPrice ? productForm.featuredDiscountPrice : null,
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

      // Salvar adicionais
      try {
        // Deletar adicionais existentes
        const existingOptions = await fetchAuth(`/api/additional-options?productId=${productId}`)
        if (existingOptions.ok) {
          const existing = await existingOptions.json()
          for (const opt of existing) {
            await fetchAuth(`/api/additional-options?id=${opt.id}`, { method: "DELETE" })
          }
        }
        // Criar novos adicionais
        for (const opt of productAdditionalOptions) {
          if (!opt.name.trim()) continue
          await fetchAuth("/api/additional-options", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: opt.name,
              price: parseFloat(opt.price) || 0,
              selectionType: opt.selectionType,
              inputType: opt.inputType,
              groupName: opt.groupName || null,
              headerText: opt.headerText || null,
              maxSelection: opt.maxSelection ? parseInt(opt.maxSelection) : null,
              consumesStock: opt.consumesStock || false,
              stockProductId: opt.stockProductId || null,
              stockQuantity: parseFloat(opt.stockQuantity) || 1,
              productId,
              establishmentId,
            }),
          })
        }
      } catch (e) {
        console.error("Erro ao salvar adicionais:", e)
      }
    }

    toast("Produto salvo com sucesso!", "success")
    refreshPreview()
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

  async function toggleOnSale(productId: string, currentValue: boolean) {
    if (!establishmentId) return
    const product = categories.flatMap(c => c.products).find(p => p.id === productId)
    if (!product) return

    if (!currentValue) {
      // Activating promo — check if featured is active
      if ((product as any).featured) {
        setConflictConfirm({
          open: true,
          type: "promo-to-featured",
          productName: product.name,
          productId,
          callback: async () => {
            // User chose to deactivate featured and activate promo
            await fetchAuth(`/api/products/${productId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ onSale: true, featured: false, badge: null, featuredDiscountPrice: null }),
            })
            setCategories((prev) =>
              prev.map((cat) => ({
                ...cat,
                products: cat.products.map((p) =>
                  p.id === productId ? { ...p, onSale: true, featured: false, badge: null, featuredDiscountPrice: null } : p
                ),
              }))
            )
            toast("Promoção ativada, destaque removido", "success")
            refreshPreview()
          },
        })
        return
      }
      // No conflict — activate directly
      try {
        const res = await fetchAuth(`/api/products/${productId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ onSale: true }),
        })
        if (!res.ok) { const err = await res.json(); toast(err.error || "Erro", "error"); return }
        setCategories((prev) =>
          prev.map((cat) => ({
            ...cat,
            products: cat.products.map((p) =>
              p.id === productId ? { ...p, onSale: true } : p
            ),
          }))
        )
        toast("Promoção ativada", "success")
        refreshPreview()
      } catch { toast("Erro ao atualizar", "error") }
      return
    }

    // Already active — ask: deactivate or edit?
    setConflictConfirm({
      open: true,
      type: "on-sale-confirm",
      productName: product.name,
      productId,
      callback: async () => {
        // User chose deactivate
        const res = await fetchAuth(`/api/products/${productId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ onSale: false, promoPrice: null }),
        })
        if (res.ok) {
          setCategories((prev) =>
            prev.map((cat) => ({
              ...cat,
              products: cat.products.map((p) =>
                p.id === productId ? { ...p, onSale: false, promoPrice: null } : p
              ),
            }))
          )
          toast("Promoção desativada", "success")
          refreshPreview()
        }
      },
      editCallback: () => {
        if (product) editProduct(product)
      },
    })
  }

  function openPromoModal(product: any) {
    const isActive = (product as any).onSale || false
    const currentPromo = (product as any).promoPrice || null
    const isFeatured = (product as any).featured || false

    // Conflict: featured is active, warn user
    if (!isActive && isFeatured) {
      setConflictConfirm({
        open: true,
        type: "promo-to-featured",
        productName: product.name,
        productId: product.id,
        callback: () => {
          // User confirmed — open promo modal after deactivating featured
          setPromoModal({
            open: true,
            productId: product.id,
            productName: product.name,
            currentPrice: product.price,
            currentOnSale: false,
            currentPromoPrice: null,
          })
          setPromoForm({ adjustPrice: false, promoPrice: "" })
        },
      })
      return
    }

    setPromoModal({
      open: true,
      productId: product.id,
      productName: product.name,
      currentPrice: product.price,
      currentOnSale: isActive,
      currentPromoPrice: currentPromo,
    })
    setPromoForm({
      adjustPrice: isActive && currentPromo ? true : false,
      promoPrice: isActive && currentPromo ? String(currentPromo) : "",
    })
  }

  async function confirmPromoActivation() {
    const { productId } = promoModal
    const data: any = { onSale: true }
    if (promoForm.adjustPrice && promoForm.promoPrice) {
      data.promoPrice = parseFloat(promoForm.promoPrice)
    }
    try {
      const res = await fetchAuth(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        toast(err.error || "Erro ao atualizar produto", "error")
        return
      }
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          products: cat.products.map((p) =>
            p.id === productId ? { ...p, onSale: true, promoPrice: data.promoPrice || null } : p
          ),
        }))
      )
      setPromoModal({ ...promoModal, open: false })
      toast("Produto em promoção!", "success")
      refreshPreview()
    } catch (err) {
      toast("Erro ao atualizar produto", "error")
    }
  }

  async function confirmPromoDeactivation() {
    const { productId } = promoModal
    try {
      const res = await fetchAuth(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onSale: false, promoPrice: null }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast(err.error || "Erro ao atualizar produto", "error")
        return
      }
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          products: cat.products.map((p) =>
            p.id === productId ? { ...p, onSale: false, promoPrice: null } : p
          ),
        }))
      )
      setPromoModal({ ...promoModal, open: false })
      toast("Promoção desativada", "success")
      refreshPreview()
    } catch (err) {
      toast("Erro ao atualizar produto", "error")
    }
  }

  async function toggleFeatured(productId: string, currentValue: boolean) {
    if (!establishmentId) return
    const product = categories.flatMap(c => c.products).find(p => p.id === productId)
    if (!product) return

    if (!currentValue) {
      // Activating featured — check if promo is active
      if ((product as any).onSale) {
        setConflictConfirm({
          open: true,
          type: "featured-to-promo",
          productName: product.name,
          productId,
          callback: async () => {
            // User chose to deactivate promo and activate featured
            await fetchAuth(`/api/products/${productId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ featured: true, onSale: false, promoPrice: null }),
            })
            setCategories((prev) =>
              prev.map((cat) => ({
                ...cat,
                products: cat.products.map((p) =>
                  p.id === productId ? { ...p, featured: true, onSale: false, promoPrice: null } : p
                ),
              }))
            )
            toast("Destaque ativado, promoção removida", "success")
            refreshPreview()
          },
        })
        return
      }
      // No conflict — activate directly
      try {
        const res = await fetchAuth(`/api/products/${productId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ featured: true }),
        })
        if (!res.ok) { const err = await res.json(); toast(err.error || "Erro", "error"); return }
        setCategories((prev) =>
          prev.map((cat) => ({
            ...cat,
            products: cat.products.map((p) =>
              p.id === productId ? { ...p, featured: true } : p
            ),
          }))
        )
        toast("Destaque ativado", "success")
        refreshPreview()
      } catch { toast("Erro ao atualizar", "error") }
      return
    }

    // Already active — ask: deactivate or edit?
    setConflictConfirm({
      open: true,
      type: "featured-confirm",
      productName: product.name,
      productId,
      callback: async () => {
        // User chose deactivate
        const res = await fetchAuth(`/api/products/${productId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ featured: false, badge: null, featuredDiscountPrice: null }),
        })
        if (res.ok) {
          setCategories((prev) =>
            prev.map((cat) => ({
              ...cat,
              products: cat.products.map((p) =>
                p.id === productId ? { ...p, featured: false, badge: null, featuredDiscountPrice: null } : p
              ),
            }))
          )
          toast("Destaque desativado", "success")
          refreshPreview()
        }
      },
      editCallback: () => {
        if (product) editProduct(product)
      },
    })
  }

  function openFeaturedModal(product: any) {
    const isActive = (product as any).featured || false
    const currentBadge = (product as any).badge || ""
    const currentDiscount = (product as any).featuredDiscountPrice || null
    const isOnSale = (product as any).onSale || false

    // Conflict: promo is active, warn user
    if (!isActive && isOnSale) {
      setConflictConfirm({
        open: true,
        type: "featured-to-promo",
        productName: product.name,
        productId: product.id,
        callback: () => {
          // User confirmed — open featured modal after deactivating promo
          setFeaturedModal({
            open: true,
            productId: product.id,
            productName: product.name,
            currentPrice: product.price,
            currentFeatured: false,
            currentBadge: "",
            currentDiscountPrice: null,
          })
          setFeaturedForm({ badge: "TOP", adjustPrice: false, discountPrice: "" })
        },
      })
      return
    }

    setFeaturedModal({
      open: true,
      productId: product.id,
      productName: product.name,
      currentPrice: product.price,
      currentFeatured: isActive,
      currentBadge,
      currentDiscountPrice: currentDiscount,
    })
    setFeaturedForm({
      badge: currentBadge || "TOP",
      adjustPrice: isActive && currentDiscount ? true : false,
      discountPrice: isActive && currentDiscount ? String(currentDiscount) : "",
    })
  }

  async function confirmConflict() {
    if (!conflictConfirm) return
    const { productId, type, callback } = conflictConfirm

    if (type === "promo-to-featured") {
      // Deactivate featured first, then open promo modal
      await fetchAuth(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: false, badge: null, featuredDiscountPrice: null }),
      })
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          products: cat.products.map((p) =>
            p.id === productId ? { ...p, featured: false, badge: null, featuredDiscountPrice: null } : p
          ),
        }))
      )
      toast("Destaque desativado", "info")
      refreshPreview()
      callback()
    } else if (type === "featured-to-promo") {
      // Deactivate promo first, then open featured modal
      await fetchAuth(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onSale: false, promoPrice: null }),
      })
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          products: cat.products.map((p) =>
            p.id === productId ? { ...p, onSale: false, promoPrice: null } : p
          ),
        }))
      )
      toast("Promoção desativada", "info")
      refreshPreview()
      callback()
    } else if (type === "on-sale-confirm") {
      await callback()
    } else if (type === "featured-confirm") {
      await callback()
    }

    setConflictConfirm(null)
  }

  function conflictEditProduct() {
    if (!conflictConfirm) return
    const { productId, editCallback } = conflictConfirm
    if (editCallback) {
      editCallback()
    } else {
      const product = categories.flatMap(c => c.products).find(p => p.id === productId)
      if (product) editProduct(product)
    }
    setConflictConfirm(null)
  }

  async function confirmFeaturedActivation() {
    const { productId } = featuredModal
    const data: any = { featured: true, badge: featuredForm.badge || "TOP" }
    if (featuredForm.adjustPrice && featuredForm.discountPrice) {
      data.featuredDiscountPrice = parseFloat(featuredForm.discountPrice)
    }
    try {
      const res = await fetchAuth(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        toast(err.error || "Erro ao atualizar produto", "error")
        return
      }
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          products: cat.products.map((p) =>
            p.id === productId ? { ...p, featured: true, badge: data.badge, featuredDiscountPrice: data.featuredDiscountPrice || null } : p
          ),
        }))
      )
      setFeaturedModal({ ...featuredModal, open: false })
      toast("Produto em destaque!", "success")
      refreshPreview()
    } catch (err) {
      toast("Erro ao atualizar produto", "error")
    }
  }

  async function confirmFeaturedDeactivation() {
    const { productId } = featuredModal
    try {
      const res = await fetchAuth(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: false, badge: null, featuredDiscountPrice: null }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast(err.error || "Erro ao atualizar produto", "error")
        return
      }
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          products: cat.products.map((p) =>
            p.id === productId ? { ...p, featured: false, badge: null, featuredDiscountPrice: null } : p
          ),
        }))
      )
      setFeaturedModal({ ...featuredModal, open: false })
      toast("Destaque desativado", "success")
      refreshPreview()
    } catch (err) {
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
      sendToPrep: product.sendToPrep || false,
      onSale: (product as any).onSale ?? false,
      promoPrice: (product as any).promoPrice ? String((product as any).promoPrice) : "",
      featured: (product as any).featured ?? false,
      featuredDiscountPrice: (product as any).featuredDiscountPrice ? String((product as any).featuredDiscountPrice) : "",
      availableOnline: (product as any).availableOnline ?? true,
      availablePresencial: (product as any).availablePresencial ?? true,
      availableWhatsapp: (product as any).availableWhatsapp ?? true,
    })
    const links = (product as any).stockLinks || []
    setProductLinks(links.map((l: any) => ({ stockItemId: l.stockItemId, quantity: String(l.quantity), unit: l.unit || "un" })))
    setProductAdditionalOptions([])
    setProductTab("basico")
    setShowProductForm(true)
    // Refetch em background pra atualizar stockLinks e adicionais (cache: no-store evita o cache de 30s)
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
        // Carregar adicionais
        fetchAuth(`/api/additional-options?productId=${product.id}`)
          .then((r) => r.ok ? r.json() : [])
          .then((options) => {
            setProductAdditionalOptions(options.map((opt: any) => ({
              id: opt.id,
              name: opt.name,
              price: String(opt.price),
              selectionType: opt.selectionType,
              inputType: opt.inputType || "radio",
              groupName: opt.groupName || "",
              headerText: opt.headerText || "",
              maxSelection: opt.maxSelection ? String(opt.maxSelection) : "",
              consumesStock: opt.consumesStock || false,
              stockProductId: opt.stockProductId || "",
              stockQuantity: opt.stockQuantity ? String(opt.stockQuantity) : "1",
            })))
          })
          .catch(() => {})
      })
      .catch(() => {})
  }

  function editProductOnTab(product: Product, tab: "basico" | "onde" | "ficha" | "adicionais") {
    editProduct(product)
    setProductTab(tab)
  }

  function openNewProduct(categoryId: string) {
    setEditingProduct(null)
    setProductForm({ name: "", description: "", price: "", categoryId, image: "", badge: "", sendToPrep: false, onSale: false, promoPrice: "", featured: false, featuredDiscountPrice: "", availableOnline: true, availablePresencial: true, availableWhatsapp: true })
    setProductLinks([])
    setProductAdditionalOptions([])
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

  // === STORY FUNCTIONS ===
  const STORY_EMOJI_OPTIONS = ["🔥", "🎁", "✨", "💰", "🥗", "🚫", "🍕", "🍔", "🍣", "🍰", "☕", "🍺", "🥤", "🎉", "⭐", "💝", "🌿", "💪"]
  const STORY_GRADIENT_OPTIONS = [
    { from: "from-red-500", to: "to-orange-500", label: "Vermelho/Laranja" },
    { from: "from-yellow-500", to: "to-amber-500", label: "Amarelo/Âmbar" },
    { from: "from-blue-500", to: "to-indigo-500", label: "Azul/Índigo" },
    { from: "from-purple-500", to: "to-pink-500", label: "Roxo/Rosa" },
    { from: "from-green-500", to: "to-emerald-500", label: "Verde/Emerald" },
    { from: "from-teal-500", to: "to-cyan-500", label: "Teal/Ciano" },
    { from: "from-orange-500", to: "to-red-500", label: "Laranja/Vermelho" },
    { from: "from-pink-500", to: "to-rose-500", label: "Rosa/Rose" },
  ]
  const AUTO_TYPE_OPTIONS = [
    { value: "maisVendidos", label: "Mais Vendidos", icon: "🔥" },
    { value: "lancamentos", label: "Lançamentos", icon: "✨" },
    { value: "promocoes", label: "Promoções", icon: "💰" },
  ]

  async function handleSaveStory() {
    if (!storyForm.name.trim()) { toast("Nome obrigatório", "error"); return }
    setSavingStory(true)
    try {
      const body = { name: storyForm.name, emoji: storyForm.emoji, gradientFrom: storyForm.gradientFrom, gradientTo: storyForm.gradientTo, type: storyForm.type, autoType: storyForm.type === "auto" ? storyForm.autoType : null, establishmentId }
      let res
      if (editingStory) {
        res = await fetchAuth(`/api/admin/stories/${editingStory.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      } else {
        res = await fetchAuth("/api/admin/stories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      }
      if (res.ok) {
        toast(editingStory ? "Story atualizado!" : "Story criado!", "success")
        setShowStoryForm(false); setEditingStory(null)
        setStoryForm({ name: "", emoji: "🔥", gradientFrom: "from-red-500", gradientTo: "to-orange-500", type: "manual", autoType: "" })
        loadStoriesData()
        refreshPreview()
      } else { const err = await res.json(); toast(err.error || "Erro ao salvar", "error") }
    } catch { toast("Erro ao salvar", "error") }
    setSavingStory(false)
  }

  async function handleDeleteStory(id: string) {
    try { const res = await fetchAuth(`/api/admin/stories/${id}`, { method: "DELETE" }); if (res.ok) { toast("Story removido!", "success"); loadStoriesData(); refreshPreview() } } catch { toast("Erro ao deletar", "error") }
    setDeleteStoryConfirm(null)
  }

  async function toggleStoryActive(story: any) {
    try { await fetchAuth(`/api/admin/stories/${story.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !story.active }) }); loadStoriesData() } catch {}
  }

  async function moveStoryOrder(story: any, direction: "up" | "down") {
    const allItems = [...autoStories, ...stories]
    const idx = allItems.findIndex((s) => s.id === story.id)
    if (direction === "up" && idx > 0) {
      const other = allItems[idx - 1]
      await fetchAuth(`/api/admin/stories/${story.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: other.order }) })
      await fetchAuth(`/api/admin/stories/${other.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: story.order }) })
      loadStoriesData()
    } else if (direction === "down" && idx < allItems.length - 1) {
      const other = allItems[idx + 1]
      await fetchAuth(`/api/admin/stories/${story.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: other.order }) })
      await fetchAuth(`/api/admin/stories/${other.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: story.order }) })
      loadStoriesData()
    }
  }

  async function addProductToStory(storyId: string, productId: string) {
    try { const res = await fetchAuth(`/api/admin/stories/${storyId}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId }) }); if (res.ok) loadStoriesData() } catch {}
  }

  async function removeProductFromStory(storyId: string, productId: string) {
    try { const res = await fetchAuth(`/api/admin/stories/${storyId}/items?productId=${productId}`, { method: "DELETE" }); if (res.ok) loadStoriesData() } catch {}
  }

  const filteredProducts = allProducts.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()))

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
        refreshPreview()
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
        refreshPreview()
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
          <>
            <a href={`/${establishmentSlug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm font-normal text-green-600 hover:text-green-700">
              <ExternalLink className="h-4 w-4" />
              Ver público
            </a>
            <button
              onClick={() => {
                const next = !showPreview
                setShowPreview(next)
                if (next && establishmentSlug) {
                  // Reset position when opening split view
                  setPreviewPos({ x: -1, y: -1 })
                  // Force iframe load
                  setTimeout(() => {
                    if (previewIframeRef.current) previewIframeRef.current.src = `/${establishmentSlug}`
                    if (previewIframeMobileRef.current) previewIframeMobileRef.current.src = `/${establishmentSlug}`
                  }, 50)
                }
              }}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${showPreview ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
            >
              <Eye className="h-4 w-4" />
              Preview
            </button>
          </>
        )}
      </h2>

      <div className="flex gap-6">
        {/* Left — editing */}
        <div className={`min-w-0 transition-all duration-300 ${showPreview ? "w-0 lg:w-[60%] overflow-hidden lg:overflow-visible" : "w-full"}`}>
      {/* Tabs */}
      <div className="flex gap-2 rounded-lg border border-zinc-200 bg-zinc-100 p-1">
        <button
          onClick={() => setActiveTab("produtos")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "produtos"
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-500"
          }`}
        >
          <UtensilsCrossed className="h-4 w-4" />
          Produtos
        </button>
        <button
          onClick={() => setActiveTab("preparo")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "preparo"
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-500"
          }`}
        >
          <Clock className="h-4 w-4" />
          Preparo
        </button>
        <button
          onClick={() => setActiveTab("promocao")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "promocao"
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-500"
          }`}
        >
          <Tag className="h-4 w-4" />
          Promoção
        </button>
        <button
          onClick={() => setActiveTab("destaques")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "destaques"
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-500"
          }`}
        >
          <ImageIcon className="h-4 w-4" />
          Destaques
        </button>
        <button
          onClick={() => setActiveTab("aparencia")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "aparencia"
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-500"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Aparência
        </button>
        <button
          onClick={() => setActiveTab("cores")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
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
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowIfoodWizard(true)} className="gap-2">
                <Download className="h-4 w-4" />
                Importar do iFood
              </Button>
              <Button onClick={() => setShowCategoryForm(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Nova Categoria
              </Button>
            </div>
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
                          setMarginCatRounding(cat.priceRounding || "none")
                        }}
                        className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                          cat.targetMarginPercent != null
                            ? "bg-green-50 text-green-700 hover:bg-green-100"
                            : "text-zinc-400 hover:text-zinc-600"
                        }`}
                      >
                        {cat.targetMarginPercent != null ? (
                          <>
                            <Percent className="h-3 w-3" />
                            Margem de venda {cat.targetMarginPercent}%
                          </>
                        ) : (
                          <>
                            <Percent className="h-3 w-3" />
                            Ajustar Preços
                          </>
                        )}
                      </button>
                      {cat.targetMarginPercent != null && (
                        <Button size="sm" variant="ghost" onClick={() => updateCategoryPrices(cat)} className="text-xs font-bold text-amber-600 hover:text-amber-700 hover:bg-amber-50">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Atualizar preços
                        </Button>
                      )}
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
                    <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 mb-2 space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-medium text-zinc-700">Margem de venda:</span>
                        <div className="relative">
                          <input type="number" min={0} max={100} step="0.1" placeholder="60" value={marginCatPercent} onChange={(e) => setMarginCatPercent(e.target.value)} className="h-8 w-20 rounded-lg border border-zinc-200 bg-white px-2 pr-6 text-sm focus:border-green-600 focus:outline-none" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400">%</span>
                        </div>
                        <Button size="sm" onClick={saveMarginCategory} disabled={savingMarginCat}>
                          {savingMarginCat ? "..." : "Salvar"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setMarginCatId(null)}>Cancelar</Button>
                      </div>
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
                              {hasCostAlert(product) && <Badge variant="warning">Custo alterado</Badge>}
                              {getBadgeDisplay(product.badge)}
                            </div>
                            {product.description && (
                              <p className="text-sm text-zinc-500 truncate">{product.description}</p>
                            )}
                            {(() => {
                              const cmv = computeProductCMV(product)
                              if (cmv > 0) {
                                const lucro = product.price - cmv
                                const margem = product.price > 0 ? ((lucro / product.price) * 100) : 0
                                return (
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] text-zinc-400">CMV {formatCurrency(cmv)}</span>
                                    <span className="text-[10px] text-zinc-300">•</span>
                                    <span className={`text-[10px] font-medium ${margem >= 0 ? "text-green-600" : "text-red-500"}`}>
                                      {margem.toFixed(0)}% lucro
                                    </span>
                                  </div>
                                )
                              }
                              return null
                            })()}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-green-600">
                              {formatCurrency(product.price)}
                            </span>
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
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); openPromoModal(product) }}
                              className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors shrink-0 ${
                                (product as any).onSale
                                  ? "bg-green-100 text-green-700"
                                  : "bg-zinc-100 text-zinc-400"
                              }`}
                              title={(product as any).onSale ? "Em promoção (clique para editar)" : "Marcar como promoção"}
                            >
                              <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                                (product as any).onSale ? "bg-green-500" : "bg-zinc-300"
                              }`}>
                                <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${
                                  (product as any).onSale ? "translate-x-3.5" : "translate-x-0.5"
                                }`} />
                              </span>
                              {(product as any).onSale ? "Promoção" : "Sem promoção"}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); openFeaturedModal(product) }}
                              className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors shrink-0 ${
                                (product as any).featured
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-zinc-100 text-zinc-400"
                              }`}
                              title={(product as any).featured ? "Em destaque (clique para editar)" : "Marcar como destaque"}
                            >
                              <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                                (product as any).featured ? "bg-amber-500" : "bg-zinc-300"
                              }`}>
                                <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${
                                  (product as any).featured ? "translate-x-3.5" : "translate-x-0.5"
                                }`} />
                              </span>
                              {(product as any).featured ? "Destaque" : "Sem destaque"}
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

      {/* Preparo Tab */}
      {activeTab === "preparo" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">Produtos que possuem tempo de preparo configurado</p>
          </div>
          {categories.filter(c => c.products.some(p => p.sendToPrep)).length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 p-12 text-center">
              <Clock className="mx-auto h-8 w-8 text-zinc-400" />
              <p className="mt-2 text-sm text-zinc-500">Nenhum produto com preparo configurado</p>
              <p className="text-xs text-zinc-400 mt-1">Ative "Enviar para preparo" nos produtos</p>
            </div>
          ) : (
            categories.filter(c => c.products.some(p => p.sendToPrep)).map(cat => (
              <div key={cat.id} className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200">
                  <h3 className="font-semibold text-zinc-800">{cat.name}</h3>
                </div>
                <div className="divide-y divide-zinc-100">
                  {cat.products.filter(p => p.sendToPrep).map((product: any) => (
                    <div key={product.id} className="flex items-center gap-3 px-4 py-3">
                      {product.image ? (
                        <img src={product.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-zinc-100 flex items-center justify-center">
                          <UtensilsCrossed className="h-4 w-4 text-zinc-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-800 truncate">{product.name}</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-zinc-500">{formatCurrency(product.price)}</span>
                          {(() => {
                            const cmv = computeProductCMV(product)
                            if (cmv > 0) {
                              const margem = product.price > 0 ? (((product.price - cmv) / product.price) * 100) : 0
                              return (
                                <span className={`text-[10px] font-medium ${margem >= 0 ? "text-green-600" : "text-red-500"}`}>
                                  CMV {formatCurrency(cmv)} ({margem.toFixed(0)}%)
                                </span>
                              )
                            }
                            return null
                          })()}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleSendToPrep(product.id, product.sendToPrep)}
                        className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors shrink-0 ${
                          product.sendToPrep
                            ? "bg-orange-100 text-orange-700"
                            : "bg-zinc-100 text-zinc-400"
                        }`}
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
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Promoção Tab */}
      {activeTab === "promocao" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">Produtos com promoção ativa</p>
          </div>
          {categories.filter(c => c.products.some(p => p.onSale)).length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 p-12 text-center">
              <Tag className="mx-auto h-8 w-8 text-zinc-400" />
              <p className="mt-2 text-sm text-zinc-500">Nenhum produto em promoção</p>
              <p className="text-xs text-zinc-400 mt-1">Ative "Promoção" nos produtos</p>
            </div>
          ) : (
            categories.filter(c => c.products.some(p => p.onSale)).map(cat => (
              <div key={cat.id} className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200">
                  <h3 className="font-semibold text-zinc-800">{cat.name}</h3>
                </div>
                <div className="divide-y divide-zinc-100">
                  {cat.products.filter(p => p.onSale).map((product: any) => (
                    <div key={product.id} className="flex items-center gap-3 px-4 py-3">
                      {product.image ? (
                        <img src={product.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-zinc-100 flex items-center justify-center">
                          <UtensilsCrossed className="h-4 w-4 text-zinc-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-800 truncate">{product.name}</p>
                        <div className="flex items-center gap-2">
                          {product.promoPrice ? (
                            <>
                              <span className="text-xs text-zinc-400 line-through">{formatCurrency(product.price)}</span>
                              <span className="text-sm font-bold text-green-600">{formatCurrency(product.promoPrice)}</span>
                            </>
                          ) : (
                            <span className="text-sm font-bold text-green-600">{formatCurrency(product.price)}</span>
                          )}
                        </div>
                        {(() => {
                          const cmv = computeProductCMV(product)
                          if (cmv > 0) {
                            const finalPrice = product.promoPrice || product.price
                            const margem = finalPrice > 0 ? (((finalPrice - cmv) / finalPrice) * 100) : 0
                            return (
                              <div className="flex items-center gap-1 mt-0.5">
                                <DollarSign className="h-3 w-3 text-zinc-400" />
                                <span className="text-[10px] text-zinc-400">CMV {formatCurrency(cmv)}</span>
                                <span className="text-[10px] text-zinc-300">|</span>
                                <span className={`text-[10px] font-medium ${margem >= 0 ? "text-green-600" : "text-red-500"}`}>
                                  {margem.toFixed(0)}%
                                </span>
                              </div>
                            )
                          }
                          return null
                        })()}
                      </div>
                      <button
                        type="button"
                        onClick={() => openPromoModal(product)}
                        className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors shrink-0 ${
                          (product as any).onSale
                            ? "bg-green-100 text-green-700"
                            : "bg-zinc-100 text-zinc-400"
                        }`}
                      >
                        <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                          (product as any).onSale ? "bg-green-500" : "bg-zinc-300"
                        }`}>
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${
                            (product as any).onSale ? "translate-x-3.5" : "translate-x-0.5"
                          }`} />
                        </span>
                        {(product as any).onSale ? "Promoção" : "Sem promoção"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Destaques Tab */}
      {activeTab === "destaques" && (
        <div className="space-y-4">
          {/* Produtos em Destaque */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">Produtos em destaque no cardápio</p>
          </div>
          {categories.filter(c => c.products.some(p => (p as any).featured)).length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 p-12 text-center">
              <Star className="mx-auto h-8 w-8 text-zinc-400" />
              <p className="mt-2 text-sm text-zinc-500">Nenhum produto em destaque</p>
              <p className="text-xs text-zinc-400 mt-1">Ative "Destaque" nos produtos</p>
            </div>
          ) : (
            categories.filter(c => c.products.some(p => (p as any).featured)).map(cat => (
              <div key={cat.id} className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200">
                  <h3 className="font-semibold text-zinc-800">{cat.name}</h3>
                </div>
                <div className="divide-y divide-zinc-100">
                  {cat.products.filter(p => (p as any).featured).map((product: any) => (
                    <div key={product.id} className="flex items-center gap-3 px-4 py-3">
                      {product.image ? (
                        <img src={product.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-zinc-100 flex items-center justify-center">
                          <UtensilsCrossed className="h-4 w-4 text-zinc-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-800 truncate">{product.name}</p>
                        <div className="flex items-center gap-2">
                          {product.featuredDiscountPrice ? (
                            <>
                              <span className="text-xs text-zinc-400 line-through">{formatCurrency(product.price)}</span>
                              <span className="text-sm font-bold text-amber-600">{formatCurrency(product.featuredDiscountPrice)}</span>
                            </>
                          ) : (
                            <span className="text-sm font-bold text-amber-600">{formatCurrency(product.price)}</span>
                          )}
                          {product.badge && (
                            <span className="text-[10px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded">{product.badge}</span>
                          )}
                        </div>
                        {(() => {
                          const cmv = computeProductCMV(product)
                          if (cmv > 0) {
                            const finalPrice = product.featuredDiscountPrice || product.price
                            const margem = finalPrice > 0 ? (((finalPrice - cmv) / finalPrice) * 100) : 0
                            return (
                              <div className="flex items-center gap-1 mt-0.5">
                                <DollarSign className="h-3 w-3 text-zinc-400" />
                                <span className="text-[10px] text-zinc-400">CMV {formatCurrency(cmv)}</span>
                                <span className="text-[10px] text-zinc-300">|</span>
                                <span className={`text-[10px] font-medium ${margem >= 0 ? "text-green-600" : "text-red-500"}`}>
                                  {margem.toFixed(0)}%
                                </span>
                              </div>
                            )
                          }
                          return null
                        })()}
                      </div>
                      <button
                        type="button"
                        onClick={() => openFeaturedModal(product)}
                        className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors shrink-0 ${
                          (product as any).featured
                            ? "bg-amber-100 text-amber-700"
                            : "bg-zinc-100 text-zinc-400"
                        }`}
                      >
                        <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                          (product as any).featured ? "bg-amber-500" : "bg-zinc-300"
                        }`}>
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${
                            (product as any).featured ? "translate-x-3.5" : "translate-x-0.5"
                          }`} />
                        </span>
                        {(product as any).featured ? "Destaque" : "Sem destaque"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
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

      </div>{/* close left editing column */}

      {/* Right — preview (desktop split view) */}
      {showPreview && establishmentSlug && (
        <div className="hidden lg:flex flex-col items-center w-[40%] sticky top-20 self-start max-h-[calc(100vh-6rem)]">
          <div className="w-full max-w-[380px] flex flex-col overflow-hidden rounded-2xl border border-zinc-300 bg-zinc-900 shadow-2xl" style={{ height: "min(780px, calc(100vh - 8rem))" }}>
            {/* Phone header bar */}
            <div className="flex items-center justify-between border-b border-zinc-700 bg-zinc-800 px-4 py-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-red-500" />
                  <span className="h-3 w-3 rounded-full bg-yellow-500" />
                  <span className="h-3 w-3 rounded-full bg-green-500" />
                </div>
                <span className="ml-2 text-xs text-zinc-400 font-mono">/{establishmentSlug}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { if (previewIframeRef.current) previewIframeRef.current.src = `/${establishmentSlug}` }}
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
                  title="Recarregar"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                </button>
              </div>
            </div>
            {/* Phone frame with notch */}
            <div className="relative flex-1 bg-white overflow-hidden">
              <div className="absolute top-0 left-1/2 z-10 h-6 w-36 -translate-x-1/2 rounded-b-2xl bg-zinc-900" />
              <iframe
                key={previewKey}
                ref={previewIframeRef}
                src={`/${establishmentSlug}`}
                className="h-full w-full border-0"
              />
            </div>
          </div>
        </div>
      )}

      </div>{/* close flex */}

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

      {/* iFood Catalog Wizard */}
      {showIfoodWizard && (
        <IfoodCatalogWizard
          onClose={() => {
            setShowIfoodWizard(false)
            loadData() // Reload products after import
          }}
        />
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
                    { key: "adicionais", label: "Adicionais" },
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
                          type="text"
                          inputMode="decimal"
                          step="0.01"
                          placeholder="29,90"
                          value={productForm.price}
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
                    {/* Em Promoção */}
                    <div className={`rounded-lg border px-4 py-3 transition-colors ${
                      productForm.onSale ? "border-green-300 bg-green-50" : "border-zinc-200"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">💰</span>
                          <div>
                            <p className="text-sm font-medium text-zinc-900">Em Promoção</p>
                            <p className="text-xs text-zinc-500">Aparece no story &quot;Promoções&quot;</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setProductForm({ ...productForm, onSale: !productForm.onSale, promoPrice: !productForm.onSale ? productForm.promoPrice : "" })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            productForm.onSale ? "bg-green-500" : "bg-zinc-300"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            productForm.onSale ? "translate-x-6" : "translate-x-1"
                          }`} />
                        </button>
                      </div>
                      {productForm.onSale && (
                        <div className="mt-3 flex items-center gap-2">
                          <label className="text-sm text-zinc-600">Preço original: <span className="font-semibold">{formatCurrency(parseFloat(productForm.price) || 0)}</span></label>
                          <span className="text-zinc-400">→</span>
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-zinc-500">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder="0,00"
                              value={productForm.promoPrice}
                              onChange={(e) => setProductForm({ ...productForm, promoPrice: e.target.value })}
                              className="h-8 w-24 rounded-lg border border-green-300 bg-white px-2 text-sm font-semibold text-green-700 focus:border-green-500 focus:outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Em Destaque */}
                    <div className={`rounded-lg border px-4 py-3 transition-colors ${
                      featuredModal.currentFeatured ? "border-amber-300 bg-amber-50" : "border-zinc-200"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">🏆</span>
                          <div>
                            <p className="text-sm font-medium text-zinc-900">Em Destaque</p>
                            <p className="text-xs text-zinc-500">Aparece na seção &quot;Destaques&quot;</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (featuredModal.currentFeatured) {
                              setConflictConfirm({
                                open: true,
                                type: "featured-confirm",
                                productName: productForm.name,
                                productId: editingProduct?.id || "",
                                callback: () => {
                                  setFeaturedModal({ ...featuredModal, currentFeatured: false, currentBadge: "", currentDiscountPrice: null })
                                }
                              })
                            } else {
                              setFeaturedModal({ ...featuredModal, currentFeatured: true })
                            }
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            featuredModal.currentFeatured ? "bg-amber-500" : "bg-zinc-300"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            featuredModal.currentFeatured ? "translate-x-6" : "translate-x-1"
                          }`} />
                        </button>
                      </div>
                      {featuredModal.currentFeatured && (
                        <div className="mt-3 space-y-2">
                          <div>
                            <label className="text-sm text-zinc-600">Desconto (opcional)</label>
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-zinc-500">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0,00"
                                value={featuredModal.currentDiscountPrice || ""}
                                onChange={(e) => setFeaturedModal({ ...featuredModal, currentDiscountPrice: e.target.value ? Number(e.target.value) : null })}
                                className="h-8 w-24 rounded-lg border border-amber-300 bg-white px-2 text-sm font-semibold text-amber-700 focus:border-amber-500 focus:outline-none"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-sm text-zinc-600">Badge</label>
                            <select
                              value={featuredModal.currentBadge}
                              onChange={(e) => setFeaturedModal({ ...featuredModal, currentBadge: e.target.value })}
                              className="h-8 w-full rounded-lg border border-amber-300 bg-white px-2 text-sm text-amber-700 focus:border-amber-500 focus:outline-none"
                            >
                              <option value="">Nenhum</option>
                              <option value="mais_vendido">Mais Vendido</option>
                              <option value="novo">Novo</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Aba Ficha técnica */}
                {productTab === "ficha" && (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700">
                        Insumos da receita
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
                  </div>
                )}

                {/* Aba Adicionais */}
                {productTab === "adicionais" && (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700">
                        Itens Adicionais
                      </label>
                      <p className="mb-3 text-xs text-zinc-400">
                        Configure opções extras que o cliente pode selecionar ao pedir este produto.
                      </p>
                      {(() => {
                        // Agrupar opções por groupName
                        const groups: Record<string, { items: typeof productAdditionalOptions; groupIdx: number }> = {}
                        productAdditionalOptions.forEach((opt, idx) => {
                          const group = opt.groupName || "default"
                          if (!groups[group]) groups[group] = { items: [], groupIdx: 0 }
                          groups[group].items.push(opt)
                          groups[group].groupIdx = idx
                        })

                        const groupEntries = Object.entries(groups)
                        if (groupEntries.length === 0) return null

                        return (
                          <div className="space-y-3">
                            {groupEntries.map(([groupName, { items }], gIdx) => {
                              const firstItem = items[0]
                              const isRequired = firstItem?.selectionType === "required"
                              const groupIdx = productAdditionalOptions.indexOf(firstItem)
                              return (
                                <div key={gIdx} className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
                                  {/* Cabeçalho do grupo */}
                                  <div className="flex items-center gap-2 bg-zinc-50 px-3 py-2 border-b border-zinc-200">
                                    <input
                                      type="text"
                                      value={groupName === "default" ? "" : groupName}
                                      onChange={(e) => {
                                        const updated = [...productAdditionalOptions]
                                        items.forEach((item) => {
                                          const i = updated.indexOf(item)
                                          updated[i] = { ...item, groupName: e.target.value }
                                        })
                                        setProductAdditionalOptions(updated)
                                      }}
                                      placeholder="Nome do grupo (ex: Ponto da carne)"
                                      className="h-7 flex-1 rounded border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 focus:border-green-600 focus:outline-none"
                                    />
                                    <select
                                      value={firstItem?.inputType || "radio"}
                                      onChange={(e) => {
                                        const updated = [...productAdditionalOptions]
                                        items.forEach((item) => {
                                          const i = updated.indexOf(item)
                                          updated[i] = { ...item, inputType: e.target.value }
                                        })
                                        setProductAdditionalOptions(updated)
                                      }}
                                      className="h-7 rounded border border-zinc-200 bg-white px-1.5 text-xs text-zinc-700 focus:border-green-600 focus:outline-none"
                                    >
                                      <option value="radio">Seleção</option>
                                      <option value="quantity">Quantidade (+/-)</option>
                                    </select>
                                    <select
                                      value={firstItem?.selectionType || "single"}
                                      onChange={(e) => {
                                        const updated = [...productAdditionalOptions]
                                        items.forEach((item) => {
                                          const i = updated.indexOf(item)
                                          updated[i] = { ...item, selectionType: e.target.value }
                                        })
                                        setProductAdditionalOptions(updated)
                                      }}
                                      className="h-7 rounded border border-zinc-200 bg-white px-1.5 text-xs text-zinc-700 focus:border-green-600 focus:outline-none"
                                    >
                                      <option value="single">Única</option>
                                      <option value="multiple">Múltipla</option>
                                      <option value="required">Obrigatória</option>
                                    </select>
                                    {isRequired && (
                                      <span className="rounded bg-green-600 px-1.5 py-0.5 text-[9px] font-bold text-white">OBRIGATÓRIO</span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = productAdditionalOptions.filter((_, i) => !items.includes(productAdditionalOptions[i]))
                                        setProductAdditionalOptions(updated)
                                      }}
                                      className="text-zinc-400 hover:text-red-500"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                  {/* Subtítulo do grupo */}
                                  <div className="px-3 py-2 border-b border-zinc-100">
                                    <input
                                      type="text"
                                      value={firstItem?.headerText || ""}
                                      onChange={(e) => {
                                        const updated = [...productAdditionalOptions]
                                        items.forEach((item) => {
                                          const i = updated.indexOf(item)
                                          updated[i] = { ...item, headerText: e.target.value }
                                        })
                                        setProductAdditionalOptions(updated)
                                      }}
                                      placeholder="Subtítulo (ex: Escolha 1)"
                                      className="h-7 w-full rounded border border-zinc-200 bg-zinc-50 px-2 text-xs text-zinc-500 focus:border-green-600 focus:outline-none"
                                    />
                                  </div>
                                  {/* Itens do grupo */}
                                  <div className="divide-y divide-zinc-100">
                                    {items.map((item, iIdx) => {
                                      const itemIdx = productAdditionalOptions.indexOf(item)
                                      return (
                                        <>
                                        <div key={itemIdx} className="flex items-center gap-2 px-3 py-2">
                                          <input
                                            type="text"
                                            value={item.name}
                                            onChange={(e) => {
                                              const updated = [...productAdditionalOptions]
                                              updated[itemIdx] = { ...item, name: e.target.value }
                                              setProductAdditionalOptions(updated)
                                            }}
                                            placeholder="Nome (ex: Ao ponto)"
                                            className="h-7 flex-1 rounded border border-zinc-200 bg-zinc-50 px-2 text-xs text-zinc-700 focus:border-green-600 focus:outline-none"
                                          />
                                          <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400">R$</span>
                                            <input
                                              type="number"
                                              min="0"
                                              step="0.50"
                                              value={item.price}
                                              onChange={(e) => {
                                                const updated = [...productAdditionalOptions]
                                                updated[itemIdx] = { ...item, price: e.target.value }
                                                setProductAdditionalOptions(updated)
                                              }}
                                              className="h-7 w-20 rounded border border-zinc-200 bg-white pl-7 pr-1 text-xs text-center text-zinc-700 focus:border-green-600 focus:outline-none"
                                            />
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const updated = [...productAdditionalOptions]
                                              updated[itemIdx] = { ...item, consumesStock: !item.consumesStock }
                                              setProductAdditionalOptions(updated)
                                            }}
                                            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium border ${item.consumesStock ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-zinc-50 border-zinc-200 text-zinc-400 hover:text-zinc-600'}`}
                                            title="Consome estoque"
                                          >
                                            Estoque
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const updated = [...productAdditionalOptions]
                                              updated.splice(itemIdx, 1)
                                              setProductAdditionalOptions(updated)
                                            }}
                                            className="text-zinc-400 hover:text-red-500"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </div>
                                        {item.consumesStock && (
                                          <div className="flex items-center gap-2 px-3 pb-2 -mt-1">
                                            <span className="text-[10px] text-zinc-400">Consome de:</span>
                                            <select
                                              value={item.stockProductId}
                                              onChange={(e) => {
                                                const updated = [...productAdditionalOptions]
                                                updated[itemIdx] = { ...item, stockProductId: e.target.value }
                                                setProductAdditionalOptions(updated)
                                              }}
                                              className="h-6 flex-1 rounded border border-zinc-200 bg-white px-1.5 text-[11px] text-zinc-600 focus:border-amber-500 focus:outline-none"
                                            >
                                              <option value="">Selecionar produto...</option>
                                              {products.map((p: any) => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                              ))}
                                            </select>
                                            <span className="text-[10px] text-zinc-400">Qtd:</span>
                                            <input
                                              type="number"
                                              min="0.1"
                                              step="0.5"
                                              value={item.stockQuantity}
                                              onChange={(e) => {
                                                const updated = [...productAdditionalOptions]
                                                updated[itemIdx] = { ...item, stockQuantity: e.target.value }
                                                setProductAdditionalOptions(updated)
                                              }}
                                              className="h-6 w-14 rounded border border-zinc-200 bg-white px-1.5 text-[11px] text-center text-zinc-600 focus:border-amber-500 focus:outline-none"
                                            />
                                          </div>
                                        )}
                                        </>
                                      )
                                    })}
                                  </div>
                                  {/* Botão adicionar item */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setProductAdditionalOptions([...productAdditionalOptions, {
                                        name: "",
                                        price: "0",
                                        selectionType: firstItem?.selectionType || "single",
                                        inputType: firstItem?.inputType || "radio",
                                        groupName: groupName === "default" ? "" : groupName,
                                        headerText: firstItem?.headerText || "",
                                        maxSelection: firstItem?.maxSelection || "",
                                        consumesStock: false,
                                        stockProductId: "",
                                        stockQuantity: "1",
                                      }])
                                    }}
                                    className="flex w-full items-center justify-center gap-1 border-t border-zinc-200 bg-zinc-50 py-2 text-xs text-green-600 hover:bg-zinc-100 hover:text-green-700"
                                  >
                                    <Plus className="h-3 w-3" />
                                    Adicionar item
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}
                      <button
                        type="button"
                        onClick={() => setProductAdditionalOptions([...productAdditionalOptions, { name: "", price: "0", selectionType: "single", inputType: "radio", groupName: "", headerText: "", maxSelection: "", consumesStock: false, stockProductId: "", stockQuantity: "1" }])}
                        className="mt-2 flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
                      >
                        <Plus className="h-3 w-3" />
                        Adicionar grupo
                      </button>
                    </div>
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
            ? `Tem certeza que desejar remover a categoria "${deleteConfirm.name}" e seus ${deleteConfirm.productCount || 0} produtos? Esta ação não pode ser desfeita.`
            : `Tem certeza que desejar remover o produto "${deleteConfirm.name}"? Esta ação não pode ser desfeita.`
        }
        confirmLabel="Remover"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ open: false, type: "category", id: "", name: "" })}
      />

      {conflictConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="px-6 py-4">
              <h3 className="text-lg font-semibold text-zinc-900">
                {conflictConfirm.type === "promo-to-featured"
                  ? "Ativar destaque"
                  : conflictConfirm.type === "featured-to-promo"
                    ? "Ativar promoção"
                    : conflictConfirm.type === "on-sale-confirm"
                      ? "Promoção ativa"
                      : "Destaque ativo"}
              </h3>
              <p className="mt-2 text-sm text-zinc-600">
                {conflictConfirm.type === "promo-to-featured"
                  ? `O produto "${conflictConfirm.productName}" está em promoção. Para ativar como destaque, será necessário desativar a promoção. Deseja continuar?`
                  : conflictConfirm.type === "featured-to-promo"
                    ? `O produto "${conflictConfirm.productName}" é destaque. Para ativar promoção, será necessário remover dos destaques. Deseja continuar?`
                    : `O produto "${conflictConfirm.productName}" está ${conflictConfirm.type === "on-sale-confirm" ? "em promoção" : "em destaque"}. O que deseja fazer?`}
              </p>
            </div>
            <div className="flex gap-3 border-t border-zinc-200 px-6 py-4">
              <button
                onClick={() => setConflictConfirm(null)}
                className="flex-1 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Cancelar
              </button>
              {(conflictConfirm.type === "on-sale-confirm" || conflictConfirm.type === "featured-confirm") && (
                <button
                  onClick={conflictEditProduct}
                  className="flex-1 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Editar
                </button>
              )}
              <button
                onClick={confirmConflict}
                className="flex-1 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-600"
              >
                {(conflictConfirm.type === "on-sale-confirm" || conflictConfirm.type === "featured-confirm")
                  ? "Desativar"
                  : "Continuar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {priceUpdateModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <h3 className="text-lg font-semibold text-zinc-900">Atualizar preços</h3>
              </div>
              <button onClick={() => setPriceUpdateModal({ open: false, category: null, products: [], rounding: "none" })} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="mb-3 text-sm text-zinc-600">
                Categoria: <span className="font-semibold">{priceUpdateModal.category?.name}</span>
              </p>
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-zinc-700">Arredondamento:</label>
                <select
                  value={priceUpdateModal.rounding}
                  onChange={(e) => setPriceUpdateModal({ ...priceUpdateModal, rounding: e.target.value })}
                  className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none"
                >
                  <option value="none">Nenhum (manter centavos)</option>
                  <option value="integer">Inteiro (R$ 50,33 → R$ 50)</option>
                  <option value="point90">.90 (R$ 50,33 → R$ 49,90)</option>
                </select>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-zinc-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-zinc-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-zinc-600">Produto</th>
                      <th className="px-3 py-2 text-right font-medium text-zinc-600">Atual</th>
                      <th className="px-3 py-2 text-right font-medium text-zinc-600">Novo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {priceUpdateModal.products.map((p) => {
                      const newPrice = getRoundedPrice(p.newPrice, priceUpdateModal.rounding)
                      return (
                        <tr key={p.productId}>
                          <td className="px-3 py-2 text-zinc-900">{p.productName}</td>
                          <td className="px-3 py-2 text-right text-zinc-500">{formatCurrency(p.oldPrice)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-green-600">{formatCurrency(newPrice)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-zinc-400">{priceUpdateModal.products.length} produto(s) serão atualizados</p>
            </div>
            <div className="flex gap-3 border-t border-zinc-200 px-6 py-4">
              <Button variant="outline" className="flex-1" onClick={() => setPriceUpdateModal({ open: false, category: null, products: [], rounding: "none" })}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={confirmPriceUpdate}>
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      )}

      {promoModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔥</span>
                <h3 className="text-lg font-semibold text-zinc-900">
                  {promoModal.currentOnSale ? "Promoção Ativa" : "Ativar Promoção"}
                </h3>
              </div>
              <button onClick={() => setPromoModal({ ...promoModal, open: false })} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="mb-3 text-sm text-zinc-600">
                Produto: <span className="font-semibold">{promoModal.productName}</span>
              </p>
              <p className="mb-2 text-sm text-zinc-600">
                Preço original: <span className="font-semibold">{formatCurrency(promoModal.currentPrice)}</span>
              </p>
              {promoModal.currentOnSale && promoModal.currentPromoPrice && (
                <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2">
                  <p className="text-sm text-green-700">
                    Preço promocional atual: <span className="font-bold">{formatCurrency(promoModal.currentPromoPrice)}</span>
                    <span className="ml-1 text-xs">
                      (-{Math.round((1 - promoModal.currentPromoPrice / promoModal.currentPrice) * 100)}%)
                    </span>
                  </p>
                </div>
              )}
              <label className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors cursor-pointer ${
                promoForm.adjustPrice ? "border-green-300 bg-green-50" : "border-zinc-200 hover:bg-zinc-50"
              }`}>
                <input
                  type="checkbox"
                  checked={promoForm.adjustPrice}
                  onChange={(e) => setPromoForm({ ...promoForm, adjustPrice: e.target.checked, promoPrice: "" })}
                  className="h-4 w-4 rounded border-zinc-300 text-green-600 focus:ring-green-500"
                />
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    {promoModal.currentOnSale ? "Alterar preço promocional" : "Ajustar preço promocional"}
                  </p>
                  <p className="text-xs text-zinc-500">Define um preço menor para esta promoção</p>
                </div>
              </label>
              {promoForm.adjustPrice && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                  <span className="text-sm text-zinc-600">Preço promo:</span>
                  <span className="text-sm text-zinc-500">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={promoModal.currentPrice - 0.01}
                    placeholder="0,00"
                    value={promoForm.promoPrice}
                    onChange={(e) => setPromoForm({ ...promoForm, promoPrice: e.target.value })}
                    className="h-9 w-28 rounded-lg border border-green-300 bg-white px-3 text-sm font-semibold text-green-700 focus:border-green-500 focus:outline-none"
                    autoFocus
                  />
                  {promoForm.promoPrice && parseFloat(promoForm.promoPrice) > 0 && (
                    <span className="text-xs text-green-600">
                      (-{Math.round((1 - parseFloat(promoForm.promoPrice) / promoModal.currentPrice) * 100)}%)
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3 border-t border-zinc-200 px-6 py-4">
              <Button variant="outline" className="flex-1" onClick={() => setPromoModal({ ...promoModal, open: false })}>
                Cancelar
              </Button>
              {promoModal.currentOnSale && (
                <Button
                  variant="outline"
                  className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={confirmPromoDeactivation}
                >
                  Desativar
                </Button>
              )}
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={promoForm.adjustPrice && (!promoForm.promoPrice || parseFloat(promoForm.promoPrice) <= 0)}
                onClick={confirmPromoActivation}
              >
                {promoModal.currentOnSale ? "Atualizar" : "Ativar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {featuredModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">⭐</span>
                <h3 className="text-lg font-semibold text-zinc-900">
                  {featuredModal.currentFeatured ? "Destaque Ativo" : "Ativar Destaque"}
                </h3>
              </div>
              <button onClick={() => setFeaturedModal({ ...featuredModal, open: false })} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="mb-3 text-sm text-zinc-600">
                Produto: <span className="font-semibold">{featuredModal.productName}</span>
              </p>
              <p className="mb-2 text-sm text-zinc-600">
                Preço atual: <span className="font-semibold">{formatCurrency(featuredModal.currentPrice)}</span>
              </p>
              {featuredModal.currentFeatured && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2">
                  <p className="text-sm text-amber-700">
                    {featuredModal.currentBadge && <span className="font-bold">Badge: {featuredModal.currentBadge}</span>}
                    {featuredModal.currentDiscountPrice && (
                      <span className={featuredModal.currentBadge ? "ml-2" : ""}>
                        Desconto: <span className="font-bold">{formatCurrency(featuredModal.currentDiscountPrice)}</span>
                        <span className="ml-1 text-xs">
                          (-{Math.round((1 - featuredModal.currentDiscountPrice / featuredModal.currentPrice) * 100)}%)
                        </span>
                      </span>
                    )}
                    {!featuredModal.currentBadge && !featuredModal.currentDiscountPrice && (
                      <span>Sem configurações adicionais</span>
                    )}
                  </p>
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-700 mb-1">Texto da chamada</label>
                <input
                  type="text"
                  maxLength={20}
                  placeholder="TOP"
                  value={featuredForm.badge}
                  onChange={(e) => setFeaturedForm({ ...featuredForm, badge: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-zinc-500">Ex: TOP, NOVO, RECOMENDADO</p>
              </div>
              <label className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors cursor-pointer ${
                featuredForm.adjustPrice ? "border-amber-300 bg-amber-50" : "border-zinc-200 hover:bg-zinc-50"
              }`}>
                <input
                  type="checkbox"
                  checked={featuredForm.adjustPrice}
                  onChange={(e) => setFeaturedForm({ ...featuredForm, adjustPrice: e.target.checked, discountPrice: "" })}
                  className="h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    {featuredModal.currentFeatured ? "Alterar desconto" : "Adicionar desconto"}
                  </p>
                  <p className="text-xs text-zinc-500">O desconto aparece no card, mas NÃO vai na seção Promoções</p>
                </div>
              </label>
              {featuredForm.adjustPrice && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <span className="text-sm text-zinc-600">Preço destaque:</span>
                  <span className="text-sm text-zinc-500">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={featuredModal.currentPrice - 0.01}
                    placeholder="0,00"
                    value={featuredForm.discountPrice}
                    onChange={(e) => setFeaturedForm({ ...featuredForm, discountPrice: e.target.value })}
                    className="h-9 w-28 rounded-lg border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-700 focus:border-amber-500 focus:outline-none"
                    autoFocus
                  />
                  {featuredForm.discountPrice && parseFloat(featuredForm.discountPrice) > 0 && (
                    <span className="text-xs text-amber-600">
                      (-{Math.round((1 - parseFloat(featuredForm.discountPrice) / featuredModal.currentPrice) * 100)}%)
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3 border-t border-zinc-200 px-6 py-4">
              <Button variant="outline" className="flex-1" onClick={() => setFeaturedModal({ ...featuredModal, open: false })}>
                Cancelar
              </Button>
              {featuredModal.currentFeatured && (
                <Button
                  variant="outline"
                  className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={confirmFeaturedDeactivation}
                >
                  Desativar
                </Button>
              )}
              <Button className="flex-1 bg-amber-600 hover:bg-amber-700" onClick={confirmFeaturedActivation}>
                {featuredModal.currentFeatured ? "Atualizar" : "Ativar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Phone Preview — mobile fallback */}
      {showPreview && establishmentSlug && (
        <div
          ref={previewContainerRef}
          className={`fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-zinc-300 bg-zinc-900 shadow-2xl transition-[width,height,inset] duration-300 lg:hidden ${
            previewMaximized ? "" : "h-[680px] w-[360px]"
          }`}
          style={getPreviewStyle()}
        >
          {/* Phone header bar — draggable */}
          <div
            onMouseDown={handleDragStart}
            className="flex items-center justify-between border-b border-zinc-700 bg-zinc-800 px-4 py-2 select-none"
            style={{ cursor: previewMaximized ? "default" : "grab" }}
          >
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-500" />
                <span className="h-3 w-3 rounded-full bg-yellow-500" />
                <span className="h-3 w-3 rounded-full bg-green-500" />
              </div>
              <span className="ml-2 text-xs text-zinc-400 font-mono">/{establishmentSlug}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { if (previewIframeMobileRef.current) previewIframeMobileRef.current.src = `/${establishmentSlug}` }}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
                title="Recarregar"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
              </button>
              <button
                onClick={() => setPreviewMaximized(!previewMaximized)}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
                title={previewMaximized ? "Minimizar" : "Maximizar"}
              >
                {previewMaximized ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
                )}
              </button>
              <button
                onClick={() => setShowPreview(false)}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          {/* Phone frame with notch */}
          <div className="relative flex-1 bg-white">
            <div className="absolute top-0 left-1/2 z-10 h-6 w-36 -translate-x-1/2 rounded-b-2xl bg-zinc-900" />
            <iframe
              key={previewKey}
              ref={previewIframeMobileRef}
              src={`/${establishmentSlug}`}
              className="h-full w-full border-0"
              style={{ pointerEvents: "auto" }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
