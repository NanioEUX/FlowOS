"use client"

import { useEffect, useState } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showButton, setShowButton] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Verifica se já foi dispensado nesta sessão
    const wasDismissed = sessionStorage.getItem("pwa-install-dismissed")
    if (wasDismissed) setDismissed(true)

    // Verifica se já tá instalado (standalone)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowButton(true)
    }

    window.addEventListener("beforeinstallprompt", handler)

    window.addEventListener("appinstalled", () => {
      setInstalled(true)
      setShowButton(false)
    })

    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      setShowButton(false)
    } else {
      handleDismiss()
    }
    setDeferredPrompt(null)
  }

  function handleDismiss() {
    setDismissed(true)
    sessionStorage.setItem("pwa-install-dismissed", "1")
  }

  if (!showButton || dismissed || installed) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-in slide-in-from-bottom-5">
      <div className="bg-zinc-900 text-white rounded-2xl shadow-2xl p-4 flex items-start gap-3 border border-zinc-700">
        <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center flex-shrink-0">
          <span className="text-lg">📱</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Instalar app</p>
          <p className="text-xs text-zinc-400 mt-0.5">Acesso rápido pelo celular, sem navegador</p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleInstall}
              className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg"
            >
              Instalar
            </button>
            <button
              onClick={handleDismiss}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium px-3 py-1.5 rounded-lg"
            >
              Agora não
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-zinc-500 hover:text-white"
          aria-label="Fechar"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
