import { describe, it, expect } from "vitest"
import {
  dayKeyInTz,
  startOfInclusiveDay,
  endOfInclusiveDay,
  dayRangeFilter,
  startOfTodayInTz,
} from "@/lib/finance-dates"

describe("finance-dates (fuso do negócio, F5A-044)", () => {
  it("agrupa no dia local de Brasília, não no UTC do servidor", () => {
    // 01:00Z de 19/10 = 22:00 de 18/10 em Brasília
    expect(dayKeyInTz(new Date("2026-10-19T01:00:00Z"))).toBe("2026-10-18")
    // 03:00Z de 19/10 = 00:00 de 19/10 em Brasília
    expect(dayKeyInTz(new Date("2026-10-19T03:00:00Z"))).toBe("2026-10-19")
    // 23:30Z de 18/10 = 20:30 de 18/10 em Brasília (dia correto)
    expect(dayKeyInTz(new Date("2026-10-18T23:30:00Z"))).toBe("2026-10-18")
  })

  it("limites inclusivos do dia em UTC coerentes com o fuso (-03:00)", () => {
    expect(startOfInclusiveDay("2026-10-18").toISOString()).toBe("2026-10-18T03:00:00.000Z")
    expect(endOfInclusiveDay("2026-10-18").toISOString()).toBe("2026-10-19T02:59:59.999Z")
  })

  it("dayRangeFilter monta o where inclusivo completo", () => {
    const r = dayRangeFilter("2026-10-01", "2026-10-18")
    expect(r.gte?.toISOString()).toBe("2026-10-01T03:00:00.000Z")
    expect(r.lte?.toISOString()).toBe("2026-10-19T02:59:59.999Z")
    expect(dayRangeFilter(null, null)).toEqual({})
    expect(dayRangeFilter(undefined, undefined)).toEqual({})
  })

  it("startOfTodayInTz é 00:00 local do próprio dia", () => {
    const now = new Date("2026-10-18T20:00:00Z") // 17:00 local
    expect(startOfTodayInTz(now).toISOString()).toBe("2026-10-18T03:00:00.000Z")
    expect(startOfTodayInTz(now).getTime() <= now.getTime()).toBe(true)
  })
})
