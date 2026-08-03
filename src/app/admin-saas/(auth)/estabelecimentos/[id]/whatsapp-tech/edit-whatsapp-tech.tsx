"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Form = {
  whatsappProvider: string
  whatsappNumber: string
  evolutionBaseUrl: string
  evolutionApiKey: string
  evolutionInstanceName: string
  metaPhoneNumberId: string
  metaAccessToken: string
  metaWebhookVerifyToken: string
  whatsappAutomationEnabled: boolean
  aiMessagesLimit: number
  botEnabled: boolean
  botUseAI: boolean
  botMenuOptions: string
  botTypingDelayMinMs: number
  botTypingDelayMaxMs: number
  botInactivityEnabled: boolean
  botInactivityMinutes: number
  botInactivityMessage: string
  botTransferEnabled: boolean
  botTransferKeywords: string
  botTransferMessage: string
  botRespectBusinessHours: boolean
  botOutsideHoursMode: string
  botOutsideHoursMessage: string
  botAcceptsScheduledOrders: boolean
  botScheduledOrderMessage: string
  botFallbackMessage: string
  botTemplateOrderConfirmed: string
  botTemplateOrderPreparing: string
  botTemplateOrderReady: string
  botTemplateOrderDelivering: string
  botTemplateOrderDelivered: string
  botTemplateOrderCancelled: string
  botTemplateOrderScheduled: string
}

export function EditWhatsappTech({ id, initial }: { id: string; initial: Form }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState<Form>(initial)

  function setField<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSaved(false)
    try {
      const payload: any = {
        ...form,
        botMenuOptions: parseJsonOrNull(form.botMenuOptions),
        botTransferKeywords: parseJsonOrNull(form.botTransferKeywords),
      }
      const res = await fetch(`/api/saas-admin/establishments/${id}/whatsapp-tech`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <Section title="Provedor e número" description="Define qual integração técnica o estabelecimento usa.">
        <Field label="Provedor">
          <select
            value={form.whatsappProvider}
            onChange={(e) => setField("whatsappProvider", e.target.value)}
            className="input"
          >
            <option value="">— não configurado —</option>
            <option value="evolution">Evolution API</option>
            <option value="meta">Meta Cloud API</option>
          </select>
        </Field>
        <Field label="Número do WhatsApp" hint="Formato: 5511999999999">
          <input
            type="text"
            value={form.whatsappNumber}
            onChange={(e) => setField("whatsappNumber", e.target.value)}
            className="input"
            placeholder="5511999999999"
          />
        </Field>
        <div className="flex items-center gap-3">
          <input
            id="whatsappAutomationEnabled"
            type="checkbox"
            checked={form.whatsappAutomationEnabled}
            onChange={(e) => setField("whatsappAutomationEnabled", e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-green-600 focus:ring-green-500"
          />
          <label htmlFor="whatsappAutomationEnabled" className="text-sm font-medium text-zinc-900">
            Automação do WhatsApp habilitada
          </label>
        </div>
      </Section>

      <Section title="Evolution API">
        <Field label="Base URL">
          <input
            type="text"
            value={form.evolutionBaseUrl}
            onChange={(e) => setField("evolutionBaseUrl", e.target.value)}
            className="input"
            placeholder="https://evolution.exemplo.com"
          />
        </Field>
        <Field label="API Key">
          <input
            type="text"
            value={form.evolutionApiKey}
            onChange={(e) => setField("evolutionApiKey", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Nome da instância">
          <input
            type="text"
            value={form.evolutionInstanceName}
            onChange={(e) => setField("evolutionInstanceName", e.target.value)}
            className="input"
          />
        </Field>
      </Section>

      <Section title="Meta Cloud API">
        <Field label="Phone Number ID">
          <input
            type="text"
            value={form.metaPhoneNumberId}
            onChange={(e) => setField("metaPhoneNumberId", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Access Token">
          <input
            type="text"
            value={form.metaAccessToken}
            onChange={(e) => setField("metaAccessToken", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Webhook Verify Token">
          <input
            type="text"
            value={form.metaWebhookVerifyToken}
            onChange={(e) => setField("metaWebhookVerifyToken", e.target.value)}
            className="input"
          />
        </Field>
      </Section>

      <Section title="Bot - Geral">
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <input
              id="botEnabled"
              type="checkbox"
              checked={form.botEnabled}
              onChange={(e) => setField("botEnabled", e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-green-600 focus:ring-green-500"
            />
            <label htmlFor="botEnabled" className="text-sm font-medium text-zinc-900">Bot ativo</label>
          </div>
          <div className="flex items-center gap-3">
            <input
              id="botUseAI"
              type="checkbox"
              checked={form.botUseAI}
              onChange={(e) => setField("botUseAI", e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-green-600 focus:ring-green-500"
            />
            <label htmlFor="botUseAI" className="text-sm font-medium text-zinc-900">Bot usa IA</label>
          </div>
          <Field label="Limite IA/mês">
            <input
              type="number"
              value={form.aiMessagesLimit}
              onChange={(e) => setField("aiMessagesLimit", Number(e.target.value))}
              className="input"
            />
          </Field>
        </div>
        <Field
          label="Opções do menu (JSON)"
          hint='Array de strings. Ex: ["1 - Cardápio","2 - Falar com atendente"]'
        >
          <textarea
            rows={4}
            value={form.botMenuOptions}
            onChange={(e) => setField("botMenuOptions", e.target.value)}
            className="input font-mono text-xs"
            placeholder='["1 - Ver cardápio", "2 - Falar com atendente"]'
          />
        </Field>
        <Field label="Mensagem de fallback">
          <textarea
            rows={2}
            value={form.botFallbackMessage}
            onChange={(e) => setField("botFallbackMessage", e.target.value)}
            className="input"
          />
        </Field>
      </Section>

      <Section title="Bot - Digitação">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Delay mínimo (ms)">
            <input
              type="number"
              value={form.botTypingDelayMinMs}
              onChange={(e) => setField("botTypingDelayMinMs", Number(e.target.value))}
              className="input"
            />
          </Field>
          <Field label="Delay máximo (ms)">
            <input
              type="number"
              value={form.botTypingDelayMaxMs}
              onChange={(e) => setField("botTypingDelayMaxMs", Number(e.target.value))}
              className="input"
            />
          </Field>
        </div>
      </Section>

      <Section title="Bot - Inatividade">
        <div className="flex items-center gap-3">
          <input
            id="botInactivityEnabled"
            type="checkbox"
            checked={form.botInactivityEnabled}
            onChange={(e) => setField("botInactivityEnabled", e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-green-600 focus:ring-green-500"
          />
          <label htmlFor="botInactivityEnabled" className="text-sm font-medium text-zinc-900">
            Cobrar inatividade
          </label>
        </div>
        <Field label="Minutos de inatividade">
          <input
            type="number"
            value={form.botInactivityMinutes}
            onChange={(e) => setField("botInactivityMinutes", Number(e.target.value))}
            className="input"
          />
        </Field>
        <Field label="Mensagem de inatividade">
          <textarea
            rows={2}
            value={form.botInactivityMessage}
            onChange={(e) => setField("botInactivityMessage", e.target.value)}
            className="input"
          />
        </Field>
      </Section>

      <Section title="Bot - Transferência">
        <div className="flex items-center gap-3">
          <input
            id="botTransferEnabled"
            type="checkbox"
            checked={form.botTransferEnabled}
            onChange={(e) => setField("botTransferEnabled", e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-green-600 focus:ring-green-500"
          />
          <label htmlFor="botTransferEnabled" className="text-sm font-medium text-zinc-900">
            Transferir para humano
          </label>
        </div>
        <Field
          label="Palavras-chave (JSON)"
          hint='Array de strings. Ex: ["atendente","humano"]'
        >
          <textarea
            rows={3}
            value={form.botTransferKeywords}
            onChange={(e) => setField("botTransferKeywords", e.target.value)}
            className="input font-mono text-xs"
            placeholder='["atendente", "humano"]'
          />
        </Field>
        <Field label="Mensagem de transferência">
          <textarea
            rows={2}
            value={form.botTransferMessage}
            onChange={(e) => setField("botTransferMessage", e.target.value)}
            className="input"
          />
        </Field>
      </Section>

      <Section title="Bot - Horário de funcionamento">
        <div className="flex items-center gap-3">
          <input
            id="botRespectBusinessHours"
            type="checkbox"
            checked={form.botRespectBusinessHours}
            onChange={(e) => setField("botRespectBusinessHours", e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-green-600 focus:ring-green-500"
          />
          <label htmlFor="botRespectBusinessHours" className="text-sm font-medium text-zinc-900">
            Respeitar horário de funcionamento
          </label>
        </div>
        <Field label="Comportamento fora do horário">
          <select
            value={form.botOutsideHoursMode}
            onChange={(e) => setField("botOutsideHoursMode", e.target.value)}
            className="input"
          >
            <option value="closed">Fechado (informa e encerra)</option>
            <option value="record">Gravar pedido agendado</option>
            <option value="ai">IA responde mesmo fechado</option>
          </select>
        </Field>
        <Field label="Mensagem fora do horário">
          <textarea
            rows={2}
            value={form.botOutsideHoursMessage}
            onChange={(e) => setField("botOutsideHoursMessage", e.target.value)}
            className="input"
          />
        </Field>
      </Section>

      <Section title="Bot - Pedidos agendados">
        <div className="flex items-center gap-3">
          <input
            id="botAcceptsScheduledOrders"
            type="checkbox"
            checked={form.botAcceptsScheduledOrders}
            onChange={(e) => setField("botAcceptsScheduledOrders", e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-green-600 focus:ring-green-500"
          />
          <label htmlFor="botAcceptsScheduledOrders" className="text-sm font-medium text-zinc-900">
            Aceita pedidos agendados
          </label>
        </div>
        <Field label="Mensagem de agendamento">
          <textarea
            rows={2}
            value={form.botScheduledOrderMessage}
            onChange={(e) => setField("botScheduledOrderMessage", e.target.value)}
            className="input"
          />
        </Field>
      </Section>

      <Section title="Bot - Templates de status do pedido">
        <Field label="Pedido confirmado">
          <textarea
            rows={2}
            value={form.botTemplateOrderConfirmed}
            onChange={(e) => setField("botTemplateOrderConfirmed", e.target.value)}
            className="input"
            placeholder="✅ Pedido confirmado! Preparando..."
          />
        </Field>
        <Field label="Em preparo">
          <textarea
            rows={2}
            value={form.botTemplateOrderPreparing}
            onChange={(e) => setField("botTemplateOrderPreparing", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Pronto">
          <textarea
            rows={2}
            value={form.botTemplateOrderReady}
            onChange={(e) => setField("botTemplateOrderReady", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Saiu para entrega">
          <textarea
            rows={2}
            value={form.botTemplateOrderDelivering}
            onChange={(e) => setField("botTemplateOrderDelivering", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Entregue">
          <textarea
            rows={2}
            value={form.botTemplateOrderDelivered}
            onChange={(e) => setField("botTemplateOrderDelivered", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Cancelado">
          <textarea
            rows={2}
            value={form.botTemplateOrderCancelled}
            onChange={(e) => setField("botTemplateOrderCancelled", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Agendado">
          <textarea
            rows={2}
            value={form.botTemplateOrderScheduled}
            onChange={(e) => setField("botTemplateOrderScheduled", e.target.value)}
            className="input"
          />
        </Field>
      </Section>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}
      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
          ✅ Configurações salvas com sucesso
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-medium text-sm"
      >
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

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
        {description && <p className="text-sm text-zinc-500 mt-1">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-900 mb-1">{label}</label>
      {hint && <p className="text-xs text-zinc-500 mb-1">{hint}</p>}
      {children}
    </div>
  )
}

function parseJsonOrNull(value: string) {
  if (!value || !value.trim()) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}
