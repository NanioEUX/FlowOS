"use client"

import { useEffect, useRef, useState } from "react"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Loader2, CheckCircle, XCircle, Plug } from "lucide-react"
import { fetchAuth } from "@/lib/fetch-auth"

declare global {
  interface Window {
    FB?: any
    fbAsyncInit?: () => void
  }
}

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID
const META_CONFIG_ID = process.env.NEXT_PUBLIC_META_CONFIG_ID

export function EmbeddedSignupButton({ onComplete }: { onComplete?: () => void }) {
  const establishmentId = useEstablishmentId()
  const [loading, setLoading] = useState(false)
  const [sdkReady, setSdkReady] = useState(false)
  const [result, setResult] = useState<{ success: boolean; error?: string; phone?: string } | null>(null)
  const fbInitRef = useRef(false)

  useEffect(() => {
    if (!META_APP_ID || fbInitRef.current) return
    fbInitRef.current = true

    // Load Facebook SDK
    if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script")
      script.id = "facebook-jssdk"
      script.src = "https://connect.facebook.net/pt_BR/sdk.js"
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }

    window.fbAsyncInit = function () {
      window.FB?.init({
        appId: META_APP_ID,
        cookie: true,
        xfbml: false,
        version: "v21.0",
      })
      setSdkReady(true)
    }
  }, [])

  // Listen for postMessage from Meta popup
  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://www.facebook.com") return

      const data = event.data
      if (!data || typeof data !== "string") return

      try {
        const parsed = JSON.parse(data)
        if (parsed.type !== "WA_EMBEDDED_SIGNUP" || !parsed.data) return

        const { phone_number_id, waba_id, code } = parsed.data
        if (!code) return

        setLoading(true)
        setResult(null)

        // Send code to server to exchange for token
        const res = await fetchAuth(`/api/establishments/${establishmentId}/meta-embedded-signup`, {
          method: "POST",
          body: JSON.stringify({ code, phoneNumberId: phone_number_id, wabaId: waba_id }),
        })

        const data2 = await res.json()

        if (data2.success) {
          setResult({ success: true, phone: data2.phoneNumber })
          onComplete?.()
        } else {
          setResult({ success: false, error: data2.error })
        }
      } catch (err: any) {
        setResult({ success: false, error: err.message })
      } finally {
        setLoading(false)
      }
    }

    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [establishmentId, onComplete])

  const handleConnect = () => {
    if (!window.FB) {
      setResult({ success: false, error: "SDK do Facebook não carregou. Recarregue a página." })
      return
    }

    setLoading(true)
    setResult(null)

    window.FB.login(
      (response: any) => {
        if (response.status === "connected") {
          // The code comes via postMessage, not here
          // Just wait for it
        } else {
          setLoading(false)
          setResult({ success: false, error: "Login cancelado ou negado." })
        }
      },
      {
        config_id: META_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
        },
      }
    )
  }

  if (!META_APP_ID || !META_CONFIG_ID) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-900">⚠️ Embedded Signup não configurado. O administrador precisa definir NEXT_PUBLIC_META_APP_ID e NEXT_PUBLIC_META_CONFIG_ID.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {result && (
        <div className={`rounded-lg border p-3 text-xs ${result.success ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900"}`}>
          {result.success ? (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>WhatsApp conectado com sucesso!{result.phone && ` — ${result.phone}`}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              <span>{result.error}</span>
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleConnect}
        disabled={loading || !sdkReady}
        className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plug className="h-4 w-4" />
        )}
        {loading ? "Conectando..." : "Conectar WhatsApp via Meta"}
      </button>

      <p className="text-xs text-zinc-500">
        O Meta vai abrir um popup pra você fazer login com sua conta do Facebook e conectar seu WhatsApp Business.
      </p>
    </div>
  )
}
