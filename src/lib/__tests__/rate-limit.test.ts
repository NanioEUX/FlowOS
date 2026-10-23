import { describe, it, expect } from "vitest"
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit"

describe("rate-limit (F5B-021, tentativas do handshake)", () => {
  it("bloqueia após exceder o máximo e libera no reset", () => {
    const key = `test:handshake:${Math.random()}`
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, 5, 60_000).allowed).toBe(true)
    }
    expect(checkRateLimit(key, 5, 60_000).allowed).toBe(false)

    resetRateLimit(key)
    expect(checkRateLimit(key, 5, 60_000).allowed).toBe(true)
    resetRateLimit(key)
  })

  it("contadores são independentes por chave (pedido × IP)", () => {
    const a = `test:handshake:a:${Math.random()}`
    const b = `test:handshake:b:${Math.random()}`
    expect(checkRateLimit(a, 1, 60_000).allowed).toBe(true)
    expect(checkRateLimit(a, 1, 60_000).allowed).toBe(false)
    expect(checkRateLimit(b, 1, 60_000).allowed).toBe(true)
    resetRateLimit(a)
    resetRateLimit(b)
  })
})
