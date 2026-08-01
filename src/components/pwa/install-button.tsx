"use client"

import { useInstallPrompt } from "@/hooks/use-install-prompt"

export function InstallButton({ className }: { className?: string }) {
  const { canInstall, installed, install } = useInstallPrompt()

  if (installed) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>✅</span>
          <span>App instalado</span>
        </div>
      </div>
    )
  }

  if (!canInstall) return null

  return (
    <button
      onClick={install}
      className={className || "flex items-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-xs font-medium px-3 py-2 rounded-lg transition-all"}
    >
      <span>📱</span>
      <span>Instalar app</span>
    </button>
  )
}
