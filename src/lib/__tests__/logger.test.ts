import { describe, it, expect, vi, afterEach } from "vitest"
import { logger, getRequestId } from "@/lib/logger"

afterEach(() => {
  vi.restoreAllMocks()
})

function capture(fn: () => void): Record<string, any> {
  const spy = vi.spyOn(console, "log").mockImplementation(() => {})
  const spyErr = vi.spyOn(console, "error").mockImplementation(() => {})
  const spyWarn = vi.spyOn(console, "warn").mockImplementation(() => {})
  fn()
  const line = spy.mock.calls[0]?.[0] ?? spyErr.mock.calls[0]?.[0] ?? spyWarn.mock.calls[0]?.[0]
  return JSON.parse(String(line))
}

describe("logger (F4A-018 — log estruturado com request-id)", () => {
  it("emite JSON com level, scope, message e requestId", () => {
    const payload = capture(() =>
      logger.info("orders-post", "pedido criado", { requestId: "req-123", orderId: "o1" })
    )

    expect(payload.level).toBe("info")
    expect(payload.scope).toBe("orders-post")
    expect(payload.message).toBe("pedido criado")
    expect(payload.requestId).toBe("req-123")
    expect(payload.orderId).toBe("o1")
    expect(typeof payload.time).toBe("string")
  })

  it("redige segredos dentro do contexto", () => {
    const payload = capture(() =>
      logger.error("pagarme", "falha", { requestId: "r", accessToken: "EAAabc", apiKey: "ak_live" })
    )

    expect(payload.accessToken).toBe("[redacted]")
    expect(payload.apiKey).toBe("[redacted]")
    expect(payload.requestId).toBe("r")
  })

  it("usa console.error para nível error e console.warn para warn", () => {
    const spyErr = vi.spyOn(console, "error").mockImplementation(() => {})
    const spyWarn = vi.spyOn(console, "warn").mockImplementation(() => {})

    logger.error("x", "erro")
    logger.warn("x", "aviso")

    expect(spyErr).toHaveBeenCalledTimes(1)
    expect(spyWarn).toHaveBeenCalledTimes(1)
  })

  it("getRequestId lê o header x-request-id", () => {
    const req = { headers: { get: (n: string) => (n === "x-request-id" ? "abc" : null) } }
    expect(getRequestId(req)).toBe("abc")
    expect(getRequestId({ headers: { get: () => null } })).toBeUndefined()
  })
})
