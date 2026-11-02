import { describe, it, expect } from "vitest"
import { pickUpdateData } from "@/lib/safe-update"

describe("pickUpdateData (F2-001 — mass assignment)", () => {
  const allowed = ["name", "price", "badge", "categoryId"] as const

  it("mantém apenas chaves da whitelist", () => {
    const data = pickUpdateData(
      { name: "X", price: 10, establishmentId: "outro-tenant", id: "trocado" },
      allowed
    )
    expect(data).toEqual({ name: "X", price: 10 })
    expect(data).not.toHaveProperty("establishmentId")
    expect(data).not.toHaveProperty("id")
  })

  it("descarta valores objeto/array (nested write do Prisma)", () => {
    const data = pickUpdateData(
      {
        name: "X",
        category: { connect: { id: "alheia" } },
        likes: { increment: 999 },
        stockLinks: { deleteMany: {} },
      },
      allowed
    )
    expect(data).toEqual({ name: "X" })
  })

  it("aceita null (campos anuláveis) e ignora undefined", () => {
    const data = pickUpdateData({ badge: null, price: undefined }, allowed)
    expect(data).toEqual({ badge: null })
  })

  it("retorna vazio para body que não é objeto", () => {
    expect(pickUpdateData(null, allowed)).toEqual({})
    expect(pickUpdateData("x", allowed)).toEqual({})
    expect(pickUpdateData([1, 2], allowed)).toEqual({})
  })
})
