"use client"

import { useEffect, useRef, useState, useCallback } from "react"
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
  const [sdkError, setSdkError] = useState<string | null>(null)
  const [result, setResult] = useState<{ success: boolean; error?: string; phone?: string } | null>(null)
  const fbInitRef = useRef(false)
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load Facebook SDK
  useEffect(() => {
    if (!META_APP_ID || fbInitRef.current) return
    fbInitRef.current = true

    // Check if SDK already loaded
    if (window.FB) {
      setSdkReady(true)
      return
    }

    window.fbAsyncInit = function () {
      try {
        window.FB.init({
          appId: META_APP_ID,
          cookie: true,
          xfbml: false,
          version: "v21.0",
        })
        setSdkReady(true)
      } catch (e: any) {
        setSdkError("Erro ao inicializar SDK: " + e.message)
      }
    }

    // Load SDK script
    if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script")
      script.id = "facebook-jssdk"
      script.src = "https://connect.facebook.net/pt_BR/sdk.js"
      script.async = true
      script.defer = true
      script.onerror = () => setSdkError("Falha ao carregar SDK do Facebook")
      document.head.appendChild(script)
    }
  }, [])

  // Listen for postMessage from Meta popup
  const handleMessage = useCallback(async (event: MessageEvent) => {
    // Log ALL messages for debugging
    const dataStr = typeof event.data === "string" ? event.data : JSON.stringify(event.data)
    if (dataStr.includes("WA_EMBEDDED") || dataStr.includes("embedded") || dataStr.includes("phone_number") || dataStr.includes("waba")) {
      console.log("[Meta Embedded Signup] Potential message:", event.origin, event.data)
    }

    // Accept messages from Facebook domains
    const validOrigins = [
      "https://www.facebook.com",
      "https://facebook.com",
      "https://www.facebook.com",
    ]
    if (!validOrigins.includes(event.origin)) return

    const data = event.data
    if (!data) return

    // Log for debugging
    console.log("[Meta Embedded Signup] Received message:", event.origin, data)

    try {
      let parsed: any
      if (typeof data === "string") {
        parsed = JSON.parse(data)
      } else if (typeof data === "object") {
        parsed = data
      } else {
        return
      }

      // Check for Embedded Signup response
      if (parsed.type === "WA_EMBEDDED_SIGNUP" && parsed.data) {
        const { phone_number_id, waba_id, code } = parsed.data
        console.log("[Meta Embedded Signup] Got data:", { phone_number_id, waba_id, hasCode: !!code })

        if (!code) {
          setResult({ success: false, error: "Código não recebido do Meta" })
          setLoading(false)
          return
        }

        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current)
        }

        setLoading(true)
        setResult(null)

        // Send code + origin URL to server (Meta SDK uses origin as redirect_uri)
        const redirectUri = window.location.origin + "/"

        try {
          const res = await fetchAuth(`/api/establishments/${establishmentId}/meta-embedded-signup`, {
            method: "POST",
            body: JSON.stringify({ code, phoneNumberId: phone_number_id, wabaId: waba_id, redirectUri }),
          })

          const data2 = await res.json()
          console.log("[Meta Embedded Signup] Server response:", data2)

          if (data2.success) {
            setResult({ success: true, phone: data2.phoneNumber })
            onComplete?.()
          } else {
            setResult({ success: false, error: data2.error })
          }
        } catch (err: any) {
          setResult({ success: false, error: "Erro ao salvar: " + err.message })
        } finally {
          setLoading(false)
        }
      }

      // Handle cancel/error from popup
      if (parsed.type === "WA_EMBEDDED_SIGNUP_CANCEL") {
        console.log("[Meta Embedded Signup] User cancelled")
        setLoading(false)
        setResult({ success: false, error: "Conexão cancelada pelo usuário." })
      }
    } catch (err) {
      // Not JSON or not our event, ignore
    }
  }, [establishmentId, onComplete])

  useEffect(() => {
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [handleMessage])

  const handleConnect = () => {
    if (!window.FB) {
      setResult({ success: false, error: "SDK do Facebook não carregou. Recarregue a página." })
      return
    }

    setResult(null)
    setLoading(true)

    // Timeout after 5 minutes
    loadingTimeoutRef.current = setTimeout(() => {
      setLoading(false)
      setResult({ success: false, error: "Tempo esgotado. Tente novamente." })
    }, 300000)

    window.FB.login(
      (response: any) => {
        console.log("[Meta Embedded Signup] FB.login FULL response:", JSON.stringify(response, null, 2))
        if (response.status === "connected") {
          // Check if code is in the authResponse
          if (response.authResponse?.code) {
            console.log("[Meta Embedded Signup] Got code from authResponse:", response.authResponse.code)
            // Send code to server directly
            setLoading(true)
            fetchAuth(`/api/establishments/${establishmentId}/meta-embedded-signup`, {
              method: "POST",
              body: JSON.stringify({ code: response.authResponse.code, phoneNumberId: null, wabaId: null, redirectUri: window.location.origin + "/" }),
            }).then(res => res.json()).then(data2 => {
              console.log("[Meta Embedded Signup] Server response:", data2)
              if (data2.success) {
                setResult({ success: true, phone: data2.phoneNumber })
                onComplete?.()
              } else {
                setResult({ success: false, error: data2.error })
              }
            }).catch(err => {
              setResult({ success: false, error: "Erro ao salvar: " + err.message })
            }).finally(() => setLoading(false))
          } else {
            console.log("[Meta Embedded Signup] Connected but no code in authResponse, waiting for postMessage...")
          }
        } else if (response.status === "not_authorized" || response.status === "unknown") {
          if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
          setLoading(false)
          setResult({ success: false, error: "Login cancelado ou permissão negada." })
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
        <p className="text-sm text-amber-900">
          ⚠️ Embedded Signup não configurado. O administrador precisa definir{' '}
          <code>NEXT_PUBLIC_META_APP_ID</code> e <code>NEXT_PUBLIC_META_CONFIG_ID</code> no Vercel.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sdkError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900">
          {sdkError}
        </div>
      )}

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

      {/* Debug info - remove in production */}
      <div className="text-[10px] text-zinc-400">
        SDK: {sdkReady ? "✓" : "carregando..."} | App ID: {META_APP_ID ? "✓" : "✗"} | Config ID: {META_CONFIG_ID ? "✓" : "✗"}
      </div>
    </div>
  )
}
