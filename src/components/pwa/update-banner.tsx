"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw, X } from "lucide-react"

/**
 * F8A-004/F8A-009: banner "nova versão disponível".
 *
 * Antes, o service worker recarregava todas as janelas abertas assim que
 * assumia o controle (`client.navigate`) — sem aviso, perdendo o estado do
 * KDS, modais abertos, rascunhos de chat e abortando POST em curso.
 * Agora o app pergunta ao usuário.
 */
export function UpdateBanner() {
  const [visible, setVisible] = useState(false)

  const show = useCallback(() => {
    try {
      if (sessionStorage.getItem("flowos-update-dismissed") === "1") return
    } catch {}
    setVisible(true)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "new-version-available") show()
    }
    const onEvent = () => show()
    window.addEventListener("flowos:new-version", onEvent)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onMessage)
    }
    return () => {
      window.removeEventListener("flowos:new-version", onEvent)
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onMessage)
      }
    }
  }, [show])

  const applyUpdate = useCallback(async () => {
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration()
        const waiting = reg?.waiting
        if (waiting) {
          await new Promise<void>((resolve) => {
            navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
              once: true,
            })
            waiting.postMessage({ type: "SKIP_WAITING" })
          })
        }
      }
    } catch {}
    window.location.reload()
  }, [])

  const dismiss = useCallback(() => {
    setVisible(false)
    try {
      sessionStorage.setItem("flowos-update-dismissed", "1")
    } catch {}
  }, [])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-[150] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-white shadow-2xl"
    >
      <div className="flex-1 text-sm">
        <p className="font-semibold">Nova versão disponível</p>
        <p className="text-xs text-zinc-400">Atualize para não perder nada do que está em aberto.</p>
      </div>
      <button
        onClick={applyUpdate}
        className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-700"
      >
        <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
        Atualizar
      </button>
      <button
        onClick={dismiss}
        aria-label="Dispensar aviso de atualização"
        className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  )
}
