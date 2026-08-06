"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { useToast } from "@/components/toast"
import { fetchAuth } from "@/lib/fetch-auth"
import { Plus, X, Trash2, Pencil, Loader2, ArrowUp, ArrowDown, Image as ImageIcon } from "lucide-react"

interface Banner {
  id: string
  title: string
  subtitle: string | null
  ctaText: string | null
  ctaType: string
  ctaTarget: string | null
  gradientFrom: string
  gradientTo: string
  image: string | null
  order: number
  active: boolean
}

const GRADIENT_OPTIONS = [
  { from: "from-blue-500", to: "to-purple-500", label: "Azul/Roxo" },
  { from: "from-orange-500", to: "to-red-500", label: "Laranja/Vermelho" },
  { from: "from-green-500", to: "to-emerald-500", label: "Verde" },
  { from: "from-purple-500", to: "to-pink-500", label: "Roxo/Rosa" },
  { from: "from-yellow-500", to: "to-orange-500", label: "Amarelo/Laranja" },
  { from: "from-teal-500", to: "to-cyan-500", label: "Teal/Ciano" },
  { from: "from-red-500", to: "to-pink-500", label: "Vermelho/Rosa" },
  { from: "from-indigo-500", to: "to-blue-500", label: "Índigo/Azul" },
]

const CTA_TYPE_OPTIONS = [
  { value: "scroll", label: "Rolar para cardápio", icon: "📜" },
  { value: "story", label: "Abrir story", icon: "📱" },
  { value: "category", label: "Abrir categoria", icon: "📂" },
  { value: "link", label: "Link externo", icon: "🔗" },
]

export default function DestaquesContent() {
  const searchParams = useSearchParams()
  const hookEstablishmentId = useEstablishmentId()
  const searchParamsEstablishmentId = searchParams.get("establishment")
  const establishmentId = searchParamsEstablishmentId || hookEstablishmentId
  const { toast } = useToast()

  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: "", subtitle: "", ctaText: "Ver mais", ctaType: "scroll", ctaTarget: "", gradientFrom: "from-blue-500", gradientTo: "to-purple-500", image: "" })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [stories, setStories] = useState<{ id: string; name: string }[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])

  const loadBanners = useCallback(async () => {
    if (!establishmentId) return
    try {
      const res = await fetchAuth(`/api/admin/banners?establishmentId=${establishmentId}`)
      if (res.ok) setBanners(await res.json())
    } catch {}
    setLoading(false)
  }, [establishmentId])

  const loadRefs = useCallback(async () => {
    if (!establishmentId) return
    try {
      const [storiesRes, catsRes] = await Promise.all([
        fetchAuth(`/api/admin/stories?establishmentId=${establishmentId}`),
        fetchAuth(`/api/categories?establishmentId=${establishmentId}`),
      ])
      if (storiesRes.ok) setStories((await storiesRes.json()).map((s: any) => ({ id: s.id, name: s.name })))
      if (catsRes.ok) setCategories((await catsRes.json()).map((c: any) => ({ id: c.id, name: c.name })))
    } catch {}
  }, [establishmentId])

  useEffect(() => { loadBanners(); loadRefs() }, [loadBanners, loadRefs])

  async function handleSave() {
    if (!form.title.trim()) { toast("Título obrigatório", "error"); return }
    setSaving(true)
    try {
      const body = {
        title: form.title,
        subtitle: form.subtitle || null,
        ctaText: form.ctaText || null,
        ctaType: form.ctaType,
        ctaTarget: form.ctaTarget || null,
        gradientFrom: form.gradientFrom,
        gradientTo: form.gradientTo,
        image: form.image || null,
        establishmentId,
      }
      let res
      if (editingBanner) {
        res = await fetchAuth(`/api/admin/banners/${editingBanner.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      } else {
        res = await fetchAuth("/api/admin/banners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      }
      if (res.ok) {
        toast(editingBanner ? "Banner atualizado!" : "Banner criado!", "success")
        setShowForm(false); setEditingBanner(null)
        setForm({ title: "", subtitle: "", ctaText: "Ver mais", ctaType: "scroll", ctaTarget: "", gradientFrom: "from-blue-500", gradientTo: "to-purple-500", image: "" })
        loadBanners()
      } else {
        const err = await res.json(); toast(err.error || "Erro ao salvar", "error")
      }
    } catch { toast("Erro ao salvar", "error") }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetchAuth(`/api/admin/banners/${id}`, { method: "DELETE" })
      if (res.ok) { toast("Banner removido!", "success"); loadBanners() }
    } catch { toast("Erro ao deletar", "error") }
    setDeleteConfirm(null)
  }

  async function toggleActive(banner: Banner) {
    try {
      await fetchAuth(`/api/admin/banners/${banner.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !banner.active }) })
      loadBanners()
    } catch {}
  }

  async function moveOrder(banner: Banner, direction: "up" | "down") {
    const idx = banners.findIndex((b) => b.id === banner.id)
    if (direction === "up" && idx > 0) {
      const other = banners[idx - 1]
      await fetchAuth(`/api/admin/banners/${banner.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: other.order }) })
      await fetchAuth(`/api/admin/banners/${other.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: banner.order }) })
      loadBanners()
    } else if (direction === "down" && idx < banners.length - 1) {
      const other = banners[idx + 1]
      await fetchAuth(`/api/admin/banners/${banner.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: other.order }) })
      await fetchAuth(`/api/admin/banners/${other.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: banner.order }) })
      loadBanners()
    }
  }

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-zinc-400" /></div>

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Destaques</h1>
          <p className="text-sm text-zinc-500">Configure o carrossel de banners do cardápio</p>
        </div>
        <button onClick={() => { setEditingBanner(null); setForm({ title: "", subtitle: "", ctaText: "Ver mais", ctaType: "scroll", ctaTarget: "", gradientFrom: "from-blue-500", gradientTo: "to-purple-500", image: "" }); setShowForm(true) }} className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors">
          <Plus className="h-4 w-4" /> Novo Banner
        </button>
      </div>

      {banners.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-zinc-200 p-12 text-center">
          <span className="text-4xl block mb-3">🖼️</span>
          <p className="text-sm font-medium text-zinc-600">Nenhum banner configurado</p>
          <p className="text-xs text-zinc-400 mt-1">Crie banners para o carrossel do cardápio</p>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((banner, idx) => (
            <div key={banner.id} className={`rounded-xl border overflow-hidden transition-all ${banner.active ? "bg-white border-zinc-200" : "bg-zinc-50 border-zinc-100 opacity-60"}`}>
              <div className={`h-24 bg-gradient-to-br ${banner.gradientFrom} ${banner.gradientTo} relative flex items-end p-4`}>
                {banner.image && <img src={banner.image} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                <div className="relative z-10">
                  <h3 className="text-white font-bold text-sm drop-shadow">{banner.title}</h3>
                  {banner.subtitle && <p className="text-white/80 text-[11px] drop-shadow">{banner.subtitle}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-3">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveOrder(banner, "up")} disabled={idx === 0} className="text-zinc-300 hover:text-zinc-600 disabled:opacity-30"><ArrowUp className="h-3 w-3" /></button>
                  <button onClick={() => moveOrder(banner, "down")} disabled={idx === banners.length - 1} className="text-zinc-300 hover:text-zinc-600 disabled:opacity-30"><ArrowDown className="h-3 w-3" /></button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-500">CTA: {banner.ctaText} → {CTA_TYPE_OPTIONS.find((c) => c.value === banner.ctaType)?.label}</p>
                </div>
                <button onClick={() => toggleActive(banner)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${banner.active ? "bg-green-500" : "bg-zinc-300"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${banner.active ? "translate-x-6" : "translate-x-1"}`} />
                </button>
                <button onClick={() => { setEditingBanner(banner); setForm({ title: banner.title, subtitle: banner.subtitle || "", ctaText: banner.ctaText || "Ver mais", ctaType: banner.ctaType, ctaTarget: banner.ctaTarget || "", gradientFrom: banner.gradientFrom, gradientTo: banner.gradientTo, image: banner.image || "" }); setShowForm(true) }} className="text-zinc-400 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => setDeleteConfirm(banner.id)} className="text-zinc-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 sticky top-0 bg-white z-10">
              <h3 className="text-lg font-semibold text-zinc-900">{editingBanner ? "Editar Banner" : "Novo Banner"}</h3>
              <button onClick={() => { setShowForm(false); setEditingBanner(null) }} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-6 py-4 space-y-5">
              {/* Preview */}
              <div className={`rounded-xl h-32 bg-gradient-to-br ${form.gradientFrom} ${form.gradientTo} relative flex items-end p-4 overflow-hidden`}>
                {form.image && <img src={form.image} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                <div className="relative z-10">
                  <h3 className="text-white font-bold drop-shadow">{form.title || "Título do banner"}</h3>
                  {form.subtitle && <p className="text-white/80 text-xs drop-shadow">{form.subtitle}</p>}
                  {form.ctaText && <span className="inline-block mt-2 bg-white text-xs font-bold px-3 py-1 rounded-full drop-shadow" style={{ color: "#333" }}>{form.ctaText} →</span>}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Título</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Promoções imperdíveis" className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-green-600 focus:outline-none" />
              </div>

              {/* Subtitle */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Subtítulo</label>
                <input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Ex: Economize em produtos selecionados" className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-green-600 focus:outline-none" />
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

              {/* Image URL */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Imagem de fundo (opcional)</label>
                <input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="https://exemplo.com/banner.jpg" className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-green-600 focus:outline-none" />
              </div>

              {/* CTA */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Texto do botão</label>
                <input value={form.ctaText} onChange={(e) => setForm({ ...form, ctaText: e.target.value })} placeholder="Ver Ofertas" className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-green-600 focus:outline-none" />
              </div>

              {/* CTA Type */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Ação do botão</label>
                <div className="grid grid-cols-2 gap-2">
                  {CTA_TYPE_OPTIONS.map((opt) => (
                    <button key={opt.value} type="button" onClick={() => setForm({ ...form, ctaType: opt.value, ctaTarget: "" })} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors text-left ${form.ctaType === opt.value ? "border-green-600 bg-green-50 text-green-700" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
                      <span>{opt.icon}</span> {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* CTA Target */}
              {form.ctaType === "story" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Story</label>
                  <select value={form.ctaTarget} onChange={(e) => setForm({ ...form, ctaTarget: e.target.value })} className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-green-600 focus:outline-none">
                    <option value="">Selecionar story...</option>
                    {stories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              {form.ctaType === "category" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Categoria</label>
                  <select value={form.ctaTarget} onChange={(e) => setForm({ ...form, ctaTarget: e.target.value })} className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-green-600 focus:outline-none">
                    <option value="">Selecionar categoria...</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              {form.ctaType === "link" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">URL</label>
                  <input value={form.ctaTarget} onChange={(e) => setForm({ ...form, ctaTarget: e.target.value })} placeholder="https://..." className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-green-600 focus:outline-none" />
                </div>
              )}
            </div>
            <div className="flex gap-3 border-t border-zinc-200 px-6 py-4 sticky bottom-0 bg-white">
              <button onClick={() => { setShowForm(false); setEditingBanner(null) }} className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editingBanner ? "Salvar" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-900 mb-2">Remover banner?</h3>
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
