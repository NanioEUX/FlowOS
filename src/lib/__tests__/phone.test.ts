import { describe, it, expect } from "vitest"
import { normalizePhone, maskPhone } from "@/lib/phone"

describe("normalizePhone (F7A-010)", () => {
  it("aceita DDD + celular (11 dígitos)", () => {
    expect(normalizePhone("47999998888")).toBe("47999998888")
  })

  it("aceita DDD + fixo (10 dígitos)", () => {
    expect(normalizePhone("4733331234")).toBe("4733331234")
  })

  it("remove formatação", () => {
    expect(normalizePhone("(47) 99999-8888")).toBe("47999998888")
  })

  it("remove prefixo 55 (E.164 do WhatsApp/bot)", () => {
    expect(normalizePhone("5547999998888")).toBe("47999998888")
  })

  it("remove prefixo 0055", () => {
    expect(normalizePhone("005547999998888")).toBe("47999998888")
  })

  it("rejeita números curtos/longos demais", () => {
    expect(normalizePhone("99999888")).toBeNull()
    expect(normalizePhone("55479999988881")).toBeNull()
    expect(normalizePhone("")).toBeNull()
    expect(normalizePhone(null)).toBeNull()
  })
})

describe("maskPhone (logs)", () => {
  it("mascara o meio do número", () => {
    expect(maskPhone("47999998888")).toBe("47*****888")
  })
})
