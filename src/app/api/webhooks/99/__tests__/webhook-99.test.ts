import { describe, it, expect, vi, beforeEach } from "vitest"

const mockPrisma = vi.hoisted(() => ({
  order: { findFirst: vi.fn(), update: vi.fn() },
  logWebhook99: { create: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))
vi.mock("@/lib/stock", () => ({ restoreOrderStock: vi.fn() }))

import { POST } from "../route"
import { restoreOrderStock } from "@/lib/stock"

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
    // $transaction executa o callback com o próprio mock como tx
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma))
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

  it("mapeia status cancelled, estorna estoque e set cancellationReason (F5A-010)", async () => {
    mockPrisma.logWebhook99.create.mockResolvedValue({})
    mockPrisma.order.findFirst.mockResolvedValue({
      id: "order-1",
      status: "out_for_delivery",
      items: "[]",
      establishmentId: "est-1",
      paymentStatus: "pending",
    })
    mockPrisma.order.update.mockResolvedValue({})
    mockPrisma.logWebhook99.updateMany.mockResolvedValue({})

    await POST(makeRequest({ rideId: "ride-1", status: "cancelled" }) as any)

    expect(restoreOrderStock).toHaveBeenCalled()
    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({ status: "cancelled", cancellationReason: "Cancelado pela 99" }),
    })
  })

  it("suporta canceled (com 'z') além de cancelled", async () => {
    mockPrisma.logWebhook99.create.mockResolvedValue({})
    mockPrisma.order.findFirst.mockResolvedValue({
      id: "order-1",
      status: "out_for_delivery",
      items: "[]",
      establishmentId: "est-1",
      paymentStatus: "pending",
    })
    mockPrisma.order.update.mockResolvedValue({})
    mockPrisma.logWebhook99.updateMany.mockResolvedValue({})

    await POST(makeRequest({ rideId: "ride-1", status: "canceled" }) as any)

    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({ status: "cancelled" }),
    })
  })

  it("pedido já cancelado é terminal: não re-estorna nem regrava status", async () => {
    mockPrisma.logWebhook99.create.mockResolvedValue({})
    mockPrisma.order.findFirst.mockResolvedValue({
      id: "order-1",
      status: "cancelled",
      items: "[]",
      establishmentId: "est-1",
      paymentStatus: "cancelled",
    })

    await POST(makeRequest({ rideId: "ride-1", status: "delivered" }) as any)

    expect(restoreOrderStock).not.toHaveBeenCalled()
    expect(mockPrisma.order.update).not.toHaveBeenCalled()
  })

  it("status fora do mapa não grava string arbitrária (Fase 5)", async () => {
    mockPrisma.logWebhook99.create.mockResolvedValue({})
    mockPrisma.order.findFirst.mockResolvedValue({
      id: "order-1",
      status: "preparing",
      items: "[]",
      establishmentId: "est-1",
    })

    await POST(makeRequest({ rideId: "ride-1", status: "qualquer_coisa" }) as any)

    // Só o campo de provedor é atualizado — a coluna status fica intacta
    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { entregaStatusProvedor: "qualquer_coisa" },
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

    const res = await POST(makeRequest({ rideId: "ride-1", status: "delivered" }) as any)

    expect(mockPrisma.logWebhook99.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { statusProcessamento: "erro" } })
    )
    // F4A-009: a falha precisa devolver 500 para o provedor reenviar
    // (antes respondia 200 e o pedido ficava travado para sempre).
    expect(res.status).toBe(500)
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
