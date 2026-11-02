"use client"

import { useEffect } from "react"

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || "dev"

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return

    const register = async () => {
      try {
        // F8A-008: a versão do SW vem do build (query ?v=), não de um número
        // hardcoded em public/sw.js.
        const reg = await navigator.serviceWorker.register(
          `/sw.js?v=${encodeURIComponent(BUILD_ID)}`,
          { scope: "/" }
        )
        console.log("[PWA] Service Worker registrado:", reg.scope)

        // F8A-009: detecta um SW novo esperando para assumir e avisa o app
        // (banner "nova versão disponível") em vez de recarregar sozinho.
        if (reg.waiting) {
          window.dispatchEvent(new CustomEvent("flowos:new-version"))
        }
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing
          if (!installing) return
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent("flowos:new-version"))
            }
          })
        })
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
