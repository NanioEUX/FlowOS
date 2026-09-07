import { describe, it, expect, vi, beforeEach } from "vitest"

const mockPrisma = vi.hoisted(() => ({
  order: { findFirst: vi.fn(), update: vi.fn() },
  logWebhook99: { create: vi.fn(), updateMany: vi.fn() },
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import { POST } from "../route"

function makeRequest(body: any) {
  return new Request("http://localhost/api/webhooks/99", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/webhooks/99", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retorna received: true quando body inválido", async () => {
    const req = new Request("http://localhost/api/webhooks/99", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    })
    const res = await POST(req as any)
    const data = await res.json()
    expect(data.received).toBe(true)
  })

  it("retorna received: true quando não tem rideId nem externalId", async () => {
    mockPrisma.logWebhook99.create.mockResolvedValue({})
    const res = await POST(makeRequest({ status: "pending" }) as any)
    const data = await res.json()
    expect(data.received).toBe(true)
  })

  it("salva log em LogWebhook99", async () => {
    mockPrisma.logWebhook99.create.mockResolvedValue({})
    mockPrisma.order.findFirst.mockResolvedValue(null)

    await POST(makeRequest({ rideId: "ride-1", status: "pending" }) as any)

    expect(mockPrisma.logWebhook99.create).toHaveBeenCalledWith({
      data: {
        rideId: "ride-1",
        pedidoId: null,
        payload: { rideId: "ride-1", status: "pending" },
        statusProcessamento: "pendente",
      },
    })
  })

  it("mapeia status accepted → confirmed", async () => {
    mockPrisma.logWebhook99.create.mockResolvedValue({})
    mockPrisma.order.findFirst.mockResolvedValue({ id: "order-1", status: "out_for_delivery" })
    mockPrisma.order.update.mockResolvedValue({})
    mockPrisma.logWebhook99.updateMany.mockResolvedValue({})

    const res = await POST(makeRequest({ rideId: "ride-1", status: "accepted" }) as any)
    const data = await res.json()

    expect(data.received).toBe(true)
    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { entregaStatusProvedor: "accepted", status: "confirmed" },
    })
  })

  it("mapeia status driver_arriving → ready", async () => {
    mockPrisma.logWebhook99.create.mockResolvedValue({})
    mockPrisma.order.findFirst.mockResolvedValue({ id: "order-1", status: "out_for_delivery" })
    mockPrisma.order.update.mockResolvedValue({})
    mockPrisma.logWebhook99.updateMany.mockResolvedValue({})

    await POST(makeRequest({ rideId: "ride-1", status: "driver_arriving" }) as any)

    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({ status: "ready" }),
    })
  })

  it("mapeia status in_transit → out_for_delivery", async () => {
    mockPrisma.logWebhook99.create.mockResolvedValue({})
    mockPrisma.order.findFirst.mockResolvedValue({ id: "order-1", status: "ready" })
    mockPrisma.order.update.mockResolvedValue({})
    mockPrisma.logWebhook99.updateMany.mockResolvedValue({})

    await POST(makeRequest({ rideId: "ride-1", status: "in_transit" }) as any)

    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({ status: "out_for_delivery" }),
    })
  })

  it("mapeia status delivered e set deliveredAt", async () => {
    mockPrisma.logWebhook99.create.mockResolvedValue({})
    mockPrisma.order.findFirst.mockResolvedValue({ id: "order-1", status: "out_for_delivery" })
    mockPrisma.order.update.mockResolvedValue({})
    mockPrisma.logWebhook99.updateMany.mockResolvedValue({})

    await POST(makeRequest({ rideId: "ride-1", status: "delivered" }) as any)

    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({ status: "delivered", deliveredAt: expect.any(Date) }),
    })
  })

  it("mapeia status cancelled e set cancellationReason", async () => {
    mockPrisma.logWebhook99.create.mockResolvedValue({})
    mockPrisma.order.findFirst.mockResolvedValue({ id: "order-1", status: "out_for_delivery" })
    mockPrisma.order.update.mockResolvedValue({})
    mockPrisma.logWebhook99.updateMany.mockResolvedValue({})

    await POST(makeRequest({ rideId: "ride-1", status: "cancelled" }) as any)

    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({ status: "cancelled", cancellationReason: "Cancelado pela 99" }),
    })
  })

  it("suporta canceled (com 'z') além de cancelled", async () => {
    mockPrisma.logWebhook99.create.mockResolvedValue({})
    mockPrisma.order.findFirst.mockResolvedValue({ id: "order-1", status: "out_for_delivery" })
    mockPrisma.order.update.mockResolvedValue({})
    mockPrisma.logWebhook99.updateMany.mockResolvedValue({})

    await POST(makeRequest({ rideId: "ride-1", status: "canceled" }) as any)

    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({ status: "cancelled" }),
    })
  })

  it("busca pedido por externalId quando não encontra por rideId", async () => {
    mockPrisma.logWebhook99.create.mockResolvedValue({})
    mockPrisma.order.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "order-2", status: "out_for_delivery" })
    mockPrisma.order.update.mockResolvedValue({})
    mockPrisma.logWebhook99.updateMany.mockResolvedValue({})

    await POST(makeRequest({ rideId: "ride-unknown", externalId: "order-2", status: "delivered" }) as any)

    expect(mockPrisma.order.findFirst).toHaveBeenCalledTimes(2)
    expect(mockPrisma.order.update).toHaveBeenCalled()
  })

  it("retorna received: true quando pedido não encontrado", async () => {
    mockPrisma.logWebhook99.create.mockResolvedValue({})
    mockPrisma.order.findFirst.mockResolvedValue(null)

    const res = await POST(makeRequest({ rideId: "ride-1", status: "delivered" }) as any)
    const data = await res.json()

    expect(data.received).toBe(true)
    expect(data.error).toContain("não encontrado")
  })

  it("marca log como erro quando update falha", async () => {
    mockPrisma.logWebhook99.create.mockResolvedValue({})
    mockPrisma.order.findFirst.mockResolvedValue({ id: "order-1", status: "out_for_delivery" })
    mockPrisma.order.update.mockRejectedValue(new Error("DB error"))
    mockPrisma.logWebhook99.updateMany.mockResolvedValue({})

    await POST(makeRequest({ rideId: "ride-1", status: "delivered" }) as any)

    expect(mockPrisma.logWebhook99.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { statusProcessamento: "erro" } })
    )
  })

  it("usa snake_case (ride_id, external_id, ride_status)", async () => {
    mockPrisma.logWebhook99.create.mockResolvedValue({})
    mockPrisma.order.findFirst.mockResolvedValue({ id: "order-1", status: "out_for_delivery" })
    mockPrisma.order.update.mockResolvedValue({})
    mockPrisma.logWebhook99.updateMany.mockResolvedValue({})

    await POST(makeRequest({ ride_id: "ride-snake", external_id: "order-1", ride_status: "delivered" }) as any)

    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({ entregaStatusProvedor: "delivered", status: "delivered" }),
    })
  })
})
