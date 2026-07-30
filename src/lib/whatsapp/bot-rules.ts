import { prisma } from "@/lib/prisma"

export interface BusinessHoursDay {
  day: string
  open: string
  close: string
  active: boolean
}

export function parseBusinessHours(json: string | null | undefined): BusinessHoursDay[] {
  if (!json) return []
  try {
    return JSON.parse(json)
  } catch {
    return []
  }
}

const DAY_NAMES_PT_TO_INDEX: Record<string, number> = {
  "domingo": 0,
  "segunda": 1,
  "segunda-feira": 1,
  "terça": 2,
  "terca": 2,
  "quarta": 3,
  "quinta": 4,
  "sexta": 5,
  "sábado": 6,
  "sabado": 6,
}

export function isOpenNow(businessHours: BusinessHoursDay[]): boolean {
  if (businessHours.length === 0) return true
  const now = new Date()
  const dayIndex = now.getDay()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const todayHours = businessHours.find((h) => {
    const idx = DAY_NAMES_PT_TO_INDEX[h.day.toLowerCase().trim()]
    return idx === dayIndex && h.active
  })

  if (!todayHours) return false

  const [openH, openM] = todayHours.open.split(":").map(Number)
  const [closeH, closeM] = todayHours.close.split(":").map(Number)
  const openMinutes = openH * 60 + openM
  const closeMinutes = closeH * 60 + closeM

  if (openMinutes === 0 && closeMinutes === 0) return false

  if (closeMinutes < openMinutes) {
    return currentMinutes >= openMinutes || currentMinutes <= closeMinutes
  }
  return currentMinutes >= openMinutes && currentMinutes <= closeMinutes
}

export function formatBusinessHoursForMessage(businessHours: BusinessHoursDay[]): string {
  const active = businessHours.filter((h) => h.active)
  if (active.length === 0) return ""
  return active.map((h) => `${h.day}: ${h.open} às ${h.close}`).join("\n")
}

export function randomTypingDelay(minMs: number, maxMs: number): number {
  const min = Math.min(minMs, maxMs)
  const max = Math.max(minMs, maxMs)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function parseTransferKeywords(csv: string | null | undefined): string[] {
  if (!csv) return []
  return csv
    .split(",")
    .map((k) => k.toLowerCase().trim())
    .filter(Boolean)
}

export function detectTransferIntent(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase().trim()
  return keywords.some((k) => normalized.includes(k))
}
