"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCw } from "lucide-react"

/**
 * F8B-003: antes não havia `error.tsx` em nenhuma rota — qualquer exceção
 * caía na tela genérica do Next, sem identidade e sem chance de retry.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[App] Erro na renderização:", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
        <AlertTriangle aria-hidden="true" className="h-7 w-7 text-red-600" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Algo deu errado</h1>
        <p className="mt-1 max-w-md text-sm text-zinc-600">
          Não foi possível carregar esta tela. Seus dados não foram perdidos — tente novamente.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-zinc-400">Código: {error.digest}</p>
        )}
      </div>
      <button
        onClick={() => reset()}
        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
      >
        <RotateCw aria-hidden="true" className="h-4 w-4" />
        Tentar novamente
      </button>
    </div>
  )
}
