"use client"

import { useEffect, useState } from "react"

const STORAGE_KEY = "pwa-push-subscribed"

/** Salva contexto no IndexedDB para o Service Worker acessar quando event.data é null (iOS) */
async function savePushContext(establishmentId: string, customerKey: string) {
  try {
    const dbReq = indexedDB.open("pedefacil-push", 1)
    dbReq.onupgradeneeded = () => {
      dbReq.result.createObjectStore("context")
    }
    dbReq.onsuccess = () => {
      const tx = dbReq.result.transaction("context", "readwrite")
      tx.objectStore("context").put({ establishmentId, customerKey }, "current")
    }
  } catch {}
}

export function PushSubscribe({ establishmentId, customerKey }: { establishmentId: string; customerKey: string }) {
  const key = customerKey === "anonymous" ? "anonymous" : customerKey.replace(/\D/g, "")
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default")
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setSupported(false)
      return
    }
    setSupported(true)
    setPermission(Notification.permission)
    setEnabled(localStorage.getItem(STORAGE_KEY) === "1")
  }, [])

  // Auto-subscribe when permission is already granted and flag says enabled
  // Também re-registra quando a key muda (cliente se identificou), garantindo
  // que a subscription sempre fique vinculada ao telefone correto.
  useEffect(() => {
    if (!supported || !enabled || permission !== "granted") return
    autoSubscribe()
  }, [supported, enabled, permission, key])

  // Re-registra quando o service worker detecta que a subscription mudou/expirou
  useEffect(() => {
    if (!supported) return
    const handler = async (e: MessageEvent) => {
      if (e.data?.type !== "push-subscription-change") return
      if (permission !== "granted") return
      await autoSubscribe()
    }
    navigator.serviceWorker.addEventListener("message", handler)
    return () => navigator.serviceWorker.removeEventListener("message", handler)
  }, [supported, permission])

  async function autoSubscribe() {
    try {
      const reg = await navigator.serviceWorker.ready

      // Sempre busca a VAPID public key ATUAL do servidor. Se a subscription
      // existente foi criada com outra key (configuração antiga), ela é
      // inválida — damos unsubscribe e recriamos com a key correta.
      const res = await fetch("/api/push/vapid-key")
      const { publicKey } = await res.json()
      if (!publicKey) return

      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        try {
          const currentKey = (existing as any).options?.applicationServerKey
          const currentB64 = currentKey
            ? urlBase64Encode(new Uint8Array(currentKey))
            : null
          if (currentB64 === publicKey) {
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ establishmentId, customerKey: key, subscription: existing.toJSON() }),
      })
      await savePushContext(establishmentId, key)
      return
          }
          await existing.unsubscribe()
        } catch {
          await existing.unsubscribe().catch(() => {})
        }
      }

      const convertedKey = urlBase64ToUint8Array(publicKey)
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      })

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ establishmentId, customerKey: key, subscription: subscription.toJSON() }),
      })
      await savePushContext(establishmentId, key)
    } catch (e) {
      console.error("[Push] auto-subscribe error:", e)
    }
  }

  async function toggleNotifications() {
    if (loading) return
    setLoading(true)
    try {
      if (enabled) {
        // DESATIVAR
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint, establishmentId }),
          })
          await sub.unsubscribe()
        }
        localStorage.removeItem(STORAGE_KEY)
        setEnabled(false)
      } else {
        // ATIVAR
        if (permission === "denied") {
          setLoading(false)
          return
        }
        if (permission === "default") {
          const perm = await Notification.requestPermission()
          setPermission(perm)
          if (perm !== "granted") {
            setLoading(false)
            return
          }
        }
        localStorage.setItem(STORAGE_KEY, "1")
        setEnabled(true)
        await autoSubscribe()
      }
    } catch (e) {
      console.error("[Push] toggle error:", e)
    } finally {
      setLoading(false)
    }
  }

  if (!supported) {
    return (
      <div className="flex items-center justify-between w-full rounded-lg p-3" style={{ backgroundColor: "rgba(0,0,0,0.03)" }}>
        <div className="flex items-center gap-2">
          <span>🔕</span>
          <span className="text-sm font-medium" style={{ color: "#71717a" }}>Notificações indisponíveis neste navegador</span>
        </div>
      </div>
    )
  }

  if (permission === "denied") {
    return (
      <div className="flex items-center justify-between w-full rounded-lg p-3" style={{ backgroundColor: "rgba(0,0,0,0.03)" }}>
        <div className="flex items-center gap-2">
          <span>🔕</span>
          <span className="text-sm font-medium" style={{ color: "#71717a" }}>Notificações bloqueadas nas configurações</span>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={toggleNotifications}
      disabled={loading}
      className="flex items-center justify-between w-full rounded-lg p-3 transition-all"
      style={{ backgroundColor: enabled ? "rgba(34,197,94,0.1)" : "rgba(0,0,0,0.03)" }}
    >
      <div className="flex items-center gap-2">
        <span>{enabled ? "🔔" : "🔕"}</span>
        <span className="text-sm font-medium" style={{ color: enabled ? "#16a34a" : "#71717a" }}>
          {loading ? "Processando..." : enabled ? "Notificações ativas" : "Notificações desativadas"}
        </span>
      </div>
      <div
        className="relative h-6 w-11 rounded-full transition-colors"
        style={{ backgroundColor: enabled ? "#22c55e" : "#d4d4d8" }}
      >
        <div
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
          style={{ transform: enabled ? "translateX(22px)" : "translateX(2px)" }}
        />
      </div>
    </button>
  )
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i)
  return output
}

function urlBase64Encode(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
