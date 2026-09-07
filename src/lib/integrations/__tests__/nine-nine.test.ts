import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { EventEmitter } from "events"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))

const mockReqEnd = vi.fn()
const mockReqWrite = vi.fn()
let mockReqInstance: any

function createMockReq() {
  mockReqInstance = new EventEmitter()
  mockReqInstance.write = mockReqWrite
  mockReqInstance.end = mockReqEnd
  return mockReqInstance
}

vi.mock("https", () => ({
  default: {
    request: vi.fn((opts: any, cb: any) => {
      const req = createMockReq()
      return req
    }),
  },
}))

function simulateResponse(body: string | object, statusCode = 200) {
  const data = typeof body === "string" ? body : JSON.stringify(body)
  process.nextTick(() => {
    const mockRes = new EventEmitter()
    ;(mockRes as any).statusCode = statusCode
    const cb = (vi.mocked(https.request) as any).mock.calls[0]?.[1]
    if (cb) cb(mockRes)
    mockRes.emit("data", data)
    mockRes.emit("end")
  })
}

import https from "https"

beforeEach(() => {
  vi.clearAllMocks()
  mockReqEnd.mockImplementation(function (this: any) {
    return this
  })
})

async function loadNineNine() {
  return await import("@/lib/integrations/nine-nine")
}

describe("validarCredenciais99", () => {
  it("retorna success: true quando API retorna 200", async () => {
    vi.mocked(https.request).mockImplementation(function (this: any, opts: any, cb: any) {
      const req = new EventEmitter()
      ;(req as any).write = vi.fn()
      ;(req as any).end = vi.fn(function (this: any) {
        process.nextTick(() => {
          const res = new EventEmitter()
          ;(res as any).statusCode = 200
          if (cb) cb(res)
          res.emit("data", JSON.stringify({ message: "pong" }))
          res.emit("end")
        })
        return this
      })
      return req
    } as any)

    const { validarCredenciais99 } = await loadNineNine()
    const result = await validarCredenciais99("test-key", "emp-123")

    expect(result).toEqual({ success: true, message: "pong" })
    expect(https.request).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: "api.99app.com",
        path: "/v1/employees/emp-123/ping",
        method: "GET",
      }),
      expect.any(Function)
    )
  })

  it("retorna success: false quando API retorna 401", async () => {
    vi.mocked(https.request).mockImplementation(function (this: any, opts: any, cb: any) {
      const req = new EventEmitter()
      ;(req as any).write = vi.fn()
      ;(req as any).end = vi.fn(function (this: any) {
        process.nextTick(() => {
          const res = new EventEmitter()
          ;(res as any).statusCode = 401
          if (cb) cb(res)
          res.emit("data", "Unauthorized")
          res.emit("end")
        })
        return this
      })
      return req
    } as any)

    const { validarCredenciais99 } = await loadNineNine()
    const result = await validarCredenciais99("bad-key", "emp-123")

    expect(result.success).toBe(false)
    expect(result.error).toContain("401")
  })

  it("retorna success: false quando API retorna 500", async () => {
    vi.mocked(https.request).mockImplementation(function (this: any, opts: any, cb: any) {
      const req = new EventEmitter()
      ;(req as any).write = vi.fn()
      ;(req as any).end = vi.fn(function (this: any) {
        process.nextTick(() => {
          const res = new EventEmitter()
          ;(res as any).statusCode = 500
          if (cb) cb(res)
          res.emit("data", "Internal Server Error")
          res.emit("end")
        })
        return this
      })
      return req
    } as any)

    const { validarCredenciais99 } = await loadNineNine()
    const result = await validarCredenciais99("key", "emp-123")

    expect(result.success).toBe(false)
    expect(result.error).toContain("500")
  })

  it("retorna erro de conexão quando API está offline", async () => {
    vi.mocked(https.request).mockImplementation(function (this: any) {
      const req = new EventEmitter()
      ;(req as any).write = vi.fn()
      ;(req as any).end = vi.fn(function (this: any) {
        process.nextTick(() => {
          req.emit("error", new Error("ECONNREFUSED"))
        })
        return this
      })
      return req
    } as any)

    const { validarCredenciais99 } = await loadNineNine()
    const result = await validarCredenciais99("key", "emp-123")

    expect(result.success).toBe(false)
    expect(result.error).toContain("conexão")
  })

  it("retorna erro quando resposta não é JSON válido", async () => {
    vi.mocked(https.request).mockImplementation(function (this: any, opts: any, cb: any) {
      const req = new EventEmitter()
      ;(req as any).write = vi.fn()
      ;(req as any).end = vi.fn(function (this: any) {
        process.nextTick(() => {
          const res = new EventEmitter()
          ;(res as any).statusCode = 200
          if (cb) cb(res)
          res.emit("data", "not json")
          res.emit("end")
        })
        return this
      })
      return req
    } as any)

    const { validarCredenciais99 } = await loadNineNine()
    const result = await validarCredenciais99("key", "emp-123")

    expect(result.success).toBe(false)
    expect(result.error).toContain("processar resposta")
  })
})

describe("buscarEstimativa99", () => {
  it("retorna estimatedValue e estimatedTime com sucesso", async () => {
    vi.mocked(https.request).mockImplementation(function (this: any, opts: any, cb: any) {
      const req = new EventEmitter()
      ;(req as any).write = vi.fn()
      ;(req as any).end = vi.fn(function (this: any) {
        process.nextTick(() => {
          const res = new EventEmitter()
          ;(res as any).statusCode = 200
          if (cb) cb(res)
          res.emit("data", JSON.stringify({ rideId: "ride-abc", estimatedValue: 15.5, estimatedTime: 25 }))
          res.emit("end")
        })
        return this
      })
      return req
    } as any)

    const { buscarEstimativa99 } = await loadNineNine()
    const result = await buscarEstimativa99("key", "emp-1", -23.55, -46.63, -23.54, -46.64)

    expect(result.success).toBe(true)
    expect(result.rideId).toBe("ride-abc")
    expect(result.estimatedValue).toBe(15.5)
    expect(result.estimatedTime).toBe(25)
  })

  it("retorna erro quando API retorna 400", async () => {
    vi.mocked(https.request).mockImplementation(function (this: any, opts: any, cb: any) {
      const req = new EventEmitter()
      ;(req as any).write = vi.fn()
      ;(req as any).end = vi.fn(function (this: any) {
        process.nextTick(() => {
          const res = new EventEmitter()
          ;(res as any).statusCode = 400
          if (cb) cb(res)
          res.emit("data", JSON.stringify({ error: "invalid" }))
          res.emit("end")
        })
        return this
      })
      return req
    } as any)

    const { buscarEstimativa99 } = await loadNineNine()
    const result = await buscarEstimativa99("key", "emp-1", 0, 0, 0, 0)

    expect(result.success).toBe(false)
    expect(result.error).toContain("400")
  })

  it("retorna erro quando JSON da resposta é inválido", async () => {
    vi.mocked(https.request).mockImplementation(function (this: any, opts: any, cb: any) {
      const req = new EventEmitter()
      ;(req as any).write = vi.fn()
      ;(req as any).end = vi.fn(function (this: any) {
        process.nextTick(() => {
          const res = new EventEmitter()
          ;(res as any).statusCode = 200
          if (cb) cb(res)
          res.emit("data", "bad json {{{")
          res.emit("end")
        })
        return this
      })
      return req
    } as any)

    const { buscarEstimativa99 } = await loadNineNine()
    const result = await buscarEstimativa99("key", "emp-1", 0, 0, 0, 0)

    expect(result.success).toBe(false)
    expect(result.error).toContain("estimativa")
  })

  it("envia body correto com origin e destination", async () => {
    const mockWrite = vi.fn()
    vi.mocked(https.request).mockImplementation(function (this: any, opts: any, cb: any) {
      const req = new EventEmitter()
      ;(req as any).write = mockWrite
      ;(req as any).end = vi.fn(function (this: any) {
        process.nextTick(() => {
          const res = new EventEmitter()
          ;(res as any).statusCode = 200
          if (cb) cb(res)
          res.emit("data", JSON.stringify({ rideId: "r1", estimatedValue: 10, estimatedTime: 20 }))
          res.emit("end")
        })
        return this
      })
      return req
    } as any)

    const { buscarEstimativa99 } = await loadNineNine()
    await buscarEstimativa99("key", "emp-1", -23.55, -46.63, -23.54, -46.64)

    expect(mockWrite).toHaveBeenCalledWith(
      JSON.stringify({
        origin: { latitude: -23.55, longitude: -46.63 },
        destination: { latitude: -23.54, longitude: -46.64 },
      })
    )
  })
})

describe("despacharCorrida99", () => {
  it("retorna rideId com sucesso", async () => {
    vi.mocked(https.request).mockImplementation(function (this: any, opts: any, cb: any) {
      const req = new EventEmitter()
      ;(req as any).write = vi.fn()
      ;(req as any).end = vi.fn(function (this: any) {
        process.nextTick(() => {
          const res = new EventEmitter()
          ;(res as any).statusCode = 200
          if (cb) cb(res)
          res.emit("data", JSON.stringify({ rideId: "ride-xyz", estimatedValue: 20, estimatedTime: 30 }))
          res.emit("end")
        })
        return this
      })
      return req
    } as any)

    const { despacharCorrida99 } = await loadNineNine()
    const result = await despacharCorrida99("key", "emp-1", -23.55, -46.63, -23.54, -46.64, "order-123", "5678")

    expect(result.success).toBe(true)
    expect(result.rideId).toBe("ride-xyz")
  })

  it("retorna erro quando API retorna 500", async () => {
    vi.mocked(https.request).mockImplementation(function (this: any, opts: any, cb: any) {
      const req = new EventEmitter()
      ;(req as any).write = vi.fn()
      ;(req as any).end = vi.fn(function (this: any) {
        process.nextTick(() => {
          const res = new EventEmitter()
          ;(res as any).statusCode = 500
          if (cb) cb(res)
          res.emit("data", "Internal Server Error")
          res.emit("end")
        })
        return this
      })
      return req
    } as any)

    const { despacharCorrida99 } = await loadNineNine()
    const result = await despacharCorrida99("key", "emp-1", 0, 0, 0, 0, "order-1", "1234")

    expect(result.success).toBe(false)
    expect(result.error).toContain("500")
  })

  it("envia body com externalId e pinCode", async () => {
    const mockWrite = vi.fn()
    vi.mocked(https.request).mockImplementation(function (this: any, opts: any, cb: any) {
      const req = new EventEmitter()
      ;(req as any).write = mockWrite
      ;(req as any).end = vi.fn(function (this: any) {
        process.nextTick(() => {
          const res = new EventEmitter()
          ;(res as any).statusCode = 200
          if (cb) cb(res)
          res.emit("data", JSON.stringify({ rideId: "r1" }))
          res.emit("end")
        })
        return this
      })
      return req
    } as any)

    const { despacharCorrida99 } = await loadNineNine()
    await despacharCorrida99("key", "emp-1", -23.55, -46.63, -23.54, -46.64, "order-abc", "9999")

    expect(mockWrite).toHaveBeenCalledWith(
      JSON.stringify({
        origin: { latitude: -23.55, longitude: -46.63 },
        destination: { latitude: -23.54, longitude: -46.64 },
        externalId: "order-abc",
        pinCode: "9999",
      })
    )
  })

  it("retorna erro de conexão", async () => {
    vi.mocked(https.request).mockImplementation(function (this: any) {
      const req = new EventEmitter()
      ;(req as any).write = vi.fn()
      ;(req as any).end = vi.fn(function (this: any) {
        process.nextTick(() => {
          req.emit("error", new Error("ETIMEDOUT"))
        })
        return this
      })
      return req
    } as any)

    const { despacharCorrida99 } = await loadNineNine()
    const result = await despacharCorrida99("key", "emp-1", 0, 0, 0, 0, "order-1", "1234")

    expect(result.success).toBe(false)
    expect(result.error).toContain("conexão")
  })

  it("retorna rideId de resposta com campo 'id' em vez de 'rideId'", async () => {
    vi.mocked(https.request).mockImplementation(function (this: any, opts: any, cb: any) {
      const req = new EventEmitter()
      ;(req as any).write = vi.fn()
      ;(req as any).end = vi.fn(function (this: any) {
        process.nextTick(() => {
          const res = new EventEmitter()
          ;(res as any).statusCode = 200
          if (cb) cb(res)
          res.emit("data", JSON.stringify({ id: "ride-alt", price: 12 }))
          res.emit("end")
        })
        return this
      })
      return req
    } as any)

    const { despacharCorrida99 } = await loadNineNine()
    const result = await despacharCorrida99("key", "emp-1", 0, 0, 0, 0, "o1", "1111")

    expect(result.rideId).toBe("ride-alt")
  })
})

describe("buscarStatusCorrida99", () => {
  it("retorna status e tracking link", async () => {
    vi.mocked(https.request).mockImplementation(function (this: any, opts: any, cb: any) {
      const req = new EventEmitter()
      ;(req as any).write = vi.fn()
      ;(req as any).end = vi.fn(function (this: any) {
        process.nextTick(() => {
          const res = new EventEmitter()
          ;(res as any).statusCode = 200
          if (cb) cb(res)
          res.emit("data", JSON.stringify({ status: "in_transit", trackingUrl: "https://track.99app.com/r1" }))
          res.emit("end")
        })
        return this
      })
      return req
    } as any)

    const { buscarStatusCorrida99 } = await loadNineNine()
    const result = await buscarStatusCorrida99("key", "emp-1", "ride-123")

    expect(result).toEqual({ success: true, status: "in_transit", link: "https://track.99app.com/r1" })
  })

  it("retorna erro quando corrida não encontrada (404)", async () => {
    vi.mocked(https.request).mockImplementation(function (this: any, opts: any, cb: any) {
      const req = new EventEmitter()
      ;(req as any).write = vi.fn()
      ;(req as any).end = vi.fn(function (this: any) {
        process.nextTick(() => {
          const res = new EventEmitter()
          ;(res as any).statusCode = 404
          if (cb) cb(res)
          res.emit("data", "Not Found")
          res.emit("end")
        })
        return this
      })
      return req
    } as any)

    const { buscarStatusCorrida99 } = await loadNineNine()
    const result = await buscarStatusCorrida99("key", "emp-1", "ride-xxx")

    expect(result.success).toBe(false)
    expect(result.error).toContain("404")
  })

  it("retorna erro de conexão", async () => {
    vi.mocked(https.request).mockImplementation(function (this: any) {
      const req = new EventEmitter()
      ;(req as any).write = vi.fn()
      ;(req as any).end = vi.fn(function (this: any) {
        process.nextTick(() => {
          req.emit("error", new Error("ECONNRESET"))
        })
        return this
      })
      return req
    } as any)

    const { buscarStatusCorrida99 } = await loadNineNine()
    const result = await buscarStatusCorrida99("key", "emp-1", "ride-123")

    expect(result.success).toBe(false)
    expect(result.error).toContain("conexão")
  })

  it("retorna erro quando JSON é inválido", async () => {
    vi.mocked(https.request).mockImplementation(function (this: any, opts: any, cb: any) {
      const req = new EventEmitter()
      ;(req as any).write = vi.fn()
      ;(req as any).end = vi.fn(function (this: any) {
        process.nextTick(() => {
          const res = new EventEmitter()
          ;(res as any).statusCode = 200
          if (cb) cb(res)
          res.emit("data", "not json")
          res.emit("end")
        })
        return this
      })
      return req
    } as any)

    const { buscarStatusCorrida99 } = await loadNineNine()
    const result = await buscarStatusCorrida99("key", "emp-1", "ride-123")

    expect(result.success).toBe(false)
    expect(result.error).toContain("status")
  })
})
