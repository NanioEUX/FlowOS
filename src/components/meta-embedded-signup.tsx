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
  const [result, setResult] = useState<{ success: boolean; error?: string; phone?: string; debug?: string[] } | null>(null)
  const [selectingPhone, setSelectingPhone] = useState(false)
  const [phoneOptions, setPhoneOptions] = useState<Array<{ id: string; display_phone_number: string; verified_name: string; waba_id: string }>>([])
  const [debugLog, setDebugLog] = useState<string[]>([])
  const fbInitRef = useRef(false)
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingCodeRef = useRef<string | null>(null)
  const pendingTokenRef = useRef<string | null>(null)

  const addDebug = useCallback((msg: string) => {
    console.log("[Meta Embedded Signup]", msg)
    setDebugLog(prev => [...prev.slice(-20), new Date().toLocaleTimeString() + " " + msg])
  }, [])

  useEffect(() => {
    if (!META_APP_ID || fbInitRef.current) return
    fbInitRef.current = true

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

  const sendToServer = useCallback(async (code: string, phoneNumberId: string | null, wabaId: string | null) => {
    const redirectUri = window.location.origin

    const payload: any = { phoneNumberId, wabaId, redirectUri }
    if (code && code !== "no_code") {
      const isToken = code.length > 80 || code.includes(".")
      if (isToken) {
        payload.accessToken = code
      } else {
        payload.code = code
      }
    }

    if (pendingTokenRef.current) {
      payload.accessToken = pendingTokenRef.current
    }

    console.log("[Meta Embedded Signup] Sending to server - code:", !!payload.code, "accessToken:", !!payload.accessToken, "phoneNumberId:", phoneNumberId, "wabaId:", wabaId)

    const res = await fetchAuth("/api/establishments/" + establishmentId + "/meta-embedded-signup", {
      method: "POST",
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    console.log("[Meta Embedded Signup] Server response:", data)
    addDebug("Server response: success=" + data.success + " phone=" + (data.phoneNumber || "null") + " error=" + (data.error || "none"))
    if (data._diagnostics) addDebug("Server diag: " + data._diagnostics.join(" | "))
    if (data._tokenValid !== undefined) addDebug("Token valid (EAA): " + data._tokenValid)

    if (data.success) {
      setResult({ success: true, phone: data.phoneNumber || phoneNumberId, debug: [] })
      onComplete?.()
    } else {
      setResult({ success: false, error: data.error || "Erro desconhecido", debug: [] })
    }
  }, [establishmentId, onComplete])

  const fetchPhoneOptions = useCallback(async (code: string) => {
    const debug: string[] = []
    setLoading(true)
    setResult(null)
    debug.push("Buscando WABAs e telefones disponiveis...")
    console.log("[Meta Discover] Starting discover flow, code length:", code.length)

    try {
      const res = await fetchAuth("/api/establishments/" + establishmentId + "/meta-discover", {
        method: "POST",
        body: JSON.stringify({ code, redirectUri: window.location.origin }),
      })

      console.log("[Meta Discover] Response status:", res.status)
      const data = await res.json()
      debug.push("Discover: " + JSON.stringify(data))
      console.log("[Meta Discover] Response data:", JSON.stringify(data, null, 2))

      if (data.success && data.phones && data.phones.length > 0) {
        console.log("[Meta Discover] SUCCESS - Found", data.phones.length, "phones")
        setPhoneOptions(data.phones)
        setSelectingPhone(true)
        pendingTokenRef.current = data.accessToken
        setResult(null)
      } else if (data.success && data.phones && data.phones.length === 0) {
        console.log("[Meta Discover] NO PHONES FOUND - Account has no WhatsApp numbers")
        setResult({ success: false, error: "Nenhum numero de WhatsApp encontrado na conta Meta.", debug })
      } else {
        console.log("[Meta Discover] FAILED:", data.error)
        setResult({ success: false, error: data.error || "Falha ao buscar telefones", debug })
      }
    } catch (err: any) {
      console.log("[Meta Discover] EXCEPTION:", err.message)
      setResult({ success: false, error: "Erro ao buscar telefones: " + err.message, debug })
    } finally {
      setLoading(false)
    }
  }, [establishmentId])

  const handleSelectPhone = useCallback(async (phone: { id: string; display_phone_number: string; waba_id: string }) => {
    setSelectingPhone(false)
    setLoading(true)
    setResult(null)

    try {
      const code = pendingCodeRef.current || ""
      const debug: string[] = []
      debug.push("Selecionado: " + phone.display_phone_number + " (" + phone.id + ")")

      const res = await fetchAuth("/api/establishments/" + establishmentId + "/meta-embedded-signup", {
        method: "POST",
        body: JSON.stringify({ code, phoneNumberId: phone.id, wabaId: phone.waba_id, redirectUri: window.location.origin, accessToken: pendingTokenRef.current }),
      })

      const data = await res.json()
      debug.push("Server: " + JSON.stringify(data))

      if (data.success) {
        setResult({ success: true, phone: data.phoneNumber || phone.display_phone_number, debug })
        onComplete?.()
      } else {
        setResult({ success: false, error: data.error || "Erro ao salvar", debug })
      }
    } catch (err: any) {
      setResult({ success: false, error: "Erro ao salvar: " + err.message })
    } finally {
      setLoading(false)
      pendingCodeRef.current = null
      pendingTokenRef.current = null
    }
  }, [establishmentId, onComplete])

  const handleMessage = useCallback(async (event: MessageEvent) => {
    const dataStr = typeof event.data === "string" ? event.data : JSON.stringify(event.data)
    console.log("[Meta Embedded Signup] *** ALL MESSAGES *** origin:", event.origin, "data:", dataStr.substring(0, 500))

    if (dataStr.includes("WA_EMBEDDED") || dataStr.includes("embedded") || dataStr.includes("phone_number") || dataStr.includes("waba")) {
      console.log("[Meta Embedded Signup] Potential message:", event.origin, event.data)
    }

    const validOrigins = ["https://www.facebook.com", "https://facebook.com"]
    if (!validOrigins.includes(event.origin)) {
      console.log("[Meta Embedded Signup] REJECTED - origin not valid:", event.origin, "valid:", validOrigins)
      return
    }

    const data = event.data
    if (!data) {
      console.log("[Meta Embedded Signup] REJECTED - no data")
      return
    }

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

      if (parsed.type === "WA_EMBEDDED_SIGNUP" && parsed.data) {
        const { phone_number_id, phoneId, waba_id, whatsappBusinessAccountId, code: msgCode } = parsed.data
        const phoneNumberId = phone_number_id || phoneId
        const wabaId = waba_id || whatsappBusinessAccountId

        addDebug("postMessage: phone=" + phoneNumberId + " waba=" + wabaId)
        addDebug("postMessage code: " + (msgCode ? "SIM (len=" + msgCode.length + ")" : "NAO"))
        addDebug("pendingCodeRef: " + (pendingCodeRef.current ? "SIM (len=" + pendingCodeRef.current.length + ")" : "VAZIO"))

        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)

        let finalCode = msgCode || pendingCodeRef.current

        if (!finalCode) {
          addDebug("Aguardando 3s pro callback do FB...")
          for (let attempt = 0; attempt < 6; attempt++) {
            await new Promise((r) => setTimeout(r, 500))
            if (pendingCodeRef.current) {
              finalCode = pendingCodeRef.current
              addDebug("pegou code do pendingCodeRef: len=" + finalCode.length)
              break
            }
          }
        }

        if (!finalCode) {
          addDebug("Tentando getLoginStatus...")
          try {
            const statusRes = await new Promise<any>((resolve) => {
              window.FB?.getLoginStatus((r: any) => resolve(r), true)
            })
            addDebug("getLoginStatus: " + (statusRes?.authResponse?.code ? "tem code" : statusRes?.authResponse?.accessToken ? "tem token (len=" + statusRes.authResponse.accessToken.length + ")" : "VAZIO"))
            if (statusRes?.authResponse?.code) {
              finalCode = statusRes.authResponse.code
            } else if (statusRes?.authResponse?.accessToken && statusRes.authResponse.accessToken.length > 100) {
              finalCode = statusRes.authResponse.accessToken
            }
          } catch (e: any) {
            addDebug("getLoginStatus erro: " + e.message)
          }
        }

        addDebug("code final: " + (finalCode ? "SIM (len=" + finalCode.length + " starts=" + finalCode.substring(0,5) + ")" : "NAO"))

        addDebug("Enviando pro server...")
        pendingCodeRef.current = null
        setLoading(true)
        setResult(null)

        try {
          await sendToServer(finalCode || "no_code", phoneNumberId || null, wabaId || null)
        } catch (err: any) {
          addDebug("ERRO server: " + err.message)
          setResult({ success: false, error: "Erro ao salvar: " + err.message })
        } finally {
          setLoading(false)
        }
      } else if (parsed.type === "WA_EMBEDDED_SIGNUP_CANCEL") {
        console.log("[Meta Embedded Signup] User cancelled")
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
        setLoading(false)
        setResult({ success: false, error: "Conexao cancelada pelo usuario." })
      } else {
        console.log("[Meta Embedded Signup] Unknown message type:", parsed.type)
      }
    } catch (err: any) {
      console.log("[Meta Embedded Signup] Parse error:", err.message, "raw:", dataStr.substring(0, 300))
    }
  }, [sendToServer])

  useEffect(() => {
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [handleMessage])

  const handleConnect = () => {
    console.log("[Meta Embedded Signup] ===== BUTTON CLICKED =====")
    console.log("[Meta Embedded Signup] FB SDK loaded:", !!window.FB)
    console.log("[Meta Embedded Signup] META_APP_ID:", META_APP_ID)
    console.log("[Meta Embedded Signup] META_CONFIG_ID:", META_CONFIG_ID)

    if (!window.FB) {
      console.log("[Meta Embedded Signup] ERROR - FB SDK not loaded")
      setResult({ success: false, error: "SDK do Facebook nao carregou. Recarregue a pagina." })
      return
    }

    console.log("[Meta Embedded Signup] Calling FB.login with config_id:", META_CONFIG_ID)
    setResult(null)
    setLoading(true)
    pendingCodeRef.current = null

    loadingTimeoutRef.current = setTimeout(() => {
      setLoading(false)
      setResult({ success: false, error: "Tempo esgotado. Tente novamente." })
    }, 120000)

    window.FB.login(
      (response: any) => {
        addDebug("FB.login callback: status=" + response?.status)
        addDebug("authResponse: " + (response?.authResponse ? "EXISTS" : "NULL"))

        if (response?.authResponse) {
          const ar = response.authResponse
          addDebug("code: " + (ar.code ? "SIM (len=" + ar.code.length + ")" : "NAO"))
          addDebug("accessToken: " + (ar.accessToken ? "SIM (len=" + ar.accessToken.length + ")" : "NAO"))

          if (ar.code) {
            pendingCodeRef.current = ar.code
            addDebug("Salvou CODE no pendingCodeRef")
          } else if (ar.accessToken) {
            pendingCodeRef.current = ar.accessToken
            addDebug("Salvou TOKEN no pendingCodeRef (sem code)")
          }
        } else {
          addDebug("SEM authResponse! status=" + response?.status)
        }

        if (response?.status === "not_authorized") {
          if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
          setLoading(false)
          setResult({ success: false, error: "Permissao negada pelo usuario." })
        }
      },
      {
        config_id: META_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        scope: "public_profile,whatsapp_business_management,whatsapp_business_messaging",
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
          Embedded Signup nao configurado. Defina NEXT_PUBLIC_META_APP_ID e NEXT_PUBLIC_META_CONFIG_ID no Vercel.
        </p>
      </div>
    )
  }

  if (selectingPhone) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          Selecione qual numero de WhatsApp conectar:
        </div>
        {phoneOptions.map((phone) => (
          <button
            key={phone.id}
            onClick={() => handleSelectPhone(phone)}
            className="w-full rounded-lg border border-zinc-200 p-3 text-left hover:bg-zinc-50 transition-colors"
          >
            <div className="text-sm font-medium text-zinc-900">{phone.display_phone_number}</div>
            <div className="text-xs text-zinc-500">{phone.verified_name}</div>
          </button>
        ))}
        <button
          onClick={() => { setSelectingPhone(false); setPhoneOptions([]); setLoading(false); setResult(null) }}
          className="text-xs text-zinc-500 hover:text-zinc-700"
        >
          Cancelar
        </button>
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
        <div className={"rounded-lg border p-3 text-xs " + (result.success ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900")}>
          {result.success ? (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>WhatsApp conectado!{result.phone && (" " + result.phone)}</span>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                <span>{result.error}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {debugLog.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2">
          <div className="mb-1 text-[10px] font-semibold text-zinc-500">Debug (visivel na tela):</div>
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {debugLog.map((line, i) => (
              <div key={i} className="text-[10px] font-mono text-zinc-600 break-all">{line}</div>
            ))}
          </div>
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
        Faca login com sua conta Facebook e selecione o numero de WhatsApp Business.
      </p>

      <div className="text-[10px] text-zinc-400">
        SDK: {sdkReady ? "ok" : "carregando..."} | App: {META_APP_ID ? "ok" : "falta"} | Config: {META_CONFIG_ID ? "ok" : "falta"}
      </div>
    </div>
  )
}
