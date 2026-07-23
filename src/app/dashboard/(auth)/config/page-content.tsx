"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Save, Loader2, Eye, EyeOff, CreditCard, Banknote, Bike, Store, Clock, Plug, CheckCircle, XCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { fetchAuth } from "@/lib/fetch-auth"
import { formatCurrency } from "@/lib/utils"

const categories = [
  { value: "restaurante", label: "Restaurante" },
  { value: "pizzaria", label: "Pizzaria" },
  { value: "hamburgueria", label: "Hamburgueria" },
  { value: "lanchonete", label: "Lanchonete" },
  { value: "padaria", label: "Padaria / Confeitaria" },
  { value: "sorveteria", label: "Sorveteria / Açaí" },
  { value: "petiscaria", label: "Petiscaria / Bar" },
  { value: "japonesa", label: "Comida Japonesa" },
  { value: "brasileira", label: "Comida Brasileira" },
  { value: "outro", label: "Outro" },
]

export default function ConfigPage() {
  const searchParams = useSearchParams()
  const hookEstablishmentId = useEstablishmentId()
  const searchParamsEstablishmentId = searchParams.get("establishment")
  const establishmentId = searchParamsEstablishmentId || hookEstablishmentId
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [testingAsaas, setTestingAsaas] = useState(false)
  const [asaasTestResult, setAsaasTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [form, setForm] = useState({
    name: "",
    phone: "",
    category: "",
    address: "",
    description: "",
    logo: "",
    cover: "",
    asaasApiKey: "",
    asaasWalletId: "",
    interClientId: "",
    interClientSecret: "",
    interCertificate: "",
    interCertificatePassword: "",
    interPixKey: "",
    deliveryFeeType: "free",
    deliveryFeeAmount: "0",
    deliveryFreeAbove: "0",
    defaultTheme: "dark",
    tableCount: "10",
  })

  const [asaasMode, setAsaasMode] = useState<"both" | "card_only">("both")
  const [paymentConfig, setPaymentConfig] = useState({ online: true, delivery: true, pickup: true })
  const [orderConfig, setOrderConfig] = useState({ 
    delivery: true, 
    pickup: true,
    serviceTaxEnabled: false,
    serviceTaxType: "percent" as "percent" | "fixed",
    serviceTaxValue: 10,
    serviceTaxPresencial: true,
  })
  const [businessHours, setBusinessHours] = useState([
    { day: "Segunda", open: "09:00", close: "22:00", active: true },
    { day: "Terça", open: "09:00", close: "22:00", active: true },
    { day: "Quarta", open: "09:00", close: "22:00", active: true },
    { day: "Quinta", open: "09:00", close: "22:00", active: true },
    { day: "Sexta", open: "09:00", close: "22:00", active: true },
    { day: "Sábado", open: "09:00", close: "23:00", active: true },
    { day: "Domingo", open: "00:00", close: "00:00", active: false },
  ])

  useEffect(() => {
    if (!establishmentId) return
    fetchAuth(`/api/establishments?id=${establishmentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setForm({
            name: data.name || "",
            phone: data.phone || "",
            category: data.category || "",
            address: data.address || "",
            description: data.description || "",
            logo: data.logo || "",
            cover: data.cover || "",
            asaasApiKey: data.asaasApiKey || "",
            asaasWalletId: data.asaasWalletId || "",
            interClientId: data.interClientId || "",
            interClientSecret: data.interClientSecret || "",
            interCertificate: data.interCertificate || "",
            interCertificatePassword: data.interCertificatePassword || "",
            interPixKey: data.interPixKey || "",
            deliveryFeeType: data.deliveryFeeType || "free",
            deliveryFeeAmount: String(data.deliveryFeeAmount || "0"),
            deliveryFreeAbove: String(data.deliveryFreeAbove || "0"),
            defaultTheme: data.defaultTheme || "dark",
            tableCount: String(data.tableCount || 10),
          })
          setAsaasMode(data.interClientId ? "card_only" : "both")
          if (data.paymentConfig) {
            try { setPaymentConfig(JSON.parse(data.paymentConfig)) } catch {}
          }
          if (data.orderConfig) {
            try { setOrderConfig(prev => ({ ...prev, ...JSON.parse(data.orderConfig) })) } catch {}
          }
          if (data.businessHours) {
            try { setBusinessHours(JSON.parse(data.businessHours)) } catch {}
          }
        }
      })
  }, [establishmentId])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)

    try {
      const res = await fetchAuth(`/api/establishments/${establishmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          paymentProvider: asaasMode === "card_only" ? "inter" : "asaas",
          deliveryFeeAmount: form.deliveryFeeType === "free" ? 0 : Number(form.deliveryFeeAmount),
          deliveryFreeAbove: form.deliveryFeeType === "free_above" ? Number(form.deliveryFreeAbove) : 0,
          paymentConfig: JSON.stringify(paymentConfig),
          orderConfig: JSON.stringify(orderConfig),
          businessHours: JSON.stringify(businessHours),
          defaultTheme: form.defaultTheme,
          tableCount: Number(form.tableCount) || 10,
        }),
      })

      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function testAsaasConnection() {
    if (!form.asaasApiKey) {
      setAsaasTestResult({ ok: false, message: "Insira uma API Key primeiro" })
      return
    }
    setTestingAsaas(true)
    setAsaasTestResult(null)
    try {
      const res = await fetchAuth(`/api/asaas-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: form.asaasApiKey }),
      })
      const data = await res.json()
      setAsaasTestResult(data.ok ? { ok: true, message: data.message } : { ok: false, message: data.error || "Falha na conexão" })
    } catch {
      setAsaasTestResult({ ok: false, message: "Erro ao conectar com o servidor" })
    } finally {
      setTestingAsaas(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="text-2xl font-bold text-zinc-900">Configurações</h2>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Dados do Estabelecimento */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">Dados do Estabelecimento</h3>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700">Nome</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700">WhatsApp (com DDD)</label>
              <input
                type="text"
                placeholder="11999999999"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700">Categoria</label>
              <div className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700">
                {categories.find((c) => c.value === form.category)?.label || form.category || "—"}
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700">Endereço</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700">Descrição do estabelecimento</label>
              <textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex: Os melhores sorvetes da cidade!"
                rows={2}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none resize-none"
              />
              <p className="text-xs text-zinc-400">Aparece no cardápio, mesa e frente de caixa</p>
            </div>
          </CardContent>
        </Card>

        {/* Pagamentos */}
        <Card>
          <CardContent className="p-6 space-y-5">
            <div>
              <h3 className="font-semibold text-zinc-900">Pagamentos</h3>
              <p className="text-sm text-zinc-500">
                Configure como deseja receber pagamentos no cardápio online.
              </p>
            </div>

            {/* Asaas - Provider obrigatório */}
            <div className="rounded-xl border border-zinc-200 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-zinc-900">Asaas</h4>
                <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">Obrigatório</span>
              </div>
              <p className="text-xs text-zinc-500">
                Provider de pagamentos para cartão de crédito e PIX.
              </p>

              {/* Modo */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAsaasMode("both")}
                  className={`flex-1 rounded-lg border-2 p-3 text-left transition-all ${
                    asaasMode === "both"
                      ? "border-green-500 bg-green-50"
                      : "border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${asaasMode === "both" ? "border-green-600" : "border-zinc-300"}`}>
                      {asaasMode === "both" && <div className="h-2 w-2 rounded-full bg-green-600" />}
                    </div>
                    <span className="text-sm font-medium text-zinc-900">PIX + Cartão</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1 ml-6">Tudo via Asaas</p>
                </button>
                <button
                  type="button"
                  onClick={() => setAsaasMode("card_only")}
                  className={`flex-1 rounded-lg border-2 p-3 text-left transition-all ${
                    asaasMode === "card_only"
                      ? "border-green-500 bg-green-50"
                      : "border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${asaasMode === "card_only" ? "border-green-600" : "border-zinc-300"}`}>
                      {asaasMode === "card_only" && <div className="h-2 w-2 rounded-full bg-green-600" />}
                    </div>
                    <span className="text-sm font-medium text-zinc-900">Somente Cartão</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1 ml-6">PIX via Banco Inter</p>
                </button>
              </div>

              {/* Campos Asaas */}
              <div className="relative">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">API Key</label>
                  <input
                    type={showKey ? "text" : "password"}
                    placeholder="asaas_api_key_..."
                    value={form.asaasApiKey}
                    onChange={(e) => { setForm({ ...form, asaasApiKey: e.target.value }); setAsaasTestResult(null) }}
                    className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
                <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-8 text-zinc-400 hover:text-zinc-400">
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-zinc-700">Wallet ID</label>
                <input
                  type="text"
                  placeholder="Identificação da carteira"
                  value={form.asaasWalletId}
                  onChange={(e) => setForm({ ...form, asaasWalletId: e.target.value })}
                  className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={testAsaasConnection} disabled={testingAsaas || !form.asaasApiKey} className="gap-2">
                  {testingAsaas ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                  Testar conexão
                </Button>
                {asaasTestResult && (
                  <span className={`flex items-center gap-1.5 text-sm font-medium ${asaasTestResult.ok ? "text-green-600" : "text-red-500"}`}>
                    {asaasTestResult.ok ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {asaasTestResult.message}
                  </span>
                )}
              </div>
            </div>

            {/* Banco Inter - aparece só quando "Somente Cartão" */}
            {asaasMode === "card_only" && (
              <div className="rounded-xl border border-green-200 bg-green-50/50 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-zinc-900">Banco Inter</h4>
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">PIX 0% taxa</span>
                </div>
                <div className="rounded-lg bg-green-100/70 px-3 py-2 text-xs text-green-800">
                  PIX será via Banco Inter, sem taxa. Cartão continua via Asaas.
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Client ID</label>
                  <input
                    type="text"
                    placeholder="Client ID do Inter"
                    value={form.interClientId}
                    onChange={(e) => setForm({ ...form, interClientId: e.target.value })}
                    className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Client Secret</label>
                  <input
                    type="password"
                    placeholder="Client Secret do Inter"
                    value={form.interClientSecret}
                    onChange={(e) => setForm({ ...form, interClientSecret: e.target.value })}
                    className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Chave PIX</label>
                  <input
                    type="text"
                    placeholder="CPF, CNPJ, email ou aleatória"
                    value={form.interPixKey}
                    onChange={(e) => setForm({ ...form, interPixKey: e.target.value })}
                    className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Certificado (.p12)</label>
                  <input
                    type="file"
                    accept=".p12,.pfx"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = () => {
                        const base64 = (reader.result as string).split(",")[1]
                        setForm({ ...form, interCertificate: base64 })
                      }
                      reader.readAsDataURL(file)
                    }}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                  />
                  {form.interCertificate ? (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      Certificado carregado e pronto para salvar
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-400">Nenhum certificado selecionado</p>
                  )}
                  <p className="text-xs text-zinc-400">Baixe no Internet Banking → Soluções → Nova Integração</p>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Senha do Certificado</label>
                  <input
                    type="password"
                    placeholder="Senha do .p12"
                    value={form.interCertificatePassword}
                    onChange={(e) => setForm({ ...form, interCertificatePassword: e.target.value })}
                    className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tipos de Pedido */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">Tipos de Pedido</h3>
            <p className="text-sm text-zinc-500">Habilite ou desabilite os tipos de pedido disponíveis no cardápio.</p>
            <div className="space-y-3">
              <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-100">
                <input type="checkbox" checked={orderConfig.delivery} onChange={(e) => setOrderConfig({ ...orderConfig, delivery: e.target.checked })} className="h-5 w-5 rounded border-white/[.08] text-green-600 focus:ring-green-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <Bike className="h-4 w-4 text-zinc-400" />
                    <span className="font-medium text-zinc-900">Entrega</span>
                  </div>
                  <p className="text-xs text-zinc-500">Cliente recebe em casa</p>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-100">
                <input type="checkbox" checked={orderConfig.pickup} onChange={(e) => setOrderConfig({ ...orderConfig, pickup: e.target.checked })} className="h-5 w-5 rounded border-white/[.08] text-green-600 focus:ring-green-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-zinc-400" />
                    <span className="font-medium text-zinc-900">Retirada</span>
                  </div>
                  <p className="text-xs text-zinc-500">Cliente busca no local</p>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Configuração de Mesas */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">Mesas</h3>
            <p className="text-sm text-zinc-500">Quantidade de mesas fixas disponíveis no caixa. As mesas são numeradas de 1 a N.</p>
            <div>
              <label className="text-sm font-medium text-zinc-700">Número de Mesas</label>
              <input
                type="number"
                min="1"
                max="100"
                value={form.tableCount}
                onChange={(e) => setForm({ ...form, tableCount: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm focus:border-green-600 focus:outline-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Taxa de Serviço */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">Taxa de Serviço</h3>
            <p className="text-sm text-zinc-500">Cobrança adicional sobre o subtotal. Só se aplica a vendas presenciais em mesa.</p>
            
            <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-100">
              <input
                type="checkbox"
                checked={orderConfig.serviceTaxEnabled}
                onChange={(e) => setOrderConfig({ ...orderConfig, serviceTaxEnabled: e.target.checked })}
                className="h-5 w-5 rounded border-white/[.08] text-green-600 focus:ring-green-500"
              />
              <div>
                <span className="font-medium text-zinc-900">Cobrar taxa de serviço</span>
                <p className="text-xs text-zinc-500">Aparece separado na conta do cliente</p>
              </div>
            </label>

            {orderConfig.serviceTaxEnabled && (
              <div className="space-y-4 rounded-lg bg-zinc-50 p-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">Tipo</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setOrderConfig({ ...orderConfig, serviceTaxType: "percent" })}
                      className={`flex-1 rounded-lg border-2 p-3 text-sm font-medium transition-all ${
                        orderConfig.serviceTaxType === "percent"
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                      }`}
                    >
                      Percentual (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderConfig({ ...orderConfig, serviceTaxType: "fixed" })}
                      className={`flex-1 rounded-lg border-2 p-3 text-sm font-medium transition-all ${
                        orderConfig.serviceTaxType === "fixed"
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                      }`}
                    >
                      Valor fixo (R$)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-zinc-700">
                    {orderConfig.serviceTaxType === "percent" ? "Percentual" : "Valor (R$)"}
                  </label>
                  <input
                    type="number"
                    step={orderConfig.serviceTaxType === "percent" ? "1" : "0.01"}
                    min="0"
                    max={orderConfig.serviceTaxType === "percent" ? "100" : undefined}
                    value={orderConfig.serviceTaxValue}
                    onChange={(e) => setOrderConfig({ ...orderConfig, serviceTaxValue: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm focus:border-green-600 focus:outline-none"
                  />
                </div>

                <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 cursor-pointer hover:bg-white">
                  <input
                    type="checkbox"
                    checked={orderConfig.serviceTaxPresencial}
                    onChange={(e) => setOrderConfig({ ...orderConfig, serviceTaxPresencial: e.target.checked })}
                    className="h-4 w-4 rounded border-white/[.08] text-green-600 focus:ring-green-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-zinc-900">Aplicar em vendas presenciais (mesa)</span>
                    <p className="text-xs text-zinc-500">Não se aplica a balcão, delivery ou retirada</p>
                  </div>
                </label>

                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <p className="text-xs text-blue-700">
                    <strong>Exemplo:</strong> Subtotal R$ 80,00 {orderConfig.serviceTaxType === "percent" 
                      ? `+ ${orderConfig.serviceTaxValue}% (${orderConfig.serviceTaxType === "percent" ? `R$ ${(80 * orderConfig.serviceTaxValue / 100).toFixed(2)}` : `R$ ${orderConfig.serviceTaxValue.toFixed(2)}`}) = R$ ${(80 + (orderConfig.serviceTaxType === "percent" ? 80 * orderConfig.serviceTaxValue / 100 : orderConfig.serviceTaxValue)).toFixed(2)}`
                      : `+ R$ ${orderConfig.serviceTaxValue.toFixed(2)} = R$ ${(80 + orderConfig.serviceTaxValue).toFixed(2)}`}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Taxa de Entrega */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">Taxa de Entrega</h3>
            <p className="text-sm text-zinc-500">Configure como a taxa de entrega é calculada.</p>
            <div className="space-y-4">
              <div className="space-y-2">
                {[
                  { value: "free", label: "Grátis", desc: "Sem taxa de entrega" },
                  { value: "fixed", label: "Taxa fixa", desc: "Valor único por pedido" },
                  { value: "free_above", label: "Grátis acima de R$ X", desc: "Cobra taxa só em pedidos abaixo de um valor" },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-100">
                    <input
                      type="radio"
                      name="deliveryFeeType"
                      value={opt.value}
                      checked={form.deliveryFeeType === opt.value}
                      onChange={(e) => setForm({ ...form, deliveryFeeType: e.target.value })}
                      className="h-4 w-4 border-white/[.08] text-green-600 focus:ring-green-500"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-zinc-900">{opt.label}</span>
                      <p className="text-xs text-zinc-500">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              {form.deliveryFeeType !== "free" && (
                <div className="rounded-lg bg-zinc-50 p-4 space-y-3">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-zinc-700">Valor da taxa (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="5,00"
                      value={form.deliveryFeeAmount}
                      onChange={(e) => setForm({ ...form, deliveryFeeAmount: e.target.value })}
                      className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                    />
                  </div>
                  {form.deliveryFeeType === "free_above" && (
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-zinc-700">Grátis a partir de (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="50,00"
                        value={form.deliveryFreeAbove}
                        onChange={(e) => setForm({ ...form, deliveryFreeAbove: e.target.value })}
                        className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Formas de Pagamento */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">Formas de Pagamento</h3>
            <p className="text-sm text-zinc-500">Quais formas de pagamento o cliente vê na hora de fechar o pedido.</p>
            <div className="space-y-3">
              <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-100">
                <input type="checkbox" checked={paymentConfig.online} onChange={(e) => setPaymentConfig({ ...paymentConfig, online: e.target.checked })} className="h-5 w-5 rounded border-white/[.08] text-green-600 focus:ring-green-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-zinc-400" />
                    <span className="font-medium text-zinc-900">Online (Pix / Cartão)</span>
                  </div>
                  <p className="text-xs text-zinc-500">Cliente paga na hora via Asaas</p>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-100">
                <input type="checkbox" checked={paymentConfig.delivery} onChange={(e) => setPaymentConfig({ ...paymentConfig, delivery: e.target.checked })} className="h-5 w-5 rounded border-white/[.08] text-green-600 focus:ring-green-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-zinc-400" />
                    <span className="font-medium text-zinc-900">Pagar na Entrega</span>
                  </div>
                  <p className="text-xs text-zinc-500">Cliente paga em dinheiro/cartão na entrega</p>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-100">
                <input type="checkbox" checked={paymentConfig.pickup} onChange={(e) => setPaymentConfig({ ...paymentConfig, pickup: e.target.checked })} className="h-5 w-5 rounded border-white/[.08] text-green-600 focus:ring-green-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-zinc-400" />
                    <span className="font-medium text-zinc-900">Pagar na Retirada</span>
                  </div>
                  <p className="text-xs text-zinc-500">Cliente paga ao buscar</p>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Horário de Funcionamento */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="flex items-center gap-2 font-semibold text-zinc-900">
              <Clock className="h-4 w-4" />
              Horário de Funcionamento
            </h3>
            <p className="text-sm text-zinc-500">Configure os horários. Fora desse horário, o cardápio informa que está fechado.</p>
            <div className="space-y-2">
              {businessHours.map((h, i) => (
                <div key={h.day} className="flex items-center gap-3 rounded-lg border border-white/[.04] bg-zinc-50 p-3">
                  <label className="flex items-center gap-2 min-w-[120px]">
                    <input
                      type="checkbox"
                      checked={h.active}
                      onChange={(e) => {
                        const updated = [...businessHours]
                        updated[i] = { ...updated[i], active: e.target.checked }
                        setBusinessHours(updated)
                      }}
                      className="h-4 w-4 rounded border-white/[.08] text-green-600 focus:ring-green-500"
                    />
                    <span className={`text-sm font-medium ${h.active ? "text-zinc-900" : "text-zinc-400"}`}>{h.day?.trim()}</span>
                  </label>
                  {h.active ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={h.open}
                        onChange={(e) => {
                          const updated = [...businessHours]
                          updated[i] = { ...updated[i], open: e.target.value }
                          setBusinessHours(updated)
                        }}
                        className="rounded-lg border border-zinc-300 bg-zinc-50 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                      />
                      <span className="text-xs text-zinc-400">até</span>
                      <input
                        type="time"
                        value={h.close}
                        onChange={(e) => {
                          const updated = [...businessHours]
                          updated[i] = { ...updated[i], close: e.target.value }
                          setBusinessHours(updated)
                        }}
                        className="rounded-lg border border-zinc-300 bg-zinc-50 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-400">Fechado</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar alterações
          </Button>
          {saved && <span className="flex items-center gap-1 text-sm text-green-600"><Save className="h-4 w-4" />Salvo!</span>}
        </div>
      </form>
    </div>
  )
}
