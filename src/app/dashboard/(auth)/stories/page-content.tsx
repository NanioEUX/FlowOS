"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { useToast } from "@/components/toast"
import { fetchAuth } from "@/lib/fetch-auth"
import { Plus, X, GripVertical, Trash2, Pencil, Loader2, Star, Sparkles, Tag, ArrowUp, ArrowDown, Search } from "lucide-react"

interface Story {
  id: string
  name: string
  emoji: string
  gradientFrom: string
  gradientTo: string
  type: "auto" | "manual"
  autoType: string | null
  order: number
  active: boolean
  items: { product: { id: string; name: string; price: number; image: string | null } }[]
}

const EMOJI_OPTIONS = ["🔥", "🎁", "✨", "💰", "🥗", "🚫", "🍕", "🍔", "🍣", "🍰", "☕", "🍺", "🥤", "🎉", "⭐", "💝", "🌿", "💪"]

const GRADIENT_OPTIONS = [
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

export default function StoriesContent() {
  const searchParams = useSearchParams()
  const hookEstablishmentId = useEstablishmentId()
  const searchParamsEstablishmentId = searchParams.get("establishment")
  const establishmentId = searchParamsEstablishmentId || hookEstablishmentId
  const { toast } = useToast()

  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [editingStory, setEditingStory] = useState<Story | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", emoji: "🔥", gradientFrom: "from-red-500", gradientTo: "to-orange-500", type: "manual" as "auto" | "manual", autoType: "" })
  const [saving, setSaving] = useState(false)
  const [allProducts, setAllProducts] = useState<{ id: string; name: string; price: number; image: string | null }[]>([])
  const [productSearch, setProductSearch] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const loadStories = useCallback(async () => {
    if (!establishmentId) return
    try {
      const res = await fetchAuth(`/api/admin/stories?establishmentId=${establishmentId}`)
      if (res.ok) {
        const data = await res.json()
        setStories(data)
      }
    } catch {}
    setLoading(false)
  }, [establishmentId])

  const loadProducts = useCallback(async () => {
    if (!establishmentId) return
    try {
      const res = await fetchAuth(`/api/categories?establishmentId=${establishmentId}`)
      if (res.ok) {
        const cats = await res.json()
        const products = cats.flatMap((c: any) => c.products || [])
        setAllProducts(products)
      }
    } catch {}
  }, [establishmentId])

  useEffect(() => { loadStories(); loadProducts() }, [loadStories, loadProducts])

  async function handleSave() {
    if (!form.name.trim()) { toast("Nome obrigatório", "error"); return }
    setSaving(true)
    try {
      const body = {
        name: form.name,
        emoji: form.emoji,
        gradientFrom: form.gradientFrom,
        gradientTo: form.gradientTo,
        type: form.type,
        autoType: form.type === "auto" ? form.autoType : null,
        establishmentId,
      }
      let res
      if (editingStory) {
        res = await fetchAuth(`/api/admin/stories/${editingStory.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      } else {
        res = await fetchAuth("/api/admin/stories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      }
      if (res.ok) {
        toast(editingStory ? "Story atualizado!" : "Story criado!", "success")
        setShowForm(false)
        setEditingStory(null)
        setForm({ name: "", emoji: "🔥", gradientFrom: "from-red-500", gradientTo: "to-orange-500", type: "manual", autoType: "" })
        loadStories()
      } else {
        const err = await res.json()
        toast(err.error || "Erro ao salvar", "error")
      }
    } catch { toast("Erro ao salvar", "error") }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetchAuth(`/api/admin/stories/${id}`, { method: "DELETE" })
      if (res.ok) { toast("Story removido!", "success"); loadStories() }
    } catch { toast("Erro ao deletar", "error") }
    setDeleteConfirm(null)
  }

  async function toggleActive(story: Story) {
    try {
      await fetchAuth(`/api/admin/stories/${story.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !story.active }) })
      loadStories()
    } catch {}
  }

  async function moveOrder(story: Story, direction: "up" | "down") {
    const idx = stories.findIndex((s) => s.id === story.id)
    if (direction === "up" && idx > 0) {
      const other = stories[idx - 1]
      await fetchAuth(`/api/admin/stories/${story.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: other.order }) })
      await fetchAuth(`/api/admin/stories/${other.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: story.order }) })
      loadStories()
    } else if (direction === "down" && idx < stories.length - 1) {
      const other = stories[idx + 1]
      await fetchAuth(`/api/admin/stories/${story.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: other.order }) })
      await fetchAuth(`/api/admin/stories/${other.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: story.order }) })
      loadStories()
    }
  }

  async function addProductToStory(storyId: string, productId: string) {
    try {
      const res = await fetchAuth(`/api/admin/stories/${storyId}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId }) })
      if (res.ok) { loadStories() }
    } catch {}
  }

  async function removeProductFromStory(storyId: string, productId: string) {
    try {
      const res = await fetchAuth(`/api/admin/stories/${storyId}/items?productId=${productId}`, { method: "DELETE" })
      if (res.ok) { loadStories() }
    } catch {}
  }

  const filteredProducts = allProducts.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()))

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-zinc-400" /></div>

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Stories</h1>
          <p className="text-sm text-zinc-500">Configure os stories circulares do cardápio</p>
        </div>
        <button onClick={() => { setEditingStory(null); setForm({ name: "", emoji: "🔥", gradientFrom: "from-red-500", gradientTo: "to-orange-500", type: "manual", autoType: "" }); setShowForm(true) }} className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors">
          <Plus className="h-4 w-4" /> Novo Story
        </button>
      </div>

      {/* Stories List */}
      {stories.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-zinc-200 p-12 text-center">
          <span className="text-4xl block mb-3">📱</span>
          <p className="text-sm font-medium text-zinc-600">Nenhum story configurado</p>
          <p className="text-xs text-zinc-400 mt-1">Crie stories para aparecerem no cardápio do cliente</p>
        </div>
      ) : (
        <div className="space-y-2">
          {stories.map((story, idx) => (
            <div key={story.id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${story.active ? "bg-white border-zinc-200" : "bg-zinc-50 border-zinc-100 opacity-60"}`}>
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveOrder(story, "up")} disabled={idx === 0} className="text-zinc-300 hover:text-zinc-600 disabled:opacity-30"><ArrowUp className="h-3 w-3" /></button>
                <button onClick={() => moveOrder(story, "down")} disabled={idx === stories.length - 1} className="text-zinc-300 hover:text-zinc-600 disabled:opacity-30"><ArrowDown className="h-3 w-3" /></button>
              </div>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg`} style={{ background: `linear-gradient(135deg, var(--tw-gradient-stops))` }}>
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${story.gradientFrom} ${story.gradientTo} flex items-center justify-center text-lg`}>{story.emoji}</div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-900 truncate">{story.name}</p>
                <p className="text-[11px] text-zinc-400">
                  {story.type === "auto" ? `Automático: ${AUTO_TYPE_OPTIONS.find((a) => a.value === story.autoType)?.label || story.autoType}` : `${story.items.length} produto(s)`}
                </p>
              </div>
              <button onClick={() => toggleActive(story)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${story.active ? "bg-green-500" : "bg-zinc-300"}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${story.active ? "translate-x-6" : "translate-x-1"}`} />
              </button>
              <button onClick={() => { setEditingStory(story); setForm({ name: story.name, emoji: story.emoji, gradientFrom: story.gradientFrom, gradientTo: story.gradientTo, type: story.type, autoType: story.autoType || "" }); setShowForm(true) }} className="text-zinc-400 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => setDeleteConfirm(story.id)} className="text-zinc-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 sticky top-0 bg-white z-10">
              <h3 className="text-lg font-semibold text-zinc-900">{editingStory ? "Editar Story" : "Novo Story"}</h3>
              <button onClick={() => { setShowForm(false); setEditingStory(null) }} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-6 py-4 space-y-5">
              {/* Name */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Nome</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Fits, Sem Lactose..." className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-green-600 focus:outline-none" />
              </div>

              {/* Emoji */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Emoji</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map((em) => (
                    <button key={em} type="button" onClick={() => setForm({ ...form, emoji: em })} className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${form.emoji === em ? "bg-green-100 ring-2 ring-green-500 scale-110" : "bg-zinc-100 hover:bg-zinc-200"}`}>{em}</button>
                  ))}
                </div>
              </div>

              {/* Gradient */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Cores</label>
                <div className="grid grid-cols-4 gap-2">
                  {GRADIENT_OPTIONS.map((g) => (
                    <button key={g.from} type="button" onClick={() => setForm({ ...form, gradientFrom: g.from, gradientTo: g.to })} className={`h-10 rounded-lg bg-gradient-to-br ${g.from} ${g.to} transition-all ${form.gradientFrom === g.from ? "ring-2 ring-green-500 ring-offset-2 scale-105" : "hover:scale-105"}`} title={g.label} />
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="flex items-center gap-3 rounded-xl bg-zinc-50 px-4 py-3">
                <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${form.gradientFrom} ${form.gradientTo} flex items-center justify-center text-2xl shadow-md`}>{form.emoji}</div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{form.name || "Nome do story"}</p>
                  <p className="text-[11px] text-zinc-400">Preview no cardápio</p>
                </div>
              </div>

              {/* Type */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Tipo</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setForm({ ...form, type: "manual" })} className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${form.type === "manual" ? "border-green-600 bg-green-50 text-green-700" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
                    📋 Manual
                  </button>
                  <button type="button" onClick={() => setForm({ ...form, type: "auto" })} className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${form.type === "auto" ? "border-green-600 bg-green-50 text-green-700" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
                    🤖 Automático
                  </button>
                </div>
              </div>

              {/* Auto Type */}
              {form.type === "auto" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Tipo automático</label>
                  <div className="space-y-2">
                    {AUTO_TYPE_OPTIONS.map((opt) => (
                      <button key={opt.value} type="button" onClick={() => setForm({ ...form, autoType: opt.value })} className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-colors text-left ${form.autoType === opt.value ? "border-green-600 bg-green-50 text-green-700" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}>
                        <span className="text-lg">{opt.icon}</span> {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual: Product selection */}
              {form.type === "manual" && editingStory && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Produtos no story</label>
                  {/* Current products */}
                  {editingStory.items.length > 0 && (
                    <div className="space-y-1 mb-3">
                      {editingStory.items.map((item) => (
                        <div key={item.product.id} className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                          {item.product.image ? <img src={item.product.image} alt="" className="h-8 w-8 rounded-lg object-cover" /> : <div className="h-8 w-8 rounded-lg bg-zinc-100 flex items-center justify-center text-xs">📦</div>}
                          <span className="flex-1 text-sm font-medium text-zinc-700 truncate">{item.product.name}</span>
                          <button onClick={() => removeProductFromStory(editingStory.id, item.product.id)} className="text-zinc-400 hover:text-red-500"><X className="h-4 w-4" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Add products */}
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Buscar produto para adicionar..." className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm focus:border-green-600 focus:outline-none" />
                  </div>
                  {productSearch && (
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-zinc-200">
                      {filteredProducts.filter((p) => !editingStory.items.some((i) => i.product.id === p.id)).slice(0, 10).map((product) => (
                        <button key={product.id} onClick={() => { addProductToStory(editingStory.id, product.id); setProductSearch("") }} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
                          {product.image ? <img src={product.image} alt="" className="h-7 w-7 rounded-lg object-cover" /> : <div className="h-7 w-7 rounded-lg bg-zinc-100 flex items-center justify-center text-[10px]">📦</div>}
                          <span className="text-sm text-zinc-700 truncate">{product.name}</span>
                        </button>
                      ))}
                      {filteredProducts.filter((p) => !editingStory.items.some((i) => i.product.id === p.id)).length === 0 && (
                        <p className="px-3 py-2 text-xs text-zinc-400">Nenhum produto encontrado</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3 border-t border-zinc-200 px-6 py-4 sticky bottom-0 bg-white">
              <button onClick={() => { setShowForm(false); setEditingStory(null) }} className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editingStory ? "Salvar" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-900 mb-2">Remover story?</h3>
            <p className="text-sm text-zinc-500 mb-6">Essa ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50">Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700">Remover</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
