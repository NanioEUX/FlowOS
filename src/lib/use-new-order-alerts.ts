import { useEffect, useRef } from "react"
import { playKitchenBeep } from "@/components/sound-control"

/**
 * Requests browser notification permission on first call.
 * Safe to call multiple times — only prompts once.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false
  if (Notification.permission === "granted") return true
  if (Notification.permission === "denied") return false
  try {
    const result = await Notification.requestPermission()
    return result === "granted"
  } catch {
    return false
  }
}

function readSoundPrefs(storageKey = "atendimento_sound"): { enabled: boolean; volume: number } {
  if (typeof window === "undefined") return { enabled: true, volume: 0.7 }
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : true,
        volume: typeof parsed.volume === "number" ? parsed.volume : 0.7,
      }
    }
  } catch {}
  return { enabled: true, volume: 0.7 }
}

/**
 * Plays the kitchen beep pattern (3 cycles of double-beep) when a new order
 * arrives. Volume and on/off are read from localStorage.
 */
export function playNewOrderSound() {
  if (typeof window === "undefined") return
  const { enabled, volume } = readSoundPrefs()
  if (!enabled) return
  try {
    playKitchenBeep(volume, 3)
  } catch {}
}

/**
 * Shows a desktop notification when the page is hidden or in background.
 */
export function notifyNewOrder(order: { id: string; customerName: string; total: number; method?: string }) {
  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission !== "granted") return
  if (document.visibilityState !== "hidden") return

  try {
    const title = order.method === "ifood" ? "🍔 Pedido iFood" : "🛎️ Novo pedido"
    const body = `${order.customerName} — R$ ${order.total.toFixed(2).replace(".", ",")}`
    new Notification(title, { body, tag: order.id })
  } catch {}
}

/**
 * Hook that fires sound + desktop notification when a new order arrives.
 * Pass the latest list of orders and a key (e.g. id) per order.
 */
export function useNewOrderAlerts(orders: any[]) {
  const seenIdsRef = useRef<Set<string>>(new Set())
  const initialisedRef = useRef(false)

  useEffect(() => {
    if (!initialisedRef.current && orders.length > 0) {
      // Seed the seen set on first render so we don't alert for orders already
      // present when the page loads.
      orders.forEach((o) => seenIdsRef.current.add(o.id))
      initialisedRef.current = true
      return
    }

    const fresh: any[] = []
    for (const o of orders) {
      if (!seenIdsRef.current.has(o.id)) {
        seenIdsRef.current.add(o.id)
        fresh.push(o)
      }
    }

    if (fresh.length === 0) return

    playNewOrderSound()
    fresh.forEach(notifyNewOrder)
  }, [orders])
}

export default useNewOrderAlerts
