"use client"

import { useEffect, useState } from "react"
import { useInstallPrompt } from "@/hooks/use-install-prompt"

interface Props {
  show: boolean
}

export function InstallPromptToast({ show }: Props) {
  const { canInstall, install } = useInstallPrompt()
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    setDismissed(sessionStorage.getItem("pwa-install-toast-dismissed") === "1")
  }, [])

  useEffect(() => {
    if (show && canInstall && !dismissed) {
      setVisible(true)
    } else {
      setVisible(false)
    }
  }, [show, canInstall, dismissed])

  function handleDismiss() {
    setVisible(false)
    setDismissed(true)
    sessionStorage.setItem("pwa-install-toast-dismissed", "1")
  }

  async function handleInstall() {
    await install()
    handleDismiss()
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-zinc-900 text-white rounded-2xl shadow-2xl p-4 flex items-start gap-3 border border-zinc-700">
        <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center flex-shrink-0">
          <span className="text-lg">📱</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Instale o app</p>
          <p className="text-xs text-zinc-400 mt-0.5">Acompanhe seus pedidos mais rápido</p>
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
