"use client"

import { useEffect, useState } from "react"
import { WifiOff } from "lucide-react"

/**
 * F8B-012: banner de offline.
 *
 * Sem isso, uma queda de rede no meio de uma operação (caixa, KDS, cardápio)
 * produz spinner infinito ou erro silencioso: o operador não sabe se a
 * requisição falhou ou se a página travou.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-zinc-900"
    >
      <WifiOff aria-hidden="true" className="h-4 w-4 shrink-0" />
      Sem conexão com a internet. As alterações só serão enviadas quando a rede voltar.
    </div>
  )
}
