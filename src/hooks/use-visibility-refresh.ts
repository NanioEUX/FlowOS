"use client"

import { useEffect, useRef } from "react"

// F3C-001: enquanto a aba está em segundo plano o poll continua envelhecendo;
// quando ela volta a ficar visível, refaz o fetch na hora em vez de esperar o
// próximo tick do intervalo.
export function useVisibilityRefresh(refresh: () => void, enabled = true) {
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  useEffect(() => {
    if (!enabled) return
    const onVisible = () => {
      if (!document.hidden) refreshRef.current()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [enabled])
}
