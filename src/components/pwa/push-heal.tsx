"use client"

// Verifica no load da página se a push subscription existente ainda é válida
// para a VAPID key atual do servidor. Se foi criada com uma key antiga
// (configuração anterior), recria com a key atual e re-registra no backend.
// Roda de forma autônoma (não precisa abrir o Perfil).

import { useEffect } from "react"

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

async function healSubscription(establishmentId: string, customerKey: string) {
  try {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return
    if (Notification.permission !== "granted") return

    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    if (!existing) return

    const res = await fetch("/api/push/vapid-key")
    const { publicKey } = await res.json()
    if (!publicKey) return

    const currentKey = (existing as any).options?.applicationServerKey
    const currentB64 = currentKey ? urlBase64Encode(new Uint8Array(currentKey)) : null
    if (currentB64 === publicKey) return

    // Key antiga: recria a subscription com a key atual
    await existing.unsubscribe().catch(() => {})
    const convertedKey = urlBase64ToUint8Array(publicKey)
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedKey,
    })
    const key = customerKey === "anonymous" ? "anonymous" : customerKey.replace(/\D/g, "")
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ establishmentId, customerKey: key, subscription: subscription.toJSON() }),
    })
    console.log("[PushHeal] Subscription recriada com a VAPID key atual")
  } catch (e) {
    console.error("[PushHeal] erro:", e)
  }
}

export function PushHeal({ establishmentId, customerKey }: { establishmentId: string; customerKey: string }) {
  useEffect(() => {
    const key = customerKey === "anonymous" ? "anonymous" : customerKey.replace(/\D/g, "")
    healSubscription(establishmentId, key)
  }, [establishmentId, customerKey])

  return null
}
