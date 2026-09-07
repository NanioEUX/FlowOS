import { describe, it, expect, vi, beforeEach } from "vitest"

const mockPrisma = vi.hoisted(() => ({
  order: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))
vi.mock("@/lib/integrations/nine-nine", () => ({
  despacharCorrida99: vi.fn(),
}))

import { despacharCorrida99 } from "@/lib/integrations/nine-nine"
import { POST } from "../route"

function makeRequest(body: any) {
  return new Request("http://localhost/api/delivery/dispatch-99", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/delivery/dispatch-99", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retorna 400 quando orderId não fornecido", async () => {
    const res = await POST(makeRequest({}))
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toContain("orderId")
  })

  it("retorna 404 quando pedido não encontrado", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null)
    const res = await POST(makeRequest({ orderId: "nonexistent" }))
    const data = await res.json()
    expect(res.status).toBe(404)
    expect(data.error).toContain("não encontrado")
  })

  it("retorna 400 quando tipoEntregaAtiva não é 99entrega", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "order-1", orderType: "delivery", customerLat: -23.55, customerLng: -46.63, entrega99RideId: null,
      establishment: { tipoEntregaAtiva: "propria", api99Key: "key", api99EmployeeId: "emp-1", addressLat: -23.5, addressLng: -46.6 },
    })
    const res = await POST(makeRequest({ orderId: "order-1" }))
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toContain("99Entrega")
  })

  it("retorna 400 quando credenciais 99 não configuradas", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "order-1", orderType: "delivery", customerLat: -23.55, customerLng: -46.63, entrega99RideId: null,
      establishment: { tipoEntregaAtiva: "99entrega", api99Key: null, api99EmployeeId: null, addressLat: -23.5, addressLng: -46.6 },
    })
    const res = await POST(makeRequest({ orderId: "order-1" }))
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toContain("Credenciais")
  })

  it("retorna 400 quando endereço do estabelecimento não configurado", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "order-1", orderType: "delivery", customerLat: -23.55, customerLng: -46.63, entrega99RideId: null,
      establishment: { tipoEntregaAtiva: "99entrega", api99Key: "key", api99EmployeeId: "emp-1", addressLat: null, addressLng: null },
    })
    const res = await POST(makeRequest({ orderId: "order-1" }))
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toContain("estabelecimento")
  })

  it("retorna 400 quando endereço do cliente não encontrado", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "order-1", orderType: "delivery", customerLat: null, customerLng: null, entrega99RideId: null,
      establishment: { tipoEntregaAtiva: "99entrega", api99Key: "key", api99EmployeeId: "emp-1", addressLat: -23.5, addressLng: -46.6 },
    })
    const res = await POST(makeRequest({ orderId: "order-1" }))
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toContain("cliente")
  })

  it("despacha corrida e salva rideId + pinCode no pedido", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "order-1", orderType: "delivery", customerLat: -23.55, customerLng: -46.63, entrega99RideId: null,
      establishment: { tipoEntregaAtiva: "99entrega", api99Key: "key", api99EmployeeId: "emp-1", addressLat: -23.5, addressLng: -46.6 },
    })
    vi.mocked(despacharCorrida99).mockResolvedValue({ success: true, rideId: "ride-abc", estimatedValue: 15, estimatedTime: 25 })
    mockPrisma.order.update.mockResolvedValue({})

    const res = await POST(makeRequest({ orderId: "order-1" }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.rideId).toBe("ride-abc")
    expect(data.pinCode).toMatch(/^\d{4}$/)
    expect(despacharCorrida99).toHaveBeenCalledWith(
      "key", "emp-1", -23.5, -46.6, -23.55, -46.63, "order-1", expect.stringMatching(/^\d{4}$/)
    )
    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { entrega99RideId: "ride-abc", entregaPinCode: expect.stringMatching(/^\d{4}$/), entregaStatusProvedor: "pending" },
    })
  })

  it("retorna 500 quando API 99 retorna erro", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "order-1", orderType: "delivery", customerLat: -23.55, customerLng: -46.63, entrega99RideId: null,
      establishment: { tipoEntregaAtiva: "99entrega", api99Key: "key", api99EmployeeId: "emp-1", addressLat: -23.5, addressLng: -46.6 },
    })
    vi.mocked(despacharCorrida99).mockResolvedValue({ success: false, error: "API 99 returned 500" })

    const res = await POST(makeRequest({ orderId: "order-1" }))
    const data = await res.json()
    expect(res.status).toBe(500)
    expect(data.error).toBeTruthy()
  })
})
