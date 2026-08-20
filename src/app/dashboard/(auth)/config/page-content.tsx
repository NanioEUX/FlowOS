"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Save, Loader2, Eye, EyeOff, CreditCard, Banknote, Bike, Store, Clock, Plug, CheckCircle, XCircle, Shield, MessageCircle, ArrowUp, Unplug } from "lucide-react"
import { EmbeddedSignupButton } from "@/components/meta-embedded-signup"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { fetchAuth } from "@/lib/fetch-auth"
import { formatCurrency } from "@/lib/utils"

const categories = [
  { value: "restaurante", label: "Restaurant" },
  { value: "pizzaria", label: "Pizzeria" },
  { value: "hamburgueria", label: "Burger Joint" },
  { value: "lanchonete", label: "Snack Bar" },
  { value: "padaria", label: "Bakery / Patisserie" },
  { value: "sorveteria", label: "Ice Cream / Acai" },
  { value: "petiscaria", label: "Gastropub / Bar" },
  { value: "japonesa", label: "Japanese Food" },
  { value: "brasileira", label: "Brazilian Food" },
  { value: "outro", label: "Other" },
]

function WhatsAppConnection({
  establishmentId,
  evolutionBaseUrl,
  evolutionApiKey,
  evolutionInstanceName,
  whatsappNumber,
  onNumberDetected,
}: {
  establishmentId: string
  evolutionBaseUrl: string
  evolutionApiKey: string
  evolutionInstanceName: string
  whatsappNumber: string
  onNumberDetected: (number: string) => void
}) {
  const [status, setStatus] = useState<"open" | "connecting" | "close" | "loading">("loading")
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [pairingCode, setPairingCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const statusRef = useRef(status)

  useEffect(() => {
    statusRef.current = status
  }, [status])

  const checkStatus = async () => {
    try {
      const res = await fetchAuth(`/api/establishments/${establishmentId}/whatsapp-status`)
      const data = await res.json()
      if (data.state) setStatus(data.state)
      if (data.number && !whatsappNumber) onNumberDetected(data.number)
    } catch {
      setStatus("close")
    }
  }

  useEffect(() => {
    checkStatus()
    const interval = setInterval(() => {
      if (statusRef.current === "connecting" || statusRef.current === "open") {
        checkStatus()
      }
    }, 3000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establishmentId])

  const handleConnect = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchAuth(`/api/establishments/${establishmentId}/whatsapp-connect`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Connection error")
        return
      }
      if (data.state === "open") {
        setStatus("open")
        if (data.number) onNumberDetected(data.number)
      } else if (data.qrcode) {
        setStatus("connecting")
        setQrCode(data.qrcode.base64 || null)
        setPairingCode(data.qrcode.pairingCode || data.qrcode.code || null)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm("Desconectar WhatsApp? O bot vai parar de responder.")) return
    setLoading(true)
    try {
      await fetchAuth(`/api/establishments/${establishmentId}/whatsapp-disconnect`, {
        method: "POST",
      })
      setStatus("close")
      setQrCode(null)
      setPairingCode(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (status === "loading") {
    return (
      <div className="rounded-lg border border-zinc-200 p-4 text-center text-sm text-zinc-500">
        Verificando conexão...
      </div>
    )
  }

  if (status === "open") {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">
                ✓ CONNECTED
                </span>
                {whatsappNumber && (
                  <span className="text-sm font-medium text-green-900">
                    {whatsappNumber}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-green-700">
                WhatsApp ativo e respondendo mensagens automaticamente.
              </p>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200 disabled:opacity-50"
            >
              {loading ? "Desconectando..." : "Desconectar"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (status === "connecting" && qrCode) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
              ⏳ AGUARDANDO CONEXÃO
            </span>
          </div>
          <p className="mt-2 text-xs text-amber-900">
            Escaneie o QR Code abaixo com o WhatsApp do seu celular:
          </p>
          <ol className="mt-2 list-decimal pl-5 text-xs text-amber-900 space-y-0.5">
            <li>Abra o WhatsApp no celular</li>
            <li>Configurações (⚙️) → Aparelhos conectados</li>
            <li>Toque em &ldquo;Conectar um aparelho&rdquo;</li>
            <li>Aponte a câmera para o QR Code</li>
          </ol>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4">
          <img src={qrCode} alt="QR Code WhatsApp" className="h-64 w-64" />
          {pairingCode && (
            <div className="text-center">
              <p className="text-xs text-zinc-500">Ou use o código de pareamento:</p>
              <code className="mt-1 block rounded bg-zinc-100 px-3 py-1 text-sm font-mono">{pairingCode}</code>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900">
          {error}
        </div>
      )}
      <div className="rounded-lg border border-zinc-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-900">WhatsApp desconectado</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Clique no botão pra gerar o QR Code e conectar.
            </p>
          </div>
          <button
            onClick={handleConnect}
            disabled={loading}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Conectando..." : "Conectar WhatsApp"}
          </button>
        </div>
      </div>
    </div>
  )
}

function MetaConfig({
  establishmentId,
  metaPhoneNumberId,
  metaAccessToken,
}: {
  establishmentId: string | null
  metaPhoneNumberId: string
  metaAccessToken: string
}) {
  const [disconnecting, setDisconnecting] = useState(false)
  const isConnected = !!metaAccessToken && !!metaPhoneNumberId

  const handleDisconnect = async () => {
    if (!establishmentId) return
    if (!confirm("Disconnect Meta WhatsApp? The bot will stop responding.")) return
    setDisconnecting(true)
    try {
      await fetchAuth(`/api/establishments/${establishmentId}/meta-connect`, {
        method: "DELETE",
      })
      window.location.reload()
    } catch (e: any) {
      alert("Error disconnecting: " + e.message)
    } finally {
      setDisconnecting(false)
    }
  }

  if (isConnected) {
    return (
      <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">
                ✓ CONECTADO
              </span>
              <span className="text-sm font-medium text-green-900">{metaPhoneNumberId}</span>
            </div>
            <p className="mt-1 text-xs text-green-700">
              Meta Cloud API active via Embedded Signup.
            </p>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200 disabled:opacity-50"
          >
            {disconnecting ? "Disconnecting..." : "Disconnect"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 p-4">
      <h4 className="text-sm font-semibold text-zinc-700">Meta Cloud API</h4>
      <p className="text-xs text-zinc-500">
        Connect your Meta account to use the WhatsApp Cloud API. You'll log in with your Facebook account and Meta configures everything automatically.
      </p>
      <EmbeddedSignupButton />
    </div>
  )
}

export default function ConfigPage() {
  const searchParams = useSearchParams()
  const hookEstablishmentId = useEstablishmentId()
  const searchParamsEstablishmentId = searchParams.get("establishment")
  const establishmentId = searchParamsEstablishmentId || hookEstablishmentId

  const [isSaasAdmin, setIsSaasAdmin] = useState(false)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("pedefacil-user")
      if (stored) {
        const u = JSON.parse(stored)
        if (u.role === "saas_admin") setIsSaasAdmin(true)
      }
    } catch {}
  }, [])

  const SaasOnly = ({ children }: { children: React.ReactNode }) => isSaasAdmin ? <>{children}</> : null
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
    estimatedDeliveryMin: "30",
    estimatedDeliveryMax: "45",
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
  // Bot v2
  const [botInactivityEnabled, setBotInactivityEnabled] = useState(true)
  const [botInactivityMinutes, setBotInactivityMinutes] = useState("10")
  const [botInactivityMessage, setBotInactivityMessage] = useState("Se precisar de algo mais, é só chamar! 😊")
  const [botTransferEnabled, setBotTransferEnabled] = useState(true)
  const [botTransferKeywords, setBotTransferKeywords] = useState("atendente,humano,pessoa,recepcao,recepção")
  const [botTransferMessage, setBotTransferMessage] = useState("Vou chamar um atendente para te ajudar. Só um momento! 🙏")
  const [botTypingDelayMinMs, setBotTypingDelayMinMs] = useState("1500")
  const [botTypingDelayMaxMs, setBotTypingDelayMaxMs] = useState("3500")
  const [botRespectBusinessHours, setBotRespectBusinessHours] = useState(false)
  const [botOutsideHoursMode, setBotOutsideHoursMode] = useState<"closed" | "scheduled">("closed")
  const [botOutsideHoursMessage, setBotOutsideHoursMessage] = useState("Estamos fechados no momento. Nosso horário de atendimento é:")
  const [botAcceptsScheduledOrders, setBotAcceptsScheduledOrders] = useState(false)
  const [botScheduledOrderMessage, setBotScheduledOrderMessage] = useState("Aceito pedidos para agendamento! É só me dizer o que quer e pra quando. 😊")
  const [botFallbackMessage, setBotFallbackMessage] = useState("Não entendi muito bem 🤔 Pode me explicar com outras palavras?")
  const [botTemplateOrderConfirmed, setBotTemplateOrderConfirmed] = useState("✅ Pedido confirmado! Já estamos preparando. Prazo estimado: 30-45 min.")
  const [botTemplateOrderPreparing, setBotTemplateOrderPreparing] = useState("👨‍🍳 Seu pedido está sendo preparado!")
  const [botTemplateOrderReady, setBotTemplateOrderReady] = useState("🛎️ Seu pedido está pronto!")
  const [botTemplateOrderDelivering, setBotTemplateOrderDelivering] = useState("🛵 Seu pedido saiu para entrega! Previsão de chegada: 20-30 min.")
  const [botTemplateOrderDelivered, setBotTemplateOrderDelivered] = useState("🎉 Pedido entregue! Bom apetite e obrigado pela preferência! ❤️")
  const [botTemplateOrderCancelled, setBotTemplateOrderCancelled] = useState("❌ Seu pedido foi cancelado. Se precisar de algo, estou aqui!")
  const [botTemplateOrderScheduled, setBotTemplateOrderScheduled] = useState("📅 Pedido agendado confirmado! Te esperamos no dia {data} às {hora}. Obrigado!")
  // Verificação por código: lembrete automático
  const [verifyReminderEnabled, setVerifyReminderEnabled] = useState(false)
  const [verifyReminderDelayMin, setVerifyReminderDelayMin] = useState("60")
  const [verifyReminderMessage, setVerifyReminderMessage] = useState("")
  // Agendamento de pedidos
  const [scheduledMinHours, setScheduledMinHours] = useState("24")
  const [scheduledPrepMinutes, setScheduledPrepMinutes] = useState("60")
  const [scheduledMaxAdvanceDays, setScheduledMaxAdvanceDays] = useState("30")
  const [whatsappAutomationEnabled, setWhatsappAutomationEnabled] = useState(false)
  const [aiMessagesUsed, setAiMessagesUsed] = useState(0)
  const [aiMessagesLimit, setAiMessagesLimit] = useState(1000)
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
            estimatedDeliveryMin: String(data.estimatedDeliveryMin || 30),
            estimatedDeliveryMax: String(data.estimatedDeliveryMax || 45),
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
          setBotInactivityEnabled(data.botInactivityEnabled ?? true)
          setBotInactivityMinutes(String(data.botInactivityMinutes ?? 10))
          setBotInactivityMessage(data.botInactivityMessage || "Se precisar de algo mais, é só chamar! 😊")
          setBotTransferEnabled(data.botTransferEnabled ?? true)
          setBotTransferKeywords(data.botTransferKeywords || "atendente,humano,pessoa,recepcao,recepção")
          setBotTransferMessage(data.botTransferMessage || "Vou chamar um atendente para te ajudar. Só um momento! 🙏")
          setBotTypingDelayMinMs(String(data.botTypingDelayMinMs ?? 1500))
          setBotTypingDelayMaxMs(String(data.botTypingDelayMaxMs ?? 3500))
          setBotRespectBusinessHours(data.botRespectBusinessHours ?? false)
          setBotOutsideHoursMode(data.botOutsideHoursMode || "closed")
          setBotOutsideHoursMessage(data.botOutsideHoursMessage || "Estamos fechados no momento. Nosso horário de atendimento é:")
          setBotAcceptsScheduledOrders(data.botAcceptsScheduledOrders ?? false)
          setBotScheduledOrderMessage(data.botScheduledOrderMessage || "Aceito pedidos para agendamento! É só me dizer o que quer e pra quando. 😊")
          setVerifyReminderEnabled(data.verifyReminderEnabled ?? false)
          setVerifyReminderDelayMin(String(data.verifyReminderDelayMin ?? 60))
          setVerifyReminderMessage(data.verifyReminderMessage || "Olá {{nome}}! Você iniciou a verificação de cadastro no {{estabelecimento}} mas não concluiu. Para finalizar, volte ao cardápio e solicite um novo código. 😊")
          setBotFallbackMessage(data.botFallbackMessage || "Não entendi muito bem 🤔 Pode me explicar com outras palavras?")
          setBotTemplateOrderConfirmed(data.botTemplateOrderConfirmed || "✅ Pedido confirmado! Já estamos preparando. Prazo estimado: 30-45 min.")
          setBotTemplateOrderPreparing(data.botTemplateOrderPreparing || "👨‍🍳 Seu pedido está sendo preparado!")
          setBotTemplateOrderReady(data.botTemplateOrderReady || "🛎️ Seu pedido está pronto!")
          setBotTemplateOrderDelivering(data.botTemplateOrderDelivering || "🛵 Seu pedido saiu para entrega! Previsão de chegada: 20-30 min.")
          setBotTemplateOrderDelivered(data.botTemplateOrderDelivered || "🎉 Pedido entregue! Bom apetite e obrigado pela preferência! ❤️")
          setBotTemplateOrderCancelled(data.botTemplateOrderCancelled || "❌ Seu pedido foi cancelado. Se precisar de algo, estou aqui!")
          setBotTemplateOrderScheduled(data.botTemplateOrderScheduled || "📅 Pedido agendado confirmado! Te esperamos no dia {data} às {hora}. Obrigado!")
          setScheduledMinHours(String(data.scheduledMinHours ?? 24))
          setScheduledPrepMinutes(String(data.scheduledPrepMinutes ?? 60))
          setScheduledMaxAdvanceDays(String(data.scheduledMaxAdvanceDays ?? 30))
          setWhatsappAutomationEnabled(data.whatsappAutomationEnabled ?? false)
          setAiMessagesUsed(data.aiMessagesUsed || 0)
          setAiMessagesLimit(data.aiMessagesLimit || 1000)
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
          estimatedDeliveryMin: Number(form.estimatedDeliveryMin) || 30,
          estimatedDeliveryMax: Number(form.estimatedDeliveryMax) || 45,
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
          botInactivityEnabled,
          botInactivityMinutes: Number(botInactivityMinutes) || 10,
          botInactivityMessage,
          botTransferEnabled,
          botTransferKeywords,
          botTransferMessage,
          botTypingDelayMinMs: Number(botTypingDelayMinMs) || 1500,
          botTypingDelayMaxMs: Number(botTypingDelayMaxMs) || 3500,
          botRespectBusinessHours,
          botOutsideHoursMode,
          botOutsideHoursMessage,
          botAcceptsScheduledOrders,
          botScheduledOrderMessage,
          verifyReminderEnabled,
          verifyReminderDelayMin: Number(verifyReminderDelayMin) || 60,
          verifyReminderMessage,
          botFallbackMessage,
          botTemplateOrderConfirmed,
          botTemplateOrderPreparing,
          botTemplateOrderReady,
          botTemplateOrderDelivering,
          botTemplateOrderDelivered,
          botTemplateOrderCancelled,
          botTemplateOrderScheduled,
          scheduledMinHours: Number(scheduledMinHours) || 24,
          scheduledPrepMinutes: Number(scheduledPrepMinutes) || 60,
          scheduledMaxAdvanceDays: Number(scheduledMaxAdvanceDays) || 30,
          whatsappAutomationEnabled,
          aiMessagesLimit,
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
      setAsaasTestResult({ ok: false, message: "Enter an API Key first" })
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
      setAsaasTestResult(data.ok ? { ok: true, message: data.message } : { ok: false, message: data.error || "Connection failed" })
    } catch {
      setAsaasTestResult({ ok: false, message: "Error connecting to server" })
    } finally {
      setTestingAsaas(false)
    }
  }

  const [activeGroup, setActiveGroup] = useState<"geral" | "pedidos" | "pagamentos" | "whatsapp">("geral")

  const groups = [
    { id: "geral" as const, label: "General", desc: "Details, hours & scheduling" },
    { id: "pedidos" as const, label: "Orders", desc: "Types, tables, fees & blocks" },
    { id: "pagamentos" as const, label: "Payments", desc: "Asaas, methods & limits" },
    { id: "whatsapp" as const, label: "WhatsApp & Bot", desc: "Connection & automation" },
  ]

  return (
    <div className="mx-auto max-w-5xl">
      <h2 className="mb-6 text-2xl font-bold text-zinc-900">Settings</h2>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6">
        <aside className="hidden lg:block">
          <nav className="sticky top-4 space-y-1">
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setActiveGroup(g.id)}
                className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                  activeGroup === g.id
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                <p className={`text-sm font-medium ${activeGroup === g.id ? "text-white" : "text-zinc-900"}`}>
                  {g.label}
                </p>
                <p className={`text-[10px] mt-0.5 ${activeGroup === g.id ? "text-zinc-300" : "text-zinc-500"}`}>
                  {g.desc}
                </p>
              </button>
            ))}
          </nav>
        </aside>

        <div>
          <div className="mb-4 lg:hidden">
            <select
              value={activeGroup}
              onChange={(e) => setActiveGroup(e.target.value as any)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
          </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Dados do Estabelecimento */}
        <Card id="section-dados" className={activeGroup !== "geral" ? "hidden" : ""}>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">Business Information</h3>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700">Phone Number</label>
              <input
                type="text"
                placeholder="11999999999"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700">Category</label>
              <div className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700">
                {categories.find((c) => c.value === form.category)?.label || form.category || "—"}
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700">Address</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700">Description</label>
              <textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex: Os melhores sorvetes da cidade!"
                rows={2}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none resize-none"
              />
              <p className="text-xs text-zinc-400">Appears on the menu, table & POS</p>
            </div>
          </CardContent>
        </Card>

        {/* Pagamentos */}
        <Card id="section-asaas" className={activeGroup !== "pagamentos" ? "hidden" : ""}>
          <CardContent className="p-6 space-y-5">
            <div>
              <h3 className="font-semibold text-zinc-900">Payments</h3>
              <p className="text-sm text-zinc-500">
                Configure how you want to receive payments on the online menu.
              </p>
            </div>

            {/* Asaas - Provider obrigatório */}
            <div className="rounded-xl border border-zinc-200 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-zinc-900">Asaas</h4>
                <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">Required</span>
              </div>
              <p className="text-xs text-zinc-500">
                Payment provider for credit card and PIX.
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
                    <span className="text-sm font-medium text-zinc-900">PIX + Card</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1 ml-6">Everything via Asaas</p>
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
                    <span className="text-sm font-medium text-zinc-900">Card Only</span>
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
                  placeholder="Wallet identification"
                  value={form.asaasWalletId}
                  onChange={(e) => setForm({ ...form, asaasWalletId: e.target.value })}
                  className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={testAsaasConnection} disabled={testingAsaas || !form.asaasApiKey} className="gap-2">
                  {testingAsaas ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                  Test Connection
                </Button>
                {asaasTestResult && (
                  <span className={`flex items-center gap-1.5 text-sm font-medium ${asaasTestResult.ok ? "text-green-600" : "text-red-500"}`}>
                    {asaasTestResult.ok ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {asaasTestResult.message}
                  </span>
                )}
              </div>
            </div>

            {/* Banco Inter - appears only when "Card Only" */}
            {asaasMode === "card_only" && (
              <div className="rounded-xl border border-green-200 bg-green-50/50 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-zinc-900">Banco Inter</h4>
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">PIX 0% fee</span>
                </div>
                <div className="rounded-lg bg-green-100/70 px-3 py-2 text-xs text-green-800">
                  PIX will be via Banco Inter, no fee. Card continues via Asaas.
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Client ID</label>
                  <input
                    type="text"
                    placeholder="Inter Client ID"
                    value={form.interClientId}
                    onChange={(e) => setForm({ ...form, interClientId: e.target.value })}
                    className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Client Secret</label>
                  <input
                    type="password"
                    placeholder="Inter Client Secret"
                    value={form.interClientSecret}
                    onChange={(e) => setForm({ ...form, interClientSecret: e.target.value })}
                    className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">PIX Key</label>
                  <input
                    type="text"
                    placeholder="CPF, CNPJ, email or random"
                    value={form.interPixKey}
                    onChange={(e) => setForm({ ...form, interPixKey: e.target.value })}
                    className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Certificate (.p12)</label>
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
                      Certificate loaded and ready to save
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-400">                    No certificate selected</p>
                  )}
                  <p className="text-xs text-zinc-400">Download from Internet Banking → Solutions → New Integration</p>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Certificate Password</label>
                  <input
                    type="password"
                    placeholder=".p12 password"
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
                <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">Coming Soon</span>
              </div>
              <p className="text-xs text-zinc-500">iFood integration to receive orders automatically.</p>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.ifoodEnabled || false}
                  onChange={(e) => setForm({ ...form, ifoodEnabled: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-300 text-orange-600 focus:ring-orange-500"
                />
                <span className="text-sm font-medium text-zinc-700">Enable iFood integration</span>
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
                  <p className="text-xs text-zinc-400">Find the Merchant ID in the iFood developer panel.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tipos de Pedido */}
        <Card id="section-tipos" className={activeGroup !== "pedidos" ? "hidden" : ""}>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">Order Types</h3>
            <p className="text-sm text-zinc-500">Enable or disable order types available on the menu.</p>
            <div className="space-y-3">
              <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-100">
                <input type="checkbox" checked={orderConfig.delivery} onChange={(e) => setOrderConfig({ ...orderConfig, delivery: e.target.checked })} className="h-5 w-5 rounded border-white/[.08] text-green-600 focus:ring-green-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <Bike className="h-4 w-4 text-zinc-400" />
                    <span className="font-medium text-zinc-900">Delivery</span>
                  </div>
                  <p className="text-xs text-zinc-500">Customer receives at home</p>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-100">
                <input type="checkbox" checked={orderConfig.pickup} onChange={(e) => setOrderConfig({ ...orderConfig, pickup: e.target.checked })} className="h-5 w-5 rounded border-white/[.08] text-green-600 focus:ring-green-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-zinc-400" />
                    <span className="font-medium text-zinc-900">Pickup</span>
                  </div>
                  <p className="text-xs text-zinc-500">Customer picks up at location</p>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Configuração de Mesas */}
        <Card id="section-mesas" className={activeGroup !== "pedidos" ? "hidden" : ""}>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">Tables</h3>
            <p className="text-sm text-zinc-500">Number of fixed tables available at POS. Tables are numbered from 1 to N.</p>
            <div>
              <label className="text-sm font-medium text-zinc-700">Number of Tables</label>
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
        <Card id="section-taxa-servico" className={activeGroup !== "pedidos" ? "hidden" : ""}>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">Service Fee</h3>
            <p className="text-sm text-zinc-500">Additional charge on the subtotal. Only applies to dine-in table sales.</p>
            
            <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-100">
              <input
                type="checkbox"
                checked={orderConfig.serviceTaxEnabled}
                onChange={(e) => setOrderConfig({ ...orderConfig, serviceTaxEnabled: e.target.checked })}
                className="h-5 w-5 rounded border-white/[.08] text-green-600 focus:ring-green-500"
              />
              <div>
                <span className="font-medium text-zinc-900">Charge service fee</span>
                <p className="text-xs text-zinc-500">Shows separately on customer's bill</p>
              </div>
            </label>

            {orderConfig.serviceTaxEnabled && (
              <div className="space-y-4 rounded-lg bg-zinc-50 p-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">Type</label>
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
                      Percentage (%)
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
                      Fixed Amount ($)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-zinc-700">
                    {orderConfig.serviceTaxType === "percent" ? "Percentage" : "Amount ($)"}
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
                    <span className="text-sm font-medium text-zinc-900">Apply to dine-in sales (table)</span>
                    <p className="text-xs text-zinc-500">Does not apply to counter, delivery or pickup</p>
                  </div>
                </label>

                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <p className="text-xs text-blue-700">
                    <strong>Example:</strong> Subtotal $80.00 {orderConfig.serviceTaxType === "percent" 
                      ? `+ ${orderConfig.serviceTaxValue}% (${orderConfig.serviceTaxType === "percent" ? `R$ ${(80 * orderConfig.serviceTaxValue / 100).toFixed(2)}` : `R$ ${orderConfig.serviceTaxValue.toFixed(2)}`}) = R$ ${(80 + (orderConfig.serviceTaxType === "percent" ? 80 * orderConfig.serviceTaxValue / 100 : orderConfig.serviceTaxValue)).toFixed(2)}`
                      : `+ R$ ${orderConfig.serviceTaxValue.toFixed(2)} = R$ ${(80 + orderConfig.serviceTaxValue).toFixed(2)}`}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Taxa de Entrega */}
        <Card id="section-taxa-entrega" className={activeGroup !== "pedidos" ? "hidden" : ""}>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">Delivery Fee</h3>
            <p className="text-sm text-zinc-500">Configure how the delivery fee is calculated.</p>
            <div className="space-y-4">
              <div className="space-y-2">
                {[
                  { value: "free", label: "Free", desc: "No delivery fee" },
                  { value: "fixed", label: "Fixed fee", desc: "Single amount per order" },
                  { value: "free_above", label: "Free above $X", desc: "Charge fee only on orders below a certain amount" },
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
                    <label className="block text-sm font-medium text-zinc-700">Fee amount ($)</label>
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
                      <label className="block text-sm font-medium text-zinc-700">Free above ($)</label>
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

        {/* Tempo Estimado de Entrega */}
        <Card id="section-tempo-entrega" className={activeGroup !== "pedidos" ? "hidden" : ""}>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">Estimated Delivery Time</h3>
            <p className="text-sm text-zinc-500">Time displayed on the menu for the customer.</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-zinc-700">Minimum (min)</label>
                <input
                  type="number"
                  min="5"
                  max="180"
                  placeholder="30"
                  value={form.estimatedDeliveryMin || ""}
                  onChange={(e) => setForm({ ...form, estimatedDeliveryMin: e.target.value })}
                  className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-zinc-700">Maximum (min)</label>
                <input
                  type="number"
                  min="5"
                  max="180"
                  placeholder="45"
                  value={form.estimatedDeliveryMax || ""}
                  onChange={(e) => setForm({ ...form, estimatedDeliveryMax: e.target.value })}
                  className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Formas de Pagamento */}
        <Card id="section-formas" className={activeGroup !== "pagamentos" ? "hidden" : ""}>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">Payment Methods</h3>
            <p className="text-sm text-zinc-500">Which payment methods the customer sees when placing an order.</p>
            <div className="space-y-3">
              <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-100">
                <input type="checkbox" checked={paymentConfig.online} onChange={(e) => setPaymentConfig({ ...paymentConfig, online: e.target.checked })} className="h-5 w-5 rounded border-white/[.08] text-green-600 focus:ring-green-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-zinc-400" />
                    <span className="font-medium text-zinc-900">Online (Pix / Card)</span>
                  </div>
                  <p className="text-xs text-zinc-500">Customer pays instantly via Asaas</p>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-100">
                <input type="checkbox" checked={paymentConfig.delivery} onChange={(e) => setPaymentConfig({ ...paymentConfig, delivery: e.target.checked })} className="h-5 w-5 rounded border-white/[.08] text-green-600 focus:ring-green-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-zinc-400" />
                    <span className="font-medium text-zinc-900">Pay on Delivery</span>
                  </div>
                  <p className="text-xs text-zinc-500">Customer pays cash/card at delivery</p>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-100">
                <input type="checkbox" checked={paymentConfig.pickup} onChange={(e) => setPaymentConfig({ ...paymentConfig, pickup: e.target.checked })} className="h-5 w-5 rounded border-white/[.08] text-green-600 focus:ring-green-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-zinc-400" />
                    <span className="font-medium text-zinc-900">Pay on Pickup</span>
                  </div>
                  <p className="text-xs text-zinc-500">Customer pays when picking up</p>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Limite de Pagamento na Entrega */}
        <Card id="section-limite" className={activeGroup !== "pagamentos" ? "hidden" : ""}>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">Delivery Payment Limit</h3>
            <p className="text-sm text-zinc-500">Set a maximum amount for orders paid on delivery. Orders above this amount can only be paid online.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700">Maximum Amount ($)</label>
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
                <p className="mt-1 text-xs text-zinc-400">Orders above this amount can only be paid online. Use 0 to disable delivery.</p>
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
                    <span className="font-medium text-zinc-900">Block second order during delivery</span>
                  </div>
                  <p className="text-xs text-zinc-500">While a delivery order is in progress (pending, confirmed, preparing or ready), the customer can only place new orders with online payment.</p>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Bloqueio por cancelamentos */}
        <Card id="section-bloqueio" className={activeGroup !== "pedidos" ? "hidden" : ""}>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">Cancellation Block</h3>
            <p className="text-sm text-zinc-500">When a customer frequently cancels orders, delivery payment is automatically blocked. Online orders (PIX/Card) remain available.</p>
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
                  <span className="font-medium text-zinc-900">Enable automatic blocking</span>
                </div>
                <p className="text-xs text-zinc-500">Recommended to reduce abusive cancellations on delivery payment.</p>
              </div>
            </label>
            <div className={`grid grid-cols-1 gap-4 sm:grid-cols-3 ${cancellationBlockEnabled ? "" : "opacity-50 pointer-events-none"}`}>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Number of cancellations (N)</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={cancellationBlockThreshold}
                  onChange={(e) => setCancellationBlockThreshold(e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none"
                />
                <p className="mt-1 text-xs text-zinc-400">How many cancellations trigger the block.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Window (X days)</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={cancellationBlockWindowDays}
                  onChange={(e) => setCancellationBlockWindowDays(e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none"
                />
                <p className="mt-1 text-xs text-zinc-400">Period in which cancellations are counted.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Block duration (Y days)</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={cancellationBlockDurationDays}
                  onChange={(e) => setCancellationBlockDurationDays(e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none"
                />
                <p className="mt-1 text-xs text-zinc-400">How many days delivery payment remains blocked.</p>
              </div>
            </div>
            <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-3 text-xs text-zinc-600">
              <strong>Example:</strong> with N={cancellationBlockThreshold}, X={cancellationBlockWindowDays} and Y={cancellationBlockDurationDays},
              a customer who cancels {cancellationBlockThreshold} orders in {cancellationBlockWindowDays} days
              will be blocked from delivery payment for {cancellationBlockDurationDays} days.
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp + Bot */}
        <Card id="section-whatsapp-bot" className={activeGroup !== "whatsapp" ? "hidden" : ""}>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">WhatsApp & Support Bot</h3>

            <SaasOnly>
            <div className={`rounded-lg border p-4 ${whatsappAutomationEnabled ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {whatsappAutomationEnabled ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">
                        ✓ ACTIVE
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        ⚠ DISABLED
                      </span>
                    )}
                    <span className="font-medium text-zinc-900">
                      WhatsApp Automation {whatsappAutomationEnabled ? "enabled" : "disabled"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">
                    {whatsappAutomationEnabled
                      ? `AI messages this month: ${aiMessagesUsed} / ${aiMessagesLimit}`
                      : "Enable automation to start using the bot. $50/month additional to your plan."}
                  </p>
                  {whatsappAutomationEnabled && (
                    <div className="mt-2 h-2 w-full rounded-full bg-zinc-200">
                      <div
                        className={`h-2 rounded-full ${aiMessagesUsed > aiMessagesLimit * 0.8 ? "bg-red-500" : "bg-green-500"}`}
                        style={{ width: `${Math.min(100, (aiMessagesUsed / aiMessagesLimit) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setWhatsappAutomationEnabled(!whatsappAutomationEnabled)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    whatsappAutomationEnabled
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "bg-green-100 text-green-700 hover:bg-green-200"
                  }`}
                >
                  {whatsappAutomationEnabled ? "Disable" : "Enable"}
                </button>
              </div>
            </div>

            {whatsappAutomationEnabled && (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-zinc-700">Monthly AI message limit</label>
                <input
                  type="number"
                  min={100}
                  step={100}
                  value={aiMessagesLimit}
                  onChange={(e) => setAiMessagesLimit(Number(e.target.value) || 1000)}
                  className="flex h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none"
                />
                <p className="text-xs text-zinc-400">When reached, the bot reverts to the fixed menu. Auto-reset on the 1st of each month.</p>
              </div>
            )}
            </SaasOnly>

            <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-4">
              <div>
                <p className="text-sm font-medium text-zinc-900">WhatsApp via Meta</p>
                <p className="text-xs text-zinc-500">Connect your WhatsApp number through Meta Cloud API</p>
              </div>
              <button
                type="button"
                onClick={() => setWhatsappProvider(whatsappProvider === "meta" ? null : "meta")}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  whatsappProvider === "meta" ? "bg-green-600" : "bg-zinc-300"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  whatsappProvider === "meta" ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
            </div>

            <SaasOnly>
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
                  <label className="block text-sm font-medium text-zinc-700">Instance Name</label>
                  <input
                    type="text"
                    placeholder="minha-loja"
                    value={evolutionInstanceName}
                    onChange={(e) => setEvolutionInstanceName(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
                <p className="text-xs text-zinc-400">Webhook to configure in Evolution: <code>https://your-domain.com/api/webhooks/whatsapp</code></p>

                {(() => {
                  if (!establishmentId) return null
                  const hasConfig = !!evolutionBaseUrl && !!evolutionApiKey && !!evolutionInstanceName
                  if (!hasConfig) {
                    return (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 mt-3">
                        ⚠️ Fill in the credentials above before connecting.
                      </div>
                    )
                  }
                  return (
                    <div className="mt-3">
                      <WhatsAppConnection
                        establishmentId={establishmentId}
                        evolutionBaseUrl={evolutionBaseUrl}
                        evolutionApiKey={evolutionApiKey}
                        evolutionInstanceName={evolutionInstanceName}
                        whatsappNumber={whatsappNumber}
                        onNumberDetected={setWhatsappNumber}
                      />
                    </div>
                  )
                })()}
              </div>
            )}
            </SaasOnly>

            {whatsappProvider === "meta" && (
              <MetaConfig
                establishmentId={establishmentId}
                metaPhoneNumberId={metaPhoneNumberId}
                metaAccessToken={metaAccessToken}
              />
            )}

            {whatsappProvider && (
              <>
                <div className="border-t border-zinc-200 pt-4 space-y-3">
                  <h4 className="text-sm font-semibold text-zinc-700">Support Bot</h4>

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
                        <span className="font-medium text-zinc-900">Enable auto bot</span>
                      </div>
                      <p className="text-xs text-zinc-500">When enabled, the bot automatically responds to customers with the options menu.</p>
                    </div>
                  </label>

                  <div className={`space-y-3 ${botEnabled ? "" : "opacity-50 pointer-events-none"}`}>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700">Agent name</label>
                      <input
                        type="text"
                        placeholder="Agent"
                        value={botAgentName}
                        onChange={(e) => setBotAgentName(e.target.value)}
                        className="mt-1 flex h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-700">Greeting message</label>
                      <textarea
                        placeholder="Hello! I'm Sofia, virtual assistant at Joe's Pizza."
                        value={botGreeting}
                        onChange={(e) => setBotGreeting(e.target.value)}
                        rows={2}
                        className="mt-1 flex w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                      />
                      <p className="mt-1 text-xs text-zinc-400">Leave empty to use default message.</p>
                    </div>

                    <SaasOnly>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700">Menu options (JSON)</label>
                      <textarea
                        value={botMenuOptions}
                        onChange={(e) => setBotMenuOptions(e.target.value)}
                        rows={6}
                        className="mt-1 flex w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-mono text-zinc-700 focus:border-green-600 focus:outline-none"
                      />
                      <p className="mt-1 text-xs text-zinc-400">Format: array of objects with <code>id</code>, <code>label</code> and <code>response</code> (menu, cardapio, agent or free text).</p>
                    </div>
                    </SaasOnly>

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
                          <span className="font-medium text-zinc-900">Use AI for free messages</span>
                        </div>
                        <p className="text-xs text-zinc-500">When enabled, the bot uses AI to answer questions in natural language. Numbered menu continues to work as shortcut.</p>
                      </div>
                    </label>

                    {botUseAI && (
                      <div className="space-y-3 rounded-lg border border-zinc-200 p-4">
                        <div>
                          <label className="block text-sm font-medium text-zinc-700">Tone of voice</label>
                          <select
                            value={botTone}
                            onChange={(e) => setBotTone(e.target.value as "formal" | "casual" | "direct")}
                            className="mt-1 flex h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none"
                          >
                            <option value="casual">Casual (friendly, uses emojis)</option>
                            <option value="formal">Formal (polite, sir/madam)</option>
                            <option value="direct">Direct (straightforward, no fluff)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-zinc-700">Business rules</label>
                          <textarea
                            placeholder={`Write here how the agent should behave in your business.\n\nExamples:\n- Always ask for flavors, quantity and whether it's for pickup or delivery\n- Suggest the promotion: buy 1kg get 100g free\n- Offer add-ons: syrup, sprinkles, whipped cream\n- Accept orders for future dates`}
                            value={botFAQ}
                            onChange={(e) => setBotFAQ(e.target.value)}
                            rows={6}
                            className="mt-1 flex w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                          />
                          <p className="mt-1 text-xs text-zinc-500">
                            Everything you write here becomes an instruction that the agent follows on WhatsApp. Write in simple language, as if explaining to a new employee.
                          </p>
                        </div>

                        <SaasOnly>
                        <div>
                          <label className="block text-sm font-medium text-zinc-700">Custom prompt (advanced)</label>
                          <textarea
                            placeholder="Extra instructions that concatenate with the master prompt. Optional."
                            value={botSystemPrompt}
                            onChange={(e) => setBotSystemPrompt(e.target.value)}
                            rows={3}
                            className="mt-1 flex w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-mono text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                          />
                          <p className="mt-1 text-xs text-zinc-400">Added to the end of the system prompt. Use with caution.</p>
                        </div>
                        </SaasOnly>
                      </div>
                    )}

                    {/* Inatividade */}
                    <div className="space-y-3 border-t border-zinc-200 pt-4">
                      <h5 className="text-sm font-semibold text-zinc-700">⏱️ End on inactivity</h5>
                      <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 cursor-pointer hover:bg-zinc-100">
                        <input
                          type="checkbox"
                          checked={botInactivityEnabled}
                          onChange={(e) => setBotInactivityEnabled(e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-white/[.08] text-green-600 focus:ring-green-500"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-zinc-900">End conversation if customer doesn't respond</span>
                          <p className="text-xs text-zinc-500">If the customer goes silent, the bot sends a final message and stops responding.</p>
                        </div>
                      </label>
                      {botInactivityEnabled && (
                        <>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-zinc-600">Timeout (min):</label>
                            <input
                              type="number"
                              min={1}
                              max={120}
                              value={botInactivityMinutes}
                              onChange={(e) => setBotInactivityMinutes(e.target.value)}
                              className="w-20 h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-2 text-sm"
                            />
                          </div>
                          <textarea
                            value={botInactivityMessage}
                            onChange={(e) => setBotInactivityMessage(e.target.value)}
                            rows={2}
                            placeholder="Goodbye message..."
                            className="flex w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                          />
                        </>
                      )}
                    </div>

                    {/* Auto-transfer humano */}
                    <div className="space-y-3 border-t border-zinc-200 pt-4">
                      <h5 className="text-sm font-semibold text-zinc-700">👤 Transfer to human</h5>
                      <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 cursor-pointer hover:bg-zinc-100">
                        <input
                          type="checkbox"
                          checked={botTransferEnabled}
                          onChange={(e) => setBotTransferEnabled(e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-white/[.08] text-green-600 focus:ring-green-500"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-zinc-900">Detect human agent requests</span>
                          <p className="text-xs text-zinc-500">When the customer types a keyword, the bot stops and marks the conversation as pending.</p>
                        </div>
                      </label>
                      {botTransferEnabled && (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-zinc-600">Keywords (comma-separated)</label>
                            <input
                              type="text"
                              value={botTransferKeywords}
                              onChange={(e) => setBotTransferKeywords(e.target.value)}
                              className="mt-1 flex h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm"
                            />
                          </div>
                          <textarea
                            value={botTransferMessage}
                            onChange={(e) => setBotTransferMessage(e.target.value)}
                            rows={2}
                            className="flex w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
                          />
                        </>
                      )}
                    </div>

                    <SaasOnly>
                    {/* Delay typing */}
                    <div className="space-y-3 border-t border-zinc-200 pt-4">
                      <h5 className="text-sm font-semibold text-zinc-700">⌨️ Typing delay</h5>
                      <p className="text-xs text-zinc-500">Simulates typing time to avoid ban risk and appear more human.</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-zinc-600">Minimum (ms)</label>
                          <input
                            type="number"
                            min={500}
                            max={10000}
                            step={100}
                            value={botTypingDelayMinMs}
                            onChange={(e) => setBotTypingDelayMinMs(e.target.value)}
                            className="mt-1 flex h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-600">Maximum (ms)</label>
                          <input
                            type="number"
                            min={500}
                            max={15000}
                            step={100}
                            value={botTypingDelayMaxMs}
                            onChange={(e) => setBotTypingDelayMaxMs(e.target.value)}
                            className="mt-1 flex h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                    </SaasOnly>

                    {/* Fora de horário */}
                    <div className="space-y-3 border-t border-zinc-200 pt-4">
                      <h5 className="text-sm font-semibold text-zinc-700">🕐 Outside business hours</h5>
                      <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 cursor-pointer hover:bg-zinc-100">
                        <input
                          type="checkbox"
                          checked={botRespectBusinessHours}
                          onChange={(e) => setBotRespectBusinessHours(e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-white/[.08] text-green-600 focus:ring-green-500"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-zinc-900">Respect business hours</span>
                          <p className="text-xs text-zinc-500">Outside the hours configured in the card below, the bot sends a special message.</p>
                        </div>
                      </label>
                      {botRespectBusinessHours && (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-zinc-600">Behavior</label>
                            <select
                              value={botOutsideHoursMode}
                              onChange={(e) => setBotOutsideHoursMode(e.target.value as "closed" | "scheduled")}
                              className="mt-1 flex h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm"
                            >
                              <option value="closed">Just notify that we're closed</option>
                              <option value="scheduled">Accept scheduled orders</option>
                            </select>
                          </div>
                          <textarea
                            value={botOutsideHoursMessage}
                            onChange={(e) => setBotOutsideHoursMessage(e.target.value)}
                            rows={2}
                            className="flex w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
                          />
                          {botOutsideHoursMode === "scheduled" && (
                            <textarea
                              value={botScheduledOrderMessage}
                              onChange={(e) => setBotScheduledOrderMessage(e.target.value)}
                              rows={2}
                              className="flex w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
                            />
                          )}
                        </>
                      )}
                    </div>

                    {/* Fallback */}
                    <div className="space-y-3 border-t border-zinc-200 pt-4">
                      <h5 className="text-sm font-semibold text-zinc-700">🤔 Couldn't understand customer</h5>
                      <p className="text-xs text-zinc-500">When the bot doesn't know how to respond.</p>
                      <textarea
                        value={botFallbackMessage}
                        onChange={(e) => setBotFallbackMessage(e.target.value)}
                        rows={2}
                        className="flex w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
                      />
                    </div>

                    {/* Templates de status */}
                    <div className="space-y-3 border-t border-zinc-200 pt-4">
                      <h5 className="text-sm font-semibold text-zinc-700">📦 Order status messages</h5>
                      <p className="text-xs text-zinc-500">The bot automatically sends when the order status changes.</p>
                      {[
                        { key: "botTemplateOrderConfirmed", label: "Confirmed", value: botTemplateOrderConfirmed, set: setBotTemplateOrderConfirmed },
                        { key: "botTemplateOrderPreparing", label: "Preparing", value: botTemplateOrderPreparing, set: setBotTemplateOrderPreparing },
                        { key: "botTemplateOrderReady", label: "Ready", value: botTemplateOrderReady, set: setBotTemplateOrderReady },
                        { key: "botTemplateOrderDelivering", label: "Out for delivery", value: botTemplateOrderDelivering, set: setBotTemplateOrderDelivering },
                        { key: "botTemplateOrderDelivered", label: "Delivered", value: botTemplateOrderDelivered, set: setBotTemplateOrderDelivered },
                        { key: "botTemplateOrderCancelled", label: "Cancelled", value: botTemplateOrderCancelled, set: setBotTemplateOrderCancelled },
                        { key: "botTemplateOrderScheduled", label: "📅 Scheduled (use {data} and {hora})", value: botTemplateOrderScheduled, set: setBotTemplateOrderScheduled },
                      ].map((t) => (
                        <div key={t.key}>
                          <label className="block text-xs font-medium text-zinc-600">{t.label}</label>
                          <textarea
                            value={t.value}
                            onChange={(e) => t.set(e.target.value)}
                            rows={2}
                            className="mt-1 flex w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Verificação por código: lembrete para quem não confirmou */}
            <div className="space-y-3 border-t border-zinc-200 pt-4">
              <h5 className="text-sm font-semibold text-zinc-700">🔐 Verification reminder</h5>
              <p className="text-xs text-zinc-500">
                Sends a WhatsApp reminder to those who requested the verification code but didn't complete.
              </p>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div>
                  <p className="text-sm font-medium text-zinc-900">Send automatic reminder</p>
                  <p className="text-xs text-zinc-500">If enabled, the sending runs hourly.</p>
                </div>
                <button
                  onClick={() => setVerifyReminderEnabled(!verifyReminderEnabled)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    verifyReminderEnabled
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "bg-green-100 text-green-700 hover:bg-green-200"
                  }`}
                >
                  {verifyReminderEnabled ? "Disable" : "Enable"}
                </button>
              </div>
              {verifyReminderEnabled && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-zinc-700">Send reminder after (minutes)</label>
                    <input
                      type="number"
                      min={10}
                      step={5}
                      value={verifyReminderDelayMin}
                      onChange={(e) => setVerifyReminderDelayMin(e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none"
                    />
                    <p className="text-xs text-zinc-400">Time after code request to send the reminder.</p>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-zinc-700">Reminder message</label>
                    <textarea
                      value={verifyReminderMessage}
                      onChange={(e) => setVerifyReminderMessage(e.target.value)}
                      rows={3}
                      className="flex w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-zinc-400">
                      Use <code className="rounded bg-zinc-100 px-1">{"{{nome}}"}</code> and{" "}
                      <code className="rounded bg-zinc-100 px-1">{"{{estabelecimento}}"}</code> to personalize.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Agendamento de Pedidos (Encomendas) */}
        <Card id="section-agendamento" className={activeGroup !== "pedidos" ? "hidden" : ""}>
          <CardContent className="p-6 space-y-4">
            <h3 className="flex items-center gap-2 font-semibold text-zinc-900">
              📦 Order Scheduling
            </h3>
            <p className="text-sm text-zinc-500">
              Set rules for scheduled orders (orders for events/future dates). The bot will validate these limits when guiding the customer through scheduling.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700">Minimum advance notice (hours)</label>
                <input
                  type="number"
                  min={1}
                  value={scheduledMinHours}
                  onChange={(e) => setScheduledMinHours(e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm"
                />
                <p className="mt-1 text-xs text-zinc-400">Customer must schedule with at least this much advance notice.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Average prep time (min)</label>
                <input
                  type="number"
                  min={0}
                  value={scheduledPrepMinutes}
                  onChange={(e) => setScheduledPrepMinutes(e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm"
                />
                <p className="mt-1 text-xs text-zinc-400">Informational. Use to define delivery windows.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Maximum advance notice (days)</label>
                <input
                  type="number"
                  min={1}
                  value={scheduledMaxAdvanceDays}
                  onChange={(e) => setScheduledMaxAdvanceDays(e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm"
                />
                <p className="mt-1 text-xs text-zinc-400">Customer cannot schedule beyond this timeframe.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Horário de Funcionamento */}
        <Card id="section-horarios" className={activeGroup !== "geral" ? "hidden" : ""}>
          <CardContent className="p-6 space-y-4">
            <h3 className="flex items-center gap-2 font-semibold text-zinc-900">
              <Clock className="h-4 w-4" />
              Business Hours
            </h3>
            <p className="text-sm text-zinc-500">Configure hours. Outside these hours, the menu shows as closed.</p>
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
                      <span className="text-xs text-zinc-400">to</span>
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
                    <span className="text-xs text-zinc-400">Closed</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save changes
          </Button>
          {saved && <span className="flex items-center gap-1 text-sm text-green-600"><Save className="h-4 w-4" />Saved!</span>}
        </div>
      </form>
        </div>
      </div>

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="fixed bottom-6 right-6 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg transition-opacity hover:bg-zinc-800"
        aria-label="Back to top"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
    </div>
  )
}
