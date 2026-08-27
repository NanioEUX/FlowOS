"use client"

import { useInstallPrompt } from "@/hooks/use-install-prompt"

export function InstallButton({ className }: { className?: string }) {
  const { canInstall, installed, install } = useInstallPrompt()

  if (installed) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 text-xs font-medium" style={{ color: "#16a34a" }}>
          <span>✅</span>
          <span>App instalado</span>
        </div>
      </div>
    )
  }

  if (!canInstall) {
    return (
      <div className={className}>
        <div className="flex items-start gap-2 text-xs" style={{ color: "#71717a" }}>
          <span className="text-base leading-none mt-0.5">📤</span>
          <span className="leading-tight">
            <span className="font-medium">Adicione à tela inicial</span><br />
            Toque no ícone 📤 e depois em "Adicionar à Tela de Início"
          </span>
        </div>
      </div>
    )
  }

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
