import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { fetchExternalWithRetry } from "@/lib/fetch-external"

describe("fetchExternalWithRetry (F4A-011 — retry em falha transitória)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("repete em 503 e devolve a resposta bem-sucedida", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("erro", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const promise = fetchExternalWithRetry("https://api.exemplo.com/x", { method: "GET" })
    await vi.runAllTimersAsync()
    const res = await promise

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("não repete em 400 (erro do cliente)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bad", { status: 400 }))
    vi.stubGlobal("fetch", fetchMock)

    const promise = fetchExternalWithRetry("https://api.exemplo.com/x", { method: "GET" })
    await vi.runAllTimersAsync()
    const res = await promise

    expect(res.status).toBe(400)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("não repete POST por padrão (pode duplicar cobrança)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("erro", { status: 500 }))
    vi.stubGlobal("fetch", fetchMock)

    const promise = fetchExternalWithRetry("https://api.exemplo.com/x", { method: "POST" })
    await vi.runAllTimersAsync()
    const res = await promise

    expect(res.status).toBe(500)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("repete POST quando marcado como retryable", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("erro", { status: 500 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const promise = fetchExternalWithRetry("https://api.exemplo.com/x", {
      method: "POST",
      retryable: true,
    })
    await vi.runAllTimersAsync()
    const res = await promise

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("repete erro de rede (TypeError)", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const promise = fetchExternalWithRetry("https://api.exemplo.com/x", { method: "GET" })
    await vi.runAllTimersAsync()
    const res = await promise

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("desiste depois do número de tentativas e devolve o último status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("erro", { status: 503 }))
    vi.stubGlobal("fetch", fetchMock)

    const promise = fetchExternalWithRetry("https://api.exemplo.com/x", {
      method: "GET",
      retries: 2,
    })
    await vi.runAllTimersAsync()
    const res = await promise

    expect(res.status).toBe(503)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
