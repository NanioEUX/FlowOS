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
  const [saasProfitPercentage, setSaasProfitPercentage] = useState(0)
  const [feeMode, setFeeMode] = useState<"pagarme_only" | "pagarme_plus_saas">("pagarme_only")
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
        if (data.pagarmeFeePercentage) setPagarmeFeePercentage(data.pagarmeFeePercentage)
        if (data.saasProfitPercentage) {
          setSaasProfitPercentage(data.saasProfitPercentage)
          setFeeMode(data.saasProfitPercentage > 0 ? "pagarme_plus_saas" : "pagarme_only")
        }
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
          saasProfitPercentage: feeMode === "pagarme_only" ? 0 : saasProfitPercentage,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Erro ao salvar")
        return
      }

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

  const saasPercentage = feeMode === "pagarme_only" ? 0 : saasProfitPercentage
  const establishmentPercentage = 100 - saasPercentage - pagarmeFeePercentage

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Gateway de Pagamento</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Configure a integração com Pagar.me (Stone) para receber pagamentos.
        </p>
      </div>

      <div className="space-y-6">
        {/* Dados de conexão */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <span className="text-xl">💳</span>
            </div>
            <div>
              <h2 className="font-semibold text-zinc-900">Pagar.me (Stone)</h2>
              <p className="text-xs text-zinc-500">PIX + Cartão de crédito</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Ambiente</label>
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
                placeholder="sk_..."
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
          </div>
        </div>

        {/* Configurar taxas */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-zinc-900">Configurar taxas</h2>
            <p className="text-xs text-zinc-500 mt-1">
              A taxa do Pagar.me ({pagarmeFeePercentage.toFixed(2)}%) é cobrada automaticamente a cada transação.
            </p>
          </div>

          {/* Taxa Pagar.me - sempre visível */}
          <div className="bg-zinc-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-700">Taxa Pagar.me</p>
                <p className="text-xs text-zinc-400">Cobrada automaticamente por transação</p>
              </div>
              <span className="text-lg font-bold text-zinc-900">{pagarmeFeePercentage.toFixed(2)}%</span>
            </div>
          </div>

          {/* Opção: Somente Pagar.me */}
          <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
            feeMode === "pagarme_only"
              ? "border-green-500 bg-green-50"
              : "border-zinc-200 hover:border-zinc-300"
          }`}>
            <input
              type="radio"
              name="feeMode"
              value="pagarme_only"
              checked={feeMode === "pagarme_only"}
              onChange={() => setFeeMode("pagarme_only")}
              className="mt-0.5 accent-green-600"
            />
            <div>
              <p className="text-sm font-medium text-zinc-900">Somente taxa Pagar.me</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Estabelecimento recebe tudo menos a taxa do Pagar.me. Sem comissão para o SaaS.
              </p>
            </div>
          </label>

          {/* Opção: Pagar.me + SaaS */}
          <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
            feeMode === "pagarme_plus_saas"
              ? "border-green-500 bg-green-50"
              : "border-zinc-200 hover:border-zinc-300"
          }`}>
            <input
              type="radio"
              name="feeMode"
              value="pagarme_plus_saas"
              checked={feeMode === "pagarme_plus_saas"}
              onChange={() => setFeeMode("pagarme_plus_saas")}
              className="mt-0.5 accent-green-600"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-zinc-900">Taxa Pagar.me + Taxa SaaS</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                SaaS cobra uma comissão extra sobre cada transação.
              </p>

              {feeMode === "pagarme_plus_saas" && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-zinc-500 whitespace-nowrap">SaaS fica com</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max="10"
                        value={saasProfitPercentage}
                        onChange={(e) => setSaasProfitPercentage(Number(e.target.value))}
                        className="w-20 h-8 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-center"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400">%</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    SaaS recebe {saasPercentage.toFixed(2)}% (taxa Pagar.me sai desse valor)
                  </p>
                </div>
              )}
            </div>
          </label>

          {/* Resumo */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-xs text-green-600 font-medium mb-2">Resumo por pedido de R$ 100,00</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-600">Estabelecimento recebe</span>
                <span className="font-medium text-green-700">{establishmentPercentage.toFixed(2)}% = R$ {(100 * establishmentPercentage / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Pagar.me cobra</span>
                <span className="font-medium text-zinc-700">{pagarmeFeePercentage.toFixed(2)}% = R$ {(100 * pagarmeFeePercentage / 100).toFixed(2)}</span>
              </div>
              {saasPercentage > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-600">SaaS recebe</span>
                  <span className="font-medium text-green-700">{saasPercentage.toFixed(2)}% = R$ {(100 * saasPercentage / 100).toFixed(2)}</span>
                </div>
              )}
            </div>
            {feeMode === "pagarme_plus_saas" && (
              <p className="text-[11px] text-zinc-400 mt-2 border-t border-green-200 pt-2">
                A taxa do Pagar.me ({pagarmeFeePercentage.toFixed(2)}%) é descontada do valor do SaaS.
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !pagarmeApiKey}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium rounded-lg px-6 py-2.5 text-sm transition-all"
        >
          {saving ? "Salvando e testando..." : "Salvar e conectar"}
        </button>

        {testResult && (
          <div className={`border rounded-lg px-4 py-3 text-sm ${testResult.ok ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
            {testResult.ok ? "✅ " : "❌ "}{testResult.message}
          </div>
        )}

        <div className="bg-zinc-50 rounded-lg p-4 text-xs text-zinc-500 space-y-2">
          <p className="font-medium text-zinc-700">Como funciona:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>A API Key é usada por todos os estabelecimentos (gateway centralizado)</li>
            <li>Cada estabelecimento configura seu recipient para split</li>
            <li>O webhook recebe em: <code className="bg-zinc-100 px-1 rounded">/api/webhooks/pagarme</code></li>
          </ul>
        </div>
      </div>
    </div>
  )
}
