"use client"

import { useEffect, useState } from "react"

const STORAGE_KEY = "pwa-push-subscribed"

export function PushSubscribe({ establishmentId, customerKey }: { establishmentId: string; customerKey: string }) {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default")
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setSupported(false)
      return
    }
    setSupported(true)
    setPermission(Notification.permission)
    setSubscribed(localStorage.getItem(STORAGE_KEY) === "1")
  }, [])

  async function subscribe() {
    if (!supported) return
    setLoading(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== "granted") return

      const reg = await navigator.serviceWorker.ready

      // Busca VAPID public key do servidor
      const res = await fetch("/api/push/vapid-key")
      const { publicKey } = await res.json()
      if (!publicKey) {
        alert("Push não configurado no servidor")
        return
      }

      const convertedKey = urlBase64ToUint8Array(publicKey)
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      })

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          establishmentId,
          customerKey,
          subscription: subscription.toJSON(),
        }),
      })

      localStorage.setItem(STORAGE_KEY, "1")
      setSubscribed(true)
    } catch (e) {
      console.error("[Push] erro:", e)
    } finally {
      setLoading(false)
    }
  }

  if (!supported || permission === "denied") return null
  if (subscribed) return null

  return (
    <button
      onClick={subscribe}
      disabled={loading}
      className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-medium px-3 py-2 rounded-lg transition-all"
    >
      <span>🔔</span>
      <span>{loading ? "Ativando..." : "Receber avisos do pedido"}</span>
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
