"use client"

import { useEffect, useState, useCallback } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

let cachedPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<(evt: BeforeInstallPromptEvent | null) => void>()

function emit(evt: BeforeInstallPromptEvent | null) {
  cachedPrompt = evt
  listeners.forEach((l) => l(evt))
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault()
    emit(e as BeforeInstallPromptEvent)
  })
  window.addEventListener("appinstalled", () => {
    cachedPrompt = null
    emit(null)
  })
}

export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(cachedPrompt)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true)
    }
    const l = (e: BeforeInstallPromptEvent | null) => {
      setPromptEvent(e)
      if (!e) setInstalled(true)
    }
    listeners.add(l)
    setPromptEvent(cachedPrompt)
    return () => {
      listeners.delete(l)
    }
  }, [])

  const install = useCallback(async () => {
    if (!promptEvent) return false
    promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === "accepted") {
      setInstalled(true)
    }
    emit(null)
    setPromptEvent(null)
    return outcome === "accepted"
  }, [promptEvent])

  return { canInstall: !!promptEvent && !installed, installed, install }
}
