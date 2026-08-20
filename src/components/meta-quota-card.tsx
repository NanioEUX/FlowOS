"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, XCircle, ExternalLink, RefreshCw } from "lucide-react"
import { fetchAuth } from "@/lib/fetch-auth"

interface QuotaData {
  messagingLimit: number
  currentUsage: number
  usagePercent: number
  tier: string
  estimatedCost: number
  isBlocked: boolean
  needsVerification: boolean
  metaManagerUrl?: string
}

export function MetaQuotaCard({ establishmentId }: { establishmentId: string }) {
  const [quota, setQuota] = useState<QuotaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchQuota = async () => {
    try {
      const res = await fetchAuth(`/api/establishments/${establishmentId}/meta-quota`)
      const data = await res.json()
      if (data.quota) setQuota(data.quota)
    } catch {
      // Quota data not available
    } finally {
      setLoading(false)
    }
  }

  const refreshQuota = async () => {
    setRefreshing(true)
    try {
      const res = await fetchAuth(`/api/establishments/${establishmentId}/meta-quota`, {
        method: "POST",
      })
      const data = await res.json()
      if (data.quota) setQuota(data.quota)
    } catch {
      // Error refreshing
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchQuota()
  }, [establishmentId])

  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
        Carregando cota da Meta...
      </div>
    )
  }

  if (!quota) return null

  const barColor = quota.usagePercent >= 100
    ? "bg-red-500"
    : quota.usagePercent >= 80
    ? "bg-yellow-500"
    : "bg-green-500"

  const bgBorder = quota.isBlocked
    ? "border-red-200 bg-red-50"
    : quota.needsVerification
    ? "border-yellow-200 bg-yellow-50"
    : "border-green-200 bg-green-50"

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${bgBorder}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-zinc-900">
          📊 Cota Meta — {quota.tier}
        </h4>
        <button
          onClick={refreshQuota}
          disabled={refreshing}
          className="text-xs text-zinc-500 hover:text-zinc-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-zinc-600 mb-1">
          <span>{quota.currentUsage} / {quota.messagingLimit} conversas</span>
          <span>{quota.usagePercent}%</span>
        </div>
        <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(quota.usagePercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Cost */}
      <p className="text-xs text-zinc-600">
        💰 Gasto estimado no mês: <strong>R$ {quota.estimatedCost.toFixed(2)}</strong>
      </p>

      {/* Warning state */}
      {quota.needsVerification && !quota.isBlocked && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-xs text-yellow-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              Você já utilizou <strong>{quota.usagePercent}%</strong> da sua cota diária de {quota.messagingLimit} mensagens.
              Para expandir seu limite, envie os documentos da empresa (CNPJ) e adicione um método de pagamento.
            </p>
          </div>
          {quota.metaManagerUrl && (
            <div className="flex gap-2">
              <a
                href={quota.metaManagerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-yellow-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yellow-700"
              >
                Configurar na Meta <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Blocked state */}
      {quota.isBlocked && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-xs text-red-800">
            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              <strong>Limite diário atingido.</strong> Envios ativos pausados até amanhã.
              Para liberar envios ilimitados, ative sua conta com CNPJ e adicione um cartão na Meta.
            </p>
          </div>
          {quota.metaManagerUrl && (
            <a
              href={quota.metaManagerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Ativar conta na Meta <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  )
}
