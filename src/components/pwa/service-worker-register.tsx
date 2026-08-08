"use client"

import { useEffect } from "react"

const SW_VERSION = "v10"

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register(`/sw.js?v=${SW_VERSION}`, { scope: "/" })
        console.log("[PWA] Service Worker registrado:", reg.scope)

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "activated") {
              console.log("[PWA] Novo SW ativo, recarregando...")
              window.location.reload()
            }
          })
        })

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
