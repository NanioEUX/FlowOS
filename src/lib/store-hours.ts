export interface BusinessHoursDay {
  day: string
  open: string
  close: string
  active: boolean
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

export function parseBusinessHours(json: string | null | undefined): BusinessHoursDay[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Loja aberta agora?
 *
 * Semântica de `isOpenOverride` (espelha o painel em
 * `dashboard/(auth)/layout.tsx`):
 *   - true  → forçada aberta
 *   - false → forçada fechada (pausada)
 *   - null  → usa businessHours
 *
 * `businessHours` nulo/vazio = sempre aberta (mesma regra do cardápio).
 * Suporta horário que cruza a meia-noite (ex.: 18:00–02:00).
 */
export function isEstablishmentOpen(establishment: {
  businessHours?: string | null
  isOpenOverride?: boolean | null
}): boolean {
  if (establishment.isOpenOverride === true) return true
  if (establishment.isOpenOverride === false) return false

  const hours = parseBusinessHours(establishment.businessHours)
  if (hours.length === 0) return true

  const now = new Date()
  const dayIndex = now.getDay()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const todayHours = hours.find((h) => {
    const idx = DAY_NAMES_PT_TO_INDEX[String(h?.day || "").toLowerCase().trim()]
    return idx === dayIndex && h?.active
  })
  if (!todayHours || !todayHours.open || !todayHours.close) return false

  const [openH, openM] = String(todayHours.open).split(":").map(Number)
  const [closeH, closeM] = String(todayHours.close).split(":").map(Number)
  if (!Number.isFinite(openH) || !Number.isFinite(openM) || !Number.isFinite(closeH) || !Number.isFinite(closeM)) {
    return false
  }
  const openMinutes = openH * 60 + openM
  const closeMinutes = closeH * 60 + closeM
  if (openMinutes === 0 && closeMinutes === 0) return false

  if (closeMinutes < openMinutes) {
    return currentMinutes >= openMinutes || currentMinutes <= closeMinutes
  }
  return currentMinutes >= openMinutes && currentMinutes < closeMinutes
}
