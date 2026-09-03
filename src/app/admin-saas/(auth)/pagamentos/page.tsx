"use client"

import { useState, useEffect } from "react"

export default function PagamentosPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const [pagarmeApiKey, setPagarmeApiKey] = useState("")
  const [pagarmeWebhookKey, setPagarmeWebhookKey] = useState("")
  const [pagarmeEnvironment, setPagarmeEnvironment] = useState("sandbox")
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    try {
      const res = await fetch("/api/saas-admin/pagamentos")
      const data = await res.json()
      if (data.ok) {
        setPagarmeApiKey(data.pagarmeApiKey || "")
        setPagarmeWebhookKey(data.pagarmeWebhookKey || "")
        setPagarmeEnvironment(data.pagarmeEnvironment || "sandbox")
      }
    } catch (e) {
      console.error("Erro ao carregar config:", e)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError("")
    setSaved(false)
    setTestResult(null)

    try {
      const res = await fetch("/api/saas-admin/pagamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pagarmeApiKey,
          pagarmeWebhookKey,
          pagarmeEnvironment,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Erro ao salvar")
        return
      }

      // Auto-test after save
      const testRes = await fetch("/api/saas-admin/pagamentos/test")
      const testData = await testRes.json()
      setTestResult(testData)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-zinc-500">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Gateway de Pagamento</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Configure a integração com Pagar.me (Stone) para receber pagamentos.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <span className="text-xl">💳</span>
          </div>
          <div>
            <h2 className="font-semibold text-zinc-900">Pagar.me (Stone)</h2>
            <p className="text-xs text-zinc-500">PIX + Cartão de crédito</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Environment</label>
            <select
              value={pagarmeEnvironment}
              onChange={(e) => setPagarmeEnvironment(e.target.value)}
              className="w-full h-10 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm"
            >
              <option value="sandbox">Sandbox (Testes)</option>
              <option value="production">Produção</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">API Key</label>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={pagarmeApiKey}
                onChange={(e) => setPagarmeApiKey(e.target.value)}
                placeholder="pagarme_key_production_..."
                className="w-full h-10 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm pr-20"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-700"
              >
                {showApiKey ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Webhook Key</label>
            <input
              type="text"
              value={pagarmeWebhookKey}
              onChange={(e) => setPagarmeWebhookKey(e.target.value)}
              placeholder="Chave de validação do webhook"
              className="w-full h-10 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm"
            />
            <p className="text-xs text-zinc-400 mt-1">
              Usada para validar assinatura dos webhooks recebidos.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {saved && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
            Configuração salva com sucesso!
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !pagarmeApiKey}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium rounded-lg px-6 py-2.5 text-sm transition-all"
          >
            {saving ? "Salvando e testando..." : "Salvar e conectar"}
          </button>
        </div>

        {testResult && (
          <div className={`border rounded-lg px-4 py-3 text-sm ${testResult.ok ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
            {testResult.ok ? "✅ " : "❌ "}{testResult.message}
          </div>
        )}

        <div className="bg-zinc-50 rounded-lg p-4 text-xs text-zinc-500 space-y-2">
          <p className="font-medium text-zinc-700">Como funciona:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>A API Key é usada por todos os estabelecimentos (gateway centralizado)</li>
            <li>Cada estabelecimento configura seu ID de receiver para split</li>
            <li>O webhook recebe em: <code className="bg-zinc-100 px-1 rounded">/api/webhooks/pagarme</code></li>
          </ul>
        </div>
      </div>
    </div>
  )
}
