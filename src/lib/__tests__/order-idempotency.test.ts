import { describe, it, expect } from "vitest"
import {
  extractClientRequestId,
  normalizeClientRequestId,
  idempotencyLookup,
  IDEMPOTENCY_HEADER,
  MAX_CLIENT_REQUEST_ID_LENGTH,
} from "@/lib/order-idempotency"

describe("normalizeClientRequestId (F4B-019)", () => {
  it("aceita chave alfanumérica com separadores", () => {
    expect(normalizeClientRequestId("abc-123_x.y:z")).toBe("abc-123_x.y:z")
  })

  it("faz trim e devolve null para vazio/ausente", () => {
    expect(normalizeClientRequestId("  key-1  ")).toBe("key-1")
    expect(normalizeClientRequestId("")).toBeNull()
    expect(normalizeClientRequestId("   ")).toBeNull()
    expect(normalizeClientRequestId(undefined)).toBeNull()
    expect(normalizeClientRequestId(null)).toBeNull()
    expect(normalizeClientRequestId(123)).toBeNull()
  })

  it("recusa chave longa demais", () => {
    expect(normalizeClientRequestId("a".repeat(MAX_CLIENT_REQUEST_ID_LENGTH))).toHaveLength(
      MAX_CLIENT_REQUEST_ID_LENGTH
    )
    expect(normalizeClientRequestId("a".repeat(MAX_CLIENT_REQUEST_ID_LENGTH + 1))).toBeNull()
  })

  it("recusa caracteres fora do charset", () => {
    expect(normalizeClientRequestId("key with space")).toBeNull()
    expect(normalizeClientRequestId("key/with/slash")).toBeNull()
    expect(normalizeClientRequestId("chave-çã")).toBeNull()
  })
})

describe("extractClientRequestId (F4B-019)", () => {
  it("lê o header Idempotency-Key", () => {
    const req = { headers: { get: (n: string) => (n === IDEMPOTENCY_HEADER ? "key-1" : null) } }
    expect(extractClientRequestId(req)).toBe("key-1")
  })

  it("aceita o header x-idempotency-key", () => {
    const req = { headers: { get: (n: string) => (n === `x-${IDEMPOTENCY_HEADER}` ? "key-2" : null) } }
    expect(extractClientRequestId(req)).toBe("key-2")
  })

  it("prefere o header padrão quando os dois existem", () => {
    const req = {
      headers: {
        get: (n: string) =>
          n === IDEMPOTENCY_HEADER ? "padrao" : n === `x-${IDEMPOTENCY_HEADER}` ? "alternativo" : null,
      },
    }
    expect(extractClientRequestId(req)).toBe("padrao")
  })

  it("devolve null quando não há header", () => {
    expect(extractClientRequestId({ headers: { get: () => null } })).toBeNull()
  })
})

describe("idempotencyLookup (F4B-019)", () => {
  it("monta o filtro quando há chave", () => {
    expect(idempotencyLookup("est-1", "key-1")).toEqual({
      establishmentId: "est-1",
      clientRequestId: "key-1",
    })
  })

  it("devolve null sem chave (não há o que buscar)", () => {
    expect(idempotencyLookup("est-1", null)).toBeNull()
  })
})
