export const UNITS = [
  { value: "g", label: "Gramas (g)" },
  { value: "kg", label: "Quilogramas (kg)" },
  { value: "ml", label: "Mililitros (ml)" },
  { value: "L", label: "Litros (L)" },
  { value: "un", label: "Unidades (un)" },
] as const

export type Unit = (typeof UNITS)[number]["value"]

export function formatQuantity(qty: number, unit: string): string {
  if (unit === "g" && qty >= 1000) return `${(qty / 1000).toFixed(2)} kg`
  if (unit === "ml" && qty >= 1000) return `${(qty / 1000).toFixed(2)} L`
  if (unit === "kg" && qty < 1) return `${(qty * 1000).toFixed(0)} g`
  if (unit === "L" && qty < 1) return `${(qty * 1000).toFixed(0)} ml`
  return `${qty} ${unit}`
}

/**
 * Converte uma quantidade de uma unidade pra outra.
 * Suporta: g<->kg, ml<->L, un (sem conversão).
 * Retorna null se as unidades forem incompatíveis (ex: g vs L, un vs kg).
 */
export function convertQuantity(
  qty: number,
  fromUnit: string,
  toUnit: string
): number | null {
  if (fromUnit === toUnit) return qty
  const mass = { g: 1, kg: 1000 }
  const volume = { ml: 1, L: 1000 }
  if (fromUnit in mass && toUnit in mass) {
    return (qty * mass[fromUnit as "g" | "kg"]) / mass[toUnit as "g" | "kg"]
  }
  if (fromUnit in volume && toUnit in volume) {
    return (qty * volume[fromUnit as "ml" | "L"]) / volume[toUnit as "ml" | "L"]
  }
  return null
}
