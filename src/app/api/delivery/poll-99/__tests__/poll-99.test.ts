import { describe, it, expect, vi, beforeEach } from "vitest"

const mockPrisma = vi.hoisted(() => ({
  order: { findMany: vi.fn(), update: vi.fn() },
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))
vi.mock("@/lib/integrations/nine-nine", () => ({
  buscarStatusCorrida99: vi.fn(),
}))
vi.mock("@/lib/require-auth", () => ({
  requireEstablishment: vi.fn(),
}))

import { buscarStatusCorrida99 } from "@/lib/integrations/nine-nine"
import { requireEstablishment } from "@/lib/require-auth"
import { NextResponse } from "next/server"
import { GET } from "../route"

function makeRequest() {
  return new Request("http://localhost/api/delivery/poll-99") as any
}

describe("GET /api/delivery/poll-99", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireEstablishment).mockReturnValue({
      user: { userId: "user-1", email: "test@test.com", role: "admin", permissions: [], establishmentId: "est-1" },
      error: null,
    })
  })

  it("retorna 401 quando não autenticado", async () => {
    vi.mocked(requireEstablishment).mockReturnValue({
      user: null,
      error: NextResponse.json({ error: "Não autorizado" }, { status: 401 }),
    })
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it("retorna polled: 0 quando não há corridas ativas", async () => {
    mockPrisma.order.findMany.mockResolvedValue([])
    const res = await GET(makeRequest())
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.polled).toBe(0)
    expect(data.results).toEqual([])
  })

  it("pula pedidos sem credenciais 99", async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: "order-1", entrega99RideId: "ride-1", status: "out_for_delivery",
        establishment: { api99Key: null, api99EmployeeId: null } },
    ])
    const res = await GET(makeRequest())
    const data = await res.json()
    expect(data.polled).toBe(0)
    expect(buscarStatusCorrida99).not.toHaveBeenCalled()
  })

  it("filtra por establishmentId do JWT", async () => {
    mockPrisma.order.findMany.mockResolvedValue([])
    await GET(makeRequest())
    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ establishmentId: "est-1" }),
      })
    )
  })

  it("busca status e atualiza pedido", async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: "order-1", entrega99RideId: "ride-1", status: "out_for_delivery",
        establishment: { api99Key: "key", api99EmployeeId: "emp-1" } },
    ])
    vi.mocked(buscarStatusCorrida99).mockResolvedValue({ success: true, status: "in_transit", link: "https://track.99.com/r1" })
    mockPrisma.order.update.mockResolvedValue({})

    const res = await GET(makeRequest())
    const data = await res.json()

    expect(data.polled).toBe(1)
    expect(data.results[0]).toEqual({ orderId: "order-1", rideId: "ride-1", status: "in_transit", mappedStatus: "out_for_delivery" })
    expect(buscarStatusCorrida99).toHaveBeenCalledWith("key", "emp-1", "ride-1")
    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({ entregaStatusProvedor: "in_transit", status: "out_for_delivery" }),
    })
  })

  it("processa múltiplos pedidos em lote", async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: "order-1", entrega99RideId: "ride-1", status: "out_for_delivery",
        establishment: { api99Key: "key", api99EmployeeId: "emp-1" } },
      { id: "order-2", entrega99RideId: "ride-2", status: "ready",
        establishment: { api99Key: "key", api99EmployeeId: "emp-1" } },
    ])
    vi.mocked(buscarStatusCorrida99)
      .mockResolvedValueOnce({ success: true, status: "delivered" })
      .mockResolvedValueOnce({ success: true, status: "driver_arriving" })
    mockPrisma.order.update.mockResolvedValue({})

    const res = await GET(makeRequest())
    const data = await res.json()

    expect(data.polled).toBe(2)
    expect(buscarStatusCorrida99).toHaveBeenCalledTimes(2)
  })

  it("atualiza deliveredAt quando status é delivered", async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: "order-1", entrega99RideId: "ride-1", status: "out_for_delivery",
        establishment: { api99Key: "key", api99EmployeeId: "emp-1" } },
    ])
    vi.mocked(buscarStatusCorrida99).mockResolvedValue({ success: true, status: "delivered" })
    mockPrisma.order.update.mockResolvedValue({})

    await GET(makeRequest())

    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({ status: "delivered", deliveredAt: expect.any(Date) }),
    })
  })

  it("não atualiza quando buscarStatusCorrida99 falha", async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: "order-1", entrega99RideId: "ride-1", status: "out_for_delivery",
        establishment: { api99Key: "key", api99EmployeeId: "emp-1" } },
    ])
    vi.mocked(buscarStatusCorrida99).mockResolvedValue({ success: false, error: "API error" })

    const res = await GET(makeRequest())
    const data = await res.json()

    expect(data.polled).toBe(0)
    expect(mockPrisma.order.update).not.toHaveBeenCalled()
  })
})
