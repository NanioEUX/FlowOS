import { describe, it, expect } from "vitest"
import { parseOrderItems } from "@/lib/items"
import { redactObject } from "@/lib/redact"

describe("parseOrderItems (F4A-025 — items corrompido não derruba a tela)", () => {
  it("parseia string JSON válida", () => {
    expect(parseOrderItems('[{"name":"Pizza","quantity":2,"price":30}]')).toEqual([
      { name: "Pizza", quantity: 2, price: 30 },
    ])
  })

  it("devolve array já parseado sem alterar", () => {
    const arr = [{ name: "Suco", quantity: 1 }]
    expect(parseOrderItems(arr)).toBe(arr)
  })

  it("devolve [] para JSON corrompido (não lança)", () => {
    expect(parseOrderItems("{isso não é json")).toEqual([])
  })

  it("devolve [] para valores vazios/nulos", () => {
    expect(parseOrderItems(null)).toEqual([])
    expect(parseOrderItems(undefined)).toEqual([])
    expect(parseOrderItems("")).toEqual([])
    expect(parseOrderItems("   ")).toEqual([])
    expect(parseOrderItems(42)).toEqual([])
  })

  it("devolve [] quando o JSON é válido mas não é array", () => {
    expect(parseOrderItems('{"name":"Pizza"}')).toEqual([])
  })
})

describe("redactObject (F4A-014 — token não pode vazar no log)", () => {
  it("redige tokens, segredos e senhas", () => {
    const redacted = redactObject({
      access_token: "EAAabc123",
      client_secret: "s3cr3t",
      password: "hunter2",
      apiKey: "ak_live_1",
      expires_in: 5184000,
    })

    expect(redacted.access_token).toBe("[redacted]")
    expect(redacted.client_secret).toBe("[redacted]")
    expect(redacted.password).toBe("[redacted]")
    expect(redacted.apiKey).toBe("[redacted]")
    // campo não sensível continua visível (o log precisa ser diagnosticável)
    expect(redacted.expires_in).toBe(5184000)
  })

  it("redige dentro de objetos aninhados e arrays", () => {
    const redacted = redactObject({
      data: { access_token: "EAAabc", id: "123" },
      items: [{ token: "t1", name: "Pizza" }],
    })

    expect(redacted.data.access_token).toBe("[redacted]")
    expect(redacted.data.id).toBe("123")
    expect(redacted.items[0].token).toBe("[redacted]")
    expect(redacted.items[0].name).toBe("Pizza")
  })

  it("não quebra com valores primitivos", () => {
    expect(redactObject(null)).toBeNull()
    expect(redactObject(undefined)).toBeUndefined()
    expect(redactObject("texto")).toBe("texto")
  })
})

describe("redactObject — chaves diagnósticas (F4A-018)", () => {
  it("mantém legíveis statusCode/eventCode/codeLength e flags has*", () => {
    const redacted = redactObject({
      statusCode: 429,
      eventCode: "PLACED",
      codeLength: 6,
      hasMetaAccessToken: true,
      hasApiKey: false,
    })

    expect(redacted.statusCode).toBe(429)
    expect(redacted.eventCode).toBe("PLACED")
    expect(redacted.codeLength).toBe(6)
    expect(redacted.hasMetaAccessToken).toBe(true)
    expect(redacted.hasApiKey).toBe(false)
  })

  it("continua redigindo o OTP em `code` e segredos reais", () => {
    const redacted = redactObject({
      code: "123456",
      codeHash: "abc",
      accessToken: "EAAabc",
      paymentLink: "https://pagarme/x",
      resetUrl: "https://app/redefinir?token=abc",
    })

    expect(redacted.code).toBe("[redacted]")
    expect(redacted.codeHash).toBe("[redacted]")
    expect(redacted.accessToken).toBe("[redacted]")
    expect(redacted.paymentLink).toBe("[redacted]")
    expect(redacted.resetUrl).toBe("[redacted]")
  })
})
