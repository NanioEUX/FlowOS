import { describe, it, expect, vi, beforeEach } from "vitest"

const mockPrisma = vi.hoisted(() => ({
  establishment: { findUnique: vi.fn() },
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))
vi.mock("@/lib/integrations/nine-nine", () => ({
  buscarEstimativa99: vi.fn(),
}))

import { buscarEstimativa99 } from "@/lib/integrations/nine-nine"
import { GET } from "../route"

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/delivery/calculate")
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url.toString(), { method: "GET" })
}

describe("GET /api/delivery/calculate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retorna 400 quando parâmetros inválidos", async () => {
    const res = await GET(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it("retorna 400 quando lat/lng não são números", async () => {
    const res = await GET(makeRequest({ est: "est-1", lat: "abc", lng: "xyz" }))
    expect(res.status).toBe(400)
  })

  it("retorna unavailable quando estabelecimento não existe", async () => {
    mockPrisma.establishment.findUnique.mockResolvedValue(null)
    const res = await GET(makeRequest({ est: "nonexistent", lat: "-23.55", lng: "-46.63" }))
    const data = await res.json()
    expect(data.available).toBe(false)
    expect(data.reason).toContain("localização")
  })

  it("modo 99: retorna fee e estimatedMin da API 99", async () => {
    mockPrisma.establishment.findUnique.mockResolvedValue({
      id: "est-1", addressLat: -23.5, addressLng: -46.6, deliveryRadiusKm: 8,
      tipoEntregaAtiva: "99entrega", api99Key: "key", api99EmployeeId: "emp-1", deliveryZones: [],
    })
    vi.mocked(buscarEstimativa99).mockResolvedValue({ success: true, estimatedValue: 18.5, estimatedTime: 35 })

    const res = await GET(makeRequest({ est: "est-1", lat: "-23.55", lng: "-46.63" }))
    const data = await res.json()

    expect(data.available).toBe(true)
    expect(data.fee).toBe(18.5)
    expect(data.estimatedMin).toBe(35)
    expect(data.provedor).toBe("99entrega")
    expect(data.zoneName).toBe("99Entrega")
  })

  it("modo 99: retorna unavailable quando API 99 falha", async () => {
    mockPrisma.establishment.findUnique.mockResolvedValue({
      id: "est-1", addressLat: -23.5, addressLng: -46.6, deliveryRadiusKm: 8,
      tipoEntregaAtiva: "99entrega", api99Key: "key", api99EmployeeId: "emp-1", deliveryZones: [],
    })
    vi.mocked(buscarEstimativa99).mockResolvedValue({ success: false, error: "No drivers available" })

    const res = await GET(makeRequest({ est: "est-1", lat: "-23.55", lng: "-46.63" }))
    const data = await res.json()

    expect(data.available).toBe(false)
    expect(data.reason).toContain("No drivers available")
  })

  it("modo entrega própria: calcula distância Haversine", async () => {
    mockPrisma.establishment.findUnique.mockResolvedValue({
      id: "est-1", addressLat: -23.55, addressLng: -46.63, deliveryRadiusKm: 8,
      tipoEntregaAtiva: "propria", api99Key: null, api99EmployeeId: null,
      deliveryZones: [
        { name: "Perto", minKm: 0, maxKm: 3, fee: 5, estimatedMin: 20, freeAbove: null, enabled: true, order: 1 },
      ],
    })

    const res = await GET(makeRequest({ est: "est-1", lat: "-23.56", lng: "-46.64" }))
    const data = await res.json()

    expect(data.available).toBe(true)
    expect(data.distanceKm).toBeDefined()
    expect(data.fee).toBeDefined()
  })

  it("modo entrega própria: retorna unavailable quando fora do raio", async () => {
    mockPrisma.establishment.findUnique.mockResolvedValue({
      id: "est-1", addressLat: 0, addressLng: 0, deliveryRadiusKm: 1,
      tipoEntregaAtiva: "propria", api99Key: null, api99EmployeeId: null, deliveryZones: [],
    })

    const res = await GET(makeRequest({ est: "est-1", lat: "51.5", lng: "-0.1" }))
    const data = await res.json()

    expect(data.available).toBe(false)
    expect(data.reason).toContain("raio")
  })

  it("modo entrega própria: retorna fee 0 quando não há zona", async () => {
    mockPrisma.establishment.findUnique.mockResolvedValue({
      id: "est-1", addressLat: -23.55, addressLng: -46.63, deliveryRadiusKm: 8,
      tipoEntregaAtiva: "propria", api99Key: null, api99EmployeeId: null, deliveryZones: [],
    })

    const res = await GET(makeRequest({ est: "est-1", lat: "-23.56", lng: "-46.64" }))
    const data = await res.json()

    expect(data.available).toBe(true)
    expect(data.fee).toBe(0)
  })
})
