"use client"

import { useCallback, useRef, useState } from "react"

// F8C-001: trava de re-entrância para ações do PDV. Um state sozinho não
// protege — dois cliques no mesmo tick leem o mesmo estado antes do
// re-render; o ref bloqueia síncrono e o state alimenta o disabled/"...".
export function useSubmitGuard() {
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (busyRef.current) return undefined
    busyRef.current = true
    setBusy(true)
    try {
      return await fn()
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [])

  return { run, busy }
}
