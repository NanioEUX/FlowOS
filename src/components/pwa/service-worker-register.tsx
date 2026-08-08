"use client"

import { useEffect } from "react"

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" })
        console.log("[PWA] SW registrado:", reg.scope)

        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" })
        }
      } catch (err) {
        console.warn("[PWA] Falha ao registrar SW:", err)
      }
    }

    if (document.readyState === "complete") {
      register()
    } else {
      window.addEventListener("load", register)
      return () => window.removeEventListener("load", register)
    }
  }, [])

  return null
}
