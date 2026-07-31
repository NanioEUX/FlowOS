"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

export default function EditarTemplatePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState<any>(null)

  useEffect(() => {
    fetch(`/api/saas-admin/templates/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
          return
        }
        setForm(data)
      })
      .catch((e) => setError(e.message))
  }, [params.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/saas-admin/templates/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Erro")
        return
      }
      router.push("/admin-saas/templates")
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm("Excluir esse template? Estabelecimentos que dependem dele podem ficar sem prompt base.")) return
    setDeleting(true)
    try {
      await fetch(`/api/saas-admin/templates/${params.id}`, { method: "DELETE" })
      router.push("/admin-saas/templates")
    } catch (e: any) {
      setError(e.message)
      setDeleting(false)
    }
  }

  if (!form && !error) return <div className="p-8 text-zinc-500">Carregando...</div>
  if (error && !form) return <div className="p-8 text-red-600">{error}</div>

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-zinc-900">Editar Template</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-zinc-900 mb-1">Slug *</label>
            <input type="text" required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-1">Ícone</label>
            <input type="text" value={form.icon || ""} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="input" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">Nome *</label>
          <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">Descrição</label>
          <input type="text" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-1">Tom</label>
            <select value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} className="input">
              <option value="casual">Casual</option>
              <option value="formal">Formal</option>
              <option value="leve">Leve</option>
              <option value="direto">Direto</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-1">Agente padrão</label>
            <input type="text" value={form.defaultAgentName} onChange={(e) => setForm({ ...form, defaultAgentName: e.target.value })} className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-1">Ordem</label>
            <input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })} className="input" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">Prompt Base *</label>
          <textarea required rows={10} value={form.promptBase} onChange={(e) => setForm({ ...form, promptBase: e.target.value })} className="input font-mono text-xs" />
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="enabled" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
          <label htmlFor="enabled" className="text-sm">Habilitado</label>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-medium text-sm">
            {loading ? "Salvando..." : "Salvar"}
          </button>
          <button type="button" onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-medium text-sm">
            {deleting ? "Excluindo..." : "Excluir"}
          </button>
          <a href="/admin-saas/templates" className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-5 py-2.5 rounded-lg font-medium text-sm">Cancelar</a>
        </div>
      </form>

      <style jsx>{`
        .input {
          width: 100%;
          padding: 0.625rem 0.875rem;
          border: 1px solid #e4e4e7;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          background: white;
        }
        .input:focus {
          outline: none;
          border-color: #16a34a;
          box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.15);
        }
      `}</style>
    </div>
  )
}
