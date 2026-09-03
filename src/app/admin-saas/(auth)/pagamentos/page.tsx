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
  const [pagarmeFeePercentage, setPagarmeFeePercentage] = useState(1.09)
  const [saasProfitPercentage, setSaasProfitPercentage] = useState(0.41)
  const [showApiKey, setShowApiKey] = useState(false)

  const totalCommission = pagarmeFeePercentage + saasProfitPercentage

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
        if (data.pagarmeFeePercentage) setPagarmeFeePercentage(data.pagarmeFeePercentage)
        if (data.saasProfitPercentage) setSaasProfitPercentage(data.saasProfitPercentage)
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
    setTestResult(null)

    try {
      const res = await fetch("/api/saas-admin/pagamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pagarmeApiKey,
          pagarmeWebhookKey,
          pagarmeEnvironment,
          saasProfitPercentage,
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

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Taxa Pagar.me</label>
            <div className="w-full h-10 rounded-lg border border-zinc-200 bg-zinc-100 px-3 text-sm flex items-center text-zinc-600">
              {pagarmeFeePercentage.toFixed(2)}%
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Taxa fixa cobrada pelo Pagar.me.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Seu lucro (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={saasProfitPercentage}
              onChange={(e) => setSaasProfitPercentage(Number(e.target.value))}
              className="w-full h-10 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm"
            />
            <p className="text-xs text-zinc-400 mt-1">
              Quanto você quer lucrar por transação.
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-700">
              Total a ser descontado por pedido: <span className="font-bold">{totalCommission.toFixed(2)}%</span>
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
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

        {/* Taxas e comissão */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="text-lg font-bold text-zinc-900 mb-4">Modelo de Taxas</h2>
          <div className="bg-zinc-50 rounded-lg p-4 text-sm space-y-2">
            <p className="font-medium text-zinc-700">Exemplo: Pedido de R$ 100,00</p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-500">Estabelecimento recebe</span>
                <span className="text-green-600 font-medium">{(100 - totalCommission).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Pagar.me cobra</span>
                <span className="text-zinc-900 font-medium">{pagarmeFeePercentage.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Seu lucro (SaaS)</span>
                <span className="text-green-600 font-medium">{saasProfitPercentage.toFixed(2)}%</span>
              </div>
              <div className="border-t border-zinc-200 pt-2 mt-2 flex justify-between">
                <span className="text-zinc-700 font-medium">Total descontado</span>
                <span className="text-green-600 font-bold">{totalCommission.toFixed(2)}%</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-zinc-400 mt-3">
            Configure a comissão de cada estabelecimento em{" "}
            <a href="/admin-saas/estabelecimentos" className="text-green-600 hover:underline">
              Estabelecimentos → [nome] → Pagamentos
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
