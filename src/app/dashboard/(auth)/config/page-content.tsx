"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Loader2, CheckCircle, XCircle, Plug } from "lucide-react"
import { fetchAuth } from "@/lib/fetch-auth"
import { MetaQuotaCard } from "@/components/meta-quota-card"
import { EmbeddedSignupButton } from "@/components/meta-embedded-signup"

declare global {
  interface Window {
    FB?: any
    fbAsyncInit?: () => void
  }
}

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID
const META_CONFIG_ID = process.env.NEXT_PUBLIC_META_CONFIG_ID

export function MetaConfig({
  establishmentId,
  metaPhoneNumberId,
  metaAccessToken,
  onRefresh,
}: {
  establishmentId: string | null
  metaPhoneNumberId: string
  metaAccessToken: string
  onRefresh?: () => void
}) {
  const [disconnecting, setDisconnecting] = useState(false)
  const isConnected = !!metaAccessToken && !!metaPhoneNumberId

  const handleDisconnect = async () => {
    if (!establishmentId) return
    if (!confirm("Desconectar Meta WhatsApp? O bot vai parar de responder.")) return
    setDisconnecting(true)
    try {
      await fetchAuth("/api/establishments/" + establishmentId + "/meta-connect", {
        method: "DELETE",
      })
      window.location.reload()
    } catch (e: any) {
      alert("Erro ao desconectar: " + e.message)
    } finally {
      setDisconnecting(false)
    }
  }

  if (isConnected) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">
                  ✓ CONECTADO
                </span>
                <span className="text-sm font-medium text-green-900">{metaPhoneNumberId}</span>
              </div>
              <p className="mt-1 text-xs text-green-700">
                Meta Cloud API ativa.
              </p>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200 disabled:opacity-50"
            >
              {disconnecting ? "Desconectando..." : "Desconectar"}
            </button>
          </div>
        </div>
        {establishmentId && <MetaQuotaCard establishmentId={establishmentId} />}
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 p-4">
      <h4 className="text-sm font-semibold text-zinc-700">Meta Cloud API</h4>
      <p className="text-xs text-zinc-500">
        Conecte sua conta Meta para usar o WhatsApp Cloud API. Você vai fazer login com sua conta do Facebook e o Meta configura tudo automaticamente.
      </p>
      <EmbeddedSignupButton onComplete={onRefresh} />
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
    } catch (e) {}
  }, [])

  const handleSaasLogin = async () => {
    const res = await fetchAuth("/api/saas-admin/login", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@flowoshub.com",
        password: "123456",
      }),
    })
    const data = await res.json()
    if (data.success) {
      localStorage.setItem("pedefacil-user", JSON.stringify({ role: "saas_admin", name: "Admin" }))
      window.location.href = "/admin-dashboard"
    } else {
      alert("Login falhou: " + (data.error || ""))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                className="h-8 w-8 rounded-full"
                src="https://ui-avatars.com/?name=Admin&background=6366f1&color=fff"
                alt="Admin"
              />
              <span className="font-medium text-lg">FlowOS Admin</span>
            </div>
            <div className="flex items-center gap-3">
              <a href="/admin-dashboard" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
                Painel
              </a>
              <a href="/admin-saas/login" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
                SaaS Login
              </a>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-12">
        <div className="max-w-7xl mx-auto p-6">
          <div className="bg-white rounded-lg shadow p-8">
            <h1 className="text-2xl font-bold text-zinc-900 mb-6">Painel Administrativo</h1>
            <p className="text-zinc-500 mb-6">
              Gerencie suas estabelecimentos e configurações de WhatsApp.
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-zinc-700 mb-4">Configurações WhatsApp</h3>
                <p className="text-zinc-500 text-sm">
                  Clique em "Conectar WhatsApp" para integrar a API da Meta.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-zinc-700 mb-4">Estabelecimentos</h3>
                <p className="text-zinc-500 text-sm">
                  Visão geral dos seus estabelecimentos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}