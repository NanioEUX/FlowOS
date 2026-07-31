"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function EditarQuickReplyPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState<any>(null)

  useEffect(() => {
    fetch(`/api/saas-admin/quick-replies/${params.id}`)
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
      const res = await fetch(`/api/saas-admin/quick-replies/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Erro ao salvar")
        return
      }
      router.push("/admin-saas/respostas-rapidas")
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm("Excluir essa resposta rápida?")) return
    setDeleting(true)
    try {
      await fetch(`/api/saas-admin/quick-replies/${params.id}`, { method: "DELETE" })
      router.push("/admin-saas/respostas-rapidas")
    } catch (e: any) {
      setError(e.message)
      setDeleting(false)
    }
  }

  if (!form && !error) {
    return <div className="p-8 text-zinc-500">Carregando...</div>
  }

  if (error && !form) {
    return <div className="p-8 text-red-600">{error}</div>
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-zinc-900">Editar Resposta Rápida</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">Categoria *</label>
          <input type="text" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">Rótulo *</label>
          <input type="text" required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">Palavras-chave *</label>
          <input type="text" required value={form.triggers} onChange={(e) => setForm({ ...form, triggers: e.target.value })} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">Resposta *</label>
          <textarea required rows={4} value={form.response} onChange={(e) => setForm({ ...form, response: e.target.value })} className="input" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-1">Tipo de match</label>
            <select value={form.matchType} onChange={(e) => setForm({ ...form, matchType: e.target.value })} className="input">
              <option value="any">Qualquer palavra</option>
              <option value="all">Todas as palavras</option>
              <option value="exact">Texto exato</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-1">Ordem</label>
            <input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })} className="input" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="enabled" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
          <label htmlFor="enabled" className="text-sm">Ativa</label>
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
          <a href="/admin-saas/respostas-rapidas" className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-5 py-2.5 rounded-lg font-medium text-sm">Cancelar</a>
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
