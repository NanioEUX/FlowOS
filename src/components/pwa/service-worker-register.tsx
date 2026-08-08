"use client"

import { useEffect } from "react"

const SW_VERSION = "v11"

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register(`/sw.js?v=${SW_VERSION}`, { scope: "/" })
        console.log("[PWA] Service Worker registrado:", reg.scope)

        // Força busca de atualização em cada load
        await reg.update()
        console.log("[PWA] SW update check concluído")

        // Se tem SW esperando, ativa ele
        if (reg.waiting) {
          console.log("[PWA] SW waiting encontrado, ativando...")
          reg.waiting.postMessage({ type: "SKIP_WAITING" })
        }

        // Quando um novo SW for instalado, ativa e recarrega
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing
          if (!newWorker) return
          console.log("[PWA] Novo SW instalando...")
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "activated") {
              console.log("[PWA] Novo SW ativo!")
              window.location.reload()
            }
          })
        })

        // Quando o controller muda (novo SW assumiu)
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          console.log("[PWA] Controller mudou, recarregando...")
          window.location.reload()
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
