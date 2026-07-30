"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Save, Loader2, Eye, EyeOff, CreditCard, Banknote, Bike, Store, Clock, Plug, CheckCircle, XCircle, Shield, MessageCircle } from "lucide-react"
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
    ifoodEnabled: false,
    ifoodMerchantId: "",
    deliveryFeeType: "free",
    deliveryFeeAmount: "0",
    deliveryFreeAbove: "0",
    defaultTheme: "dark",
    tableCount: "10",
    maxPayOnDeliveryAmount: "150",
    blockConcurrentPayOnDelivery: true,
  })

  const [asaasMode, setAsaasMode] = useState<"both" | "card_only">("both")
  const [paymentConfig, setPaymentConfig] = useState({ online: true, delivery: true, pickup: true })
  const [deliveryLimit, setDeliveryLimit] = useState("150")
  const [blockConcurrent, setBlockConcurrent] = useState(true)
  const [cancellationBlockEnabled, setCancellationBlockEnabled] = useState(false)
  const [cancellationBlockThreshold, setCancellationBlockThreshold] = useState("3")
  const [cancellationBlockWindowDays, setCancellationBlockWindowDays] = useState("7")
  const [cancellationBlockDurationDays, setCancellationBlockDurationDays] = useState("7")
  const [whatsappProvider, setWhatsappProvider] = useState<"evolution" | "meta" | null>(null)
  const [whatsappNumber, setWhatsappNumber] = useState("")
  const [evolutionBaseUrl, setEvolutionBaseUrl] = useState("")
  const [evolutionApiKey, setEvolutionApiKey] = useState("")
  const [evolutionInstanceName, setEvolutionInstanceName] = useState("")
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState("")
  const [metaAccessToken, setMetaAccessToken] = useState("")
  const [metaWebhookVerifyToken, setMetaWebhookVerifyToken] = useState("")
  const [botEnabled, setBotEnabled] = useState(false)
  const [botAgentName, setBotAgentName] = useState("Atendente")
  const [botGreeting, setBotGreeting] = useState("")
  const [botMenuOptions, setBotMenuOptions] = useState(`[{"id":"1","label":"Fazer Pedido","response":"menu"},{"id":"2","label":"Ver Cardápio","response":"cardapio"},{"id":"3","label":"Falar com Atendente","response":"atendente"}]`)
  const [botUseAI, setBotUseAI] = useState(false)
  const [botTone, setBotTone] = useState<"formal" | "casual" | "direct">("casual")
  const [botFAQ, setBotFAQ] = useState("")
  const [botSystemPrompt, setBotSystemPrompt] = useState("")
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
            ifoodEnabled: data.ifoodEnabled || false,
            ifoodMerchantId: data.ifoodMerchantId || "",
            interPixKey: data.interPixKey || "",
            deliveryFeeType: data.deliveryFeeType || "free",
            deliveryFeeAmount: String(data.deliveryFeeAmount || "0"),
            deliveryFreeAbove: String(data.deliveryFreeAbove || "0"),
            defaultTheme: data.defaultTheme || "dark",
            tableCount: String(data.tableCount || 10),
            maxPayOnDeliveryAmount: String(data.maxPayOnDeliveryAmount ?? 150),
            blockConcurrentPayOnDelivery: data.blockConcurrentPayOnDelivery ?? true,
          })
          setDeliveryLimit(String(data.maxPayOnDeliveryAmount ?? 150))
          setBlockConcurrent(data.blockConcurrentPayOnDelivery ?? true)
          setCancellationBlockEnabled(data.cancellationBlockEnabled ?? false)
          setCancellationBlockThreshold(String(data.cancellationBlockThreshold ?? 3))
          setCancellationBlockWindowDays(String(data.cancellationBlockWindowDays ?? 7))
          setCancellationBlockDurationDays(String(data.cancellationBlockDurationDays ?? 7))
          setWhatsappProvider(data.whatsappProvider ?? null)
          setWhatsappNumber(data.whatsappNumber || "")
          setEvolutionBaseUrl(data.evolutionBaseUrl || "")
          setEvolutionApiKey(data.evolutionApiKey || "")
          setEvolutionInstanceName(data.evolutionInstanceName || "")
          setMetaPhoneNumberId(data.metaPhoneNumberId || "")
          setMetaAccessToken(data.metaAccessToken || "")
          setMetaWebhookVerifyToken(data.metaWebhookVerifyToken || "")
          setBotEnabled(data.botEnabled ?? false)
          setBotAgentName(data.botAgentName || "Atendente")
          setBotGreeting(data.botGreeting || "")
          setBotMenuOptions(data.botMenuOptions || `[{"id":"1","label":"Fazer Pedido","response":"menu"},{"id":"2","label":"Ver Cardápio","response":"cardapio"},{"id":"3","label":"Falar com Atendente","response":"atendente"}]`)
          setBotUseAI(data.botUseAI ?? false)
          setBotTone(data.botTone || "casual")
          setBotFAQ(data.botFAQ || "")
          setBotSystemPrompt(data.botSystemPrompt || "")
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
          maxPayOnDeliveryAmount: Number(deliveryLimit) || 150,
          blockConcurrentPayOnDelivery: blockConcurrent,
          cancellationBlockEnabled,
          cancellationBlockThreshold: Number(cancellationBlockThreshold) || 3,
          cancellationBlockWindowDays: Number(cancellationBlockWindowDays) || 7,
          cancellationBlockDurationDays: Number(cancellationBlockDurationDays) || 7,
          whatsappProvider,
          whatsappNumber,
          evolutionBaseUrl,
          evolutionApiKey,
          evolutionInstanceName,
          metaPhoneNumberId,
          metaAccessToken,
          metaWebhookVerifyToken,
          botEnabled,
          botAgentName,
          botGreeting,
          botMenuOptions,
          botUseAI,
          botTone,
          botFAQ,
          botSystemPrompt,
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

            {/* iFood */}
            <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-zinc-900">iFood</h4>
                <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">Em breve</span>
              </div>
              <p className="text-xs text-zinc-500">Integração com iFood para receber pedidos automaticamente.</p>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.ifoodEnabled || false}
                  onChange={(e) => setForm({ ...form, ifoodEnabled: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-300 text-orange-600 focus:ring-orange-500"
                />
                <span className="text-sm font-medium text-zinc-700">Ativar integração iFood</span>
              </div>
              {form.ifoodEnabled && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-zinc-500">Merchant ID</label>
                    <input
                      type="text"
                      placeholder="bd63685a-7c57-41c0-a52f-e6332cafcbd4"
                      value={form.ifoodMerchantId || ""}
                      onChange={(e) => setForm({ ...form, ifoodMerchantId: e.target.value })}
                      className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-orange-600 focus:outline-none"
                    />
                  </div>
                  <p className="text-xs text-zinc-400">Encontre o Merchant ID no painel do desenvolvedor iFood.</p>
                </div>
              )}
            </div>
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

        {/* Limite de Pagamento na Entrega */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">Limite de Pagamento na Entrega</h3>
            <p className="text-sm text-zinc-500">Defina um valor máximo para pedidos pagos na entrega. Pedidos acima desse valor só podem ser pagos online.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700">Valor máximo (R$)</label>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">R$</span>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={deliveryLimit}
                    onChange={(e) => setDeliveryLimit(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-10 pr-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
                <p className="mt-1 text-xs text-zinc-400">Pedidos acima desse valor só podem ser pagos online. Use 0 para desabilitar a entrega.</p>
              </div>
              <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-100">
                <input
                  type="checkbox"
                  checked={blockConcurrent}
                  onChange={(e) => setBlockConcurrent(e.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-white/[.08] text-green-600 focus:ring-green-500"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-zinc-400" />
                    <span className="font-medium text-zinc-900">Bloquear segundo pedido na entrega</span>
                  </div>
                  <p className="text-xs text-zinc-500">Enquanto um pedido na entrega está em andamento (pendente, confirmado, preparando ou pronto), o cliente só pode fazer novos pedidos com pagamento online.</p>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Bloqueio por cancelamentos */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">Bloqueio por cancelamentos</h3>
            <p className="text-sm text-zinc-500">Quando um cliente cancela pedidos com frequência, o pagamento na entrega é bloqueado automaticamente. Pedidos online (PIX/Cartão) continuam liberados.</p>
            <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-100">
              <input
                type="checkbox"
                checked={cancellationBlockEnabled}
                onChange={(e) => setCancellationBlockEnabled(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-white/[.08] text-green-600 focus:ring-green-500"
              />
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-zinc-400" />
                  <span className="font-medium text-zinc-900">Ativar bloqueio automático</span>
                </div>
                <p className="text-xs text-zinc-500">Recomendado para reduzir cancelamentos abusivos no pagamento na entrega.</p>
              </div>
            </label>
            <div className={`grid grid-cols-1 gap-4 sm:grid-cols-3 ${cancellationBlockEnabled ? "" : "opacity-50 pointer-events-none"}`}>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Nº de cancelamentos (N)</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={cancellationBlockThreshold}
                  onChange={(e) => setCancellationBlockThreshold(e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none"
                />
                <p className="mt-1 text-xs text-zinc-400">Quantos cancelamentos disparam o bloqueio.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Janela (X dias)</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={cancellationBlockWindowDays}
                  onChange={(e) => setCancellationBlockWindowDays(e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none"
                />
                <p className="mt-1 text-xs text-zinc-400">Período em que os cancelamentos são contados.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Bloqueio (Y dias)</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={cancellationBlockDurationDays}
                  onChange={(e) => setCancellationBlockDurationDays(e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none"
                />
                <p className="mt-1 text-xs text-zinc-400">Por quantos dias o pagamento na entrega fica bloqueado.</p>
              </div>
            </div>
            <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-3 text-xs text-zinc-600">
              <strong>Exemplo:</strong> com N={cancellationBlockThreshold}, X={cancellationBlockWindowDays} e Y={cancellationBlockDurationDays},
              um cliente que cancelar {cancellationBlockThreshold} pedidos em {cancellationBlockWindowDays} dias
              ficará impedido de pagar na entrega por {cancellationBlockDurationDays} dias.
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp + Bot */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">WhatsApp & Bot de Atendimento</h3>
            <p className="text-sm text-zinc-500">Configure o WhatsApp e o bot de atendimento automático. Quando ativado, o bot responde clientes com um menu de opções.</p>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700">Provedor WhatsApp</label>
              <select
                value={whatsappProvider || ""}
                onChange={(e) => setWhatsappProvider(e.target.value === "" ? null : (e.target.value as "evolution" | "meta"))}
                className="flex h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none"
              >
                <option value="">Desabilitado</option>
                <option value="evolution">Evolution API</option>
                <option value="meta">Meta Cloud (em breve)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700">Número WhatsApp (com DDD)</label>
              <input
                type="text"
                placeholder="5511999999999"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, ""))}
                className="flex h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
              />
              <p className="text-xs text-zinc-400">Formato: 55 (Brasil) + DDD + número. Ex: 5511999999999</p>
            </div>

            {whatsappProvider === "evolution" && (
              <div className="space-y-3 rounded-lg border border-zinc-200 p-4">
                <h4 className="text-sm font-semibold text-zinc-700">Evolution API</h4>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">URL Base</label>
                  <input
                    type="text"
                    placeholder="https://sua-evolution.up.railway.app"
                    value={evolutionBaseUrl}
                    onChange={(e) => setEvolutionBaseUrl(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">API Key</label>
                  <input
                    type="text"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={evolutionApiKey}
                    onChange={(e) => setEvolutionApiKey(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Nome da Instância</label>
                  <input
                    type="text"
                    placeholder="minha-loja"
                    value={evolutionInstanceName}
                    onChange={(e) => setEvolutionInstanceName(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
                <p className="text-xs text-zinc-400">Webhook para configurar na Evolution: <code>https://seu-dominio.com/api/webhooks/whatsapp</code></p>
              </div>
            )}

            {whatsappProvider === "meta" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm text-amber-900">⚠️ Integração Meta Cloud oficial está em desenvolvimento. Use Evolution API por enquanto.</p>
              </div>
            )}

            {whatsappProvider && (
              <>
                <div className="border-t border-zinc-200 pt-4 space-y-3">
                  <h4 className="text-sm font-semibold text-zinc-700">Bot de Atendimento</h4>

                  <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-100">
                    <input
                      type="checkbox"
                      checked={botEnabled}
                      onChange={(e) => setBotEnabled(e.target.checked)}
                      className="mt-1 h-5 w-5 rounded border-white/[.08] text-green-600 focus:ring-green-500"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-zinc-400" />
                        <span className="font-medium text-zinc-900">Ativar bot automático</span>
                      </div>
                      <p className="text-xs text-zinc-500">Quando ativado, o bot responde clientes automaticamente com o menu de opções.</p>
                    </div>
                  </label>

                  <div className={`space-y-3 ${botEnabled ? "" : "opacity-50 pointer-events-none"}`}>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700">Nome do atendente</label>
                      <input
                        type="text"
                        placeholder="Atendente"
                        value={botAgentName}
                        onChange={(e) => setBotAgentName(e.target.value)}
                        className="mt-1 flex h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-700">Mensagem de saudação</label>
                      <textarea
                        placeholder="Olá! Eu sou a Sofia, atendente virtual da Pizzaria do João."
                        value={botGreeting}
                        onChange={(e) => setBotGreeting(e.target.value)}
                        rows={2}
                        className="mt-1 flex w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                      />
                      <p className="mt-1 text-xs text-zinc-400">Deixe vazio para usar mensagem padrão.</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-700">Opções do menu (JSON)</label>
                      <textarea
                        value={botMenuOptions}
                        onChange={(e) => setBotMenuOptions(e.target.value)}
                        rows={6}
                        className="mt-1 flex w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-mono text-zinc-700 focus:border-green-600 focus:outline-none"
                      />
                      <p className="mt-1 text-xs text-zinc-400">Formato: array de objetos com <code>id</code>, <code>label</code> e <code>response</code> (menu, cardapio, atendente ou texto livre).</p>
                    </div>

                    <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-100">
                      <input
                        type="checkbox"
                        checked={botUseAI}
                        onChange={(e) => setBotUseAI(e.target.checked)}
                        className="mt-1 h-5 w-5 rounded border-white/[.08] text-green-600 focus:ring-green-500"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-zinc-400" />
                          <span className="font-medium text-zinc-900">Usar IA pra mensagens livres</span>
                        </div>
                        <p className="text-xs text-zinc-500">Quando ligado, o bot usa IA pra responder perguntas em linguagem natural. Menu numerado continua funcionando como atalho.</p>
                      </div>
                    </label>

                    {botUseAI && (
                      <div className="space-y-3 rounded-lg border border-zinc-200 p-4">
                        <div>
                          <label className="block text-sm font-medium text-zinc-700">Tom de voz</label>
                          <select
                            value={botTone}
                            onChange={(e) => setBotTone(e.target.value as "formal" | "casual" | "direct")}
                            className="mt-1 flex h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none"
                          >
                            <option value="casual">Descontraído (amigável, usa emojis)</option>
                            <option value="formal">Formal (educado, senhor/senhora)</option>
                            <option value="direct">Direto (objetivo, sem enrolação)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-zinc-700">FAQ / Regras da casa</label>
                          <textarea
                            placeholder="Ex: Temos estacionamento próprio. Não aceitamos troco para R$ 100. Delivery só até 22h."
                            value={botFAQ}
                            onChange={(e) => setBotFAQ(e.target.value)}
                            rows={4}
                            className="mt-1 flex w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                          />
                          <p className="mt-1 text-xs text-zinc-400">Regras específicas do seu estabelecimento que a IA deve considerar.</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-zinc-700">Prompt customizado (avançado)</label>
                          <textarea
                            placeholder="Instruções extras que concatenam com o prompt mestre. Opcional."
                            value={botSystemPrompt}
                            onChange={(e) => setBotSystemPrompt(e.target.value)}
                            rows={3}
                            className="mt-1 flex w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-mono text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                          />
                          <p className="mt-1 text-xs text-zinc-400">Adicionado ao final do prompt do sistema. Use com cuidado.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
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
