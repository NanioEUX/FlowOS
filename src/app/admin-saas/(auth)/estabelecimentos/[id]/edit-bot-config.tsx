"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function EditBotConfig({ id, initial }: { id: string; initial: any }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState(initial)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSaved(false)
    try {
      const res = await fetch(`/api/saas-admin/establishments/${id}/bot-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Erro")
        return
      }
      setSaved(true)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">Nome do atendente</label>
          <input type="text" value={form.botAgentName} onChange={(e) => setForm({ ...form, botAgentName: e.target.value })} className="input" placeholder="Sofia" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">Tom</label>
          <select value={form.botTone} onChange={(e) => setForm({ ...form, botTone: e.target.value })} className="input">
            <option value="casual">Casual</option>
            <option value="formal">Formal</option>
            <option value="leve">Leve</option>
            <option value="direto">Direto</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-900 mb-1">Mensagem de saudação</label>
        <textarea rows={2} value={form.botGreeting} onChange={(e) => setForm({ ...form, botGreeting: e.target.value })} className="input" placeholder="Olá! Eu sou a Sofia..." />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-900 mb-1">FAQ do estabelecimento</label>
        <p className="text-xs text-zinc-500 mb-1">Regras, informações específicas deste local</p>
        <textarea rows={3} value={form.botFAQ} onChange={(e) => setForm({ ...form, botFAQ: e.target.value })} className="input" placeholder="Temos delivery próprio..." />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-900 mb-1">Prompt customizado (avançado)</label>
        <p className="text-xs text-zinc-500 mb-1">Sobrescreve o prompt da categoria do template</p>
        <textarea rows={6} value={form.botSystemPrompt} onChange={(e) => setForm({ ...form, botSystemPrompt: e.target.value })} className="input font-mono text-xs" placeholder="Deixe vazio para usar o prompt da categoria..." />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}
      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
          ✅ Configurações salvas com sucesso
        </div>
      )}

      <button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-medium text-sm">
        {loading ? "Salvando..." : "Salvar configurações"}
      </button>

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
    </form>
  )
}
