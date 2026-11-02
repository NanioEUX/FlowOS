import { describe, it, expect, vi, beforeEach } from "vitest"

const mockPrisma = vi.hoisted(() => ({
  establishment: { findUnique: vi.fn(), update: vi.fn() },
}))

const mockJwtVerify = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))
// F1B-002/F5B-004: a rota agora usa `requireEstablishment` (mesmo validador do
// resto do app). O teste injeta o JWT pelo header Authorization.
vi.mock("jsonwebtoken", () => ({ default: { verify: (...args: any[]) => mockJwtVerify(...args) } }))
vi.mock("@/lib/integrations/nine-nine", () => ({
  validarCredenciais99: vi.fn(),
}))

import { validarCredenciais99 } from "@/lib/integrations/nine-nine"
import { GET, PUT } from "../route"

const AUTH_HEADERS = { Authorization: "Bearer test-token" }

function makeGetRequest() {
  return new Request("http://localhost/api/establishments/est-1/delivery-config", {
    method: "GET",
    headers: AUTH_HEADERS,
  })
}

function makePutRequest(body: any) {
  return new Request("http://localhost/api/establishments/est-1/delivery-config", {
    method: "PUT",
    headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const params = { params: { id: "est-1" } }

describe("GET /api/establishments/[id]/delivery-config", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockJwtVerify.mockReturnValue({ userId: "user-1", establishmentId: "est-1", role: "admin" })
  })

  it("retorna 401 sem autenticação", async () => {
    mockJwtVerify.mockImplementation(() => { throw new Error("invalid token") })
    const res = await GET(makeGetRequest(), params)
    expect(res.status).toBe(401)
  })

  it("retorna 403 quando o token é de outra loja (F1B-002)", async () => {
    mockJwtVerify.mockReturnValue({ userId: "user-2", establishmentId: "outra-loja", role: "admin" })
    const res = await GET(makeGetRequest(), params)
    expect(res.status).toBe(403)
    expect(mockPrisma.establishment.findUnique).not.toHaveBeenCalled()
  })

  it("retorna 404 quando estabelecimento não existe", async () => {
    mockPrisma.establishment.findUnique.mockResolvedValue(null)
    const res = await GET(makeGetRequest(), params)
    expect(res.status).toBe(404)
  })

  it("retorna config do estabelecimento", async () => {
    mockPrisma.establishment.findUnique.mockResolvedValue({
      tipoEntregaAtiva: "99entrega", api99Key: "key", api99EmployeeId: "emp-1",
      addressLat: -23.5, addressLng: -46.6, deliveryRadiusKm: 8,
    })

    const res = await GET(makeGetRequest(), params)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.tipoEntregaAtiva).toBe("99entrega")
    // F1C-002: a chave da 99 é credencial — só devolvemos o estado
    expect(data.api99Configured).toBe(true)
    expect(data.api99Key).toBeUndefined()
    expect(data.api99EmployeeId).toBeUndefined()
  })
})

describe("PUT /api/establishments/[id]/delivery-config", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockJwtVerify.mockReturnValue({ userId: "user-1", establishmentId: "est-1", role: "admin" })
  })

  it("retorna 401 sem autenticação", async () => {
    mockJwtVerify.mockImplementation(() => { throw new Error("invalid token") })
    const res = await PUT(makePutRequest({ tipoEntregaAtiva: "99entrega", api99Key: "k", api99EmployeeId: "e" }), params)
    expect(res.status).toBe(401)
  })

  it("retorna 403 quando o token é de outra loja (F1B-002)", async () => {
    mockJwtVerify.mockReturnValue({ userId: "user-2", establishmentId: "outra-loja", role: "admin" })
    const res = await PUT(makePutRequest({ tipoEntregaAtiva: "99entrega", api99Key: "k", api99EmployeeId: "e" }), params)
    expect(res.status).toBe(403)
    expect(mockPrisma.establishment.update).not.toHaveBeenCalled()
  })

  it("retorna 400 quando ativa 99entrega sem credenciais", async () => {
    const res = await PUT(makePutRequest({ tipoEntregaAtiva: "99entrega" }), params)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toContain("Chave")
  })

  it("retorna 400 quando credenciais 99 são inválidas", async () => {
    vi.mocked(validarCredenciais99).mockResolvedValue({ success: false, error: "Invalid API key" })

    const res = await PUT(makePutRequest({ tipoEntregaAtiva: "99entrega", api99Key: "bad", api99EmployeeId: "emp-1" }), params)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toContain("inválidas")
  })

  it("salva config quando credenciais 99 são válidas", async () => {
    vi.mocked(validarCredenciais99).mockResolvedValue({ success: true })
    mockPrisma.establishment.update.mockResolvedValue({
      tipoEntregaAtiva: "99entrega", api99Key: "good-key", api99EmployeeId: "emp-123",
    })

    const res = await PUT(makePutRequest({ tipoEntregaAtiva: "99entrega", api99Key: "good-key", api99EmployeeId: "emp-123" }), params)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.tipoEntregaAtiva).toBe("99entrega")
    expect(mockPrisma.establishment.update).toHaveBeenCalledWith({
      where: { id: "est-1" },
      data: { tipoEntregaAtiva: "99entrega", api99Key: "good-key", api99EmployeeId: "emp-123" },
      select: expect.any(Object),
    })
  })

  it("limpa api99Key e api99EmployeeId ao mudar para modo próprio", async () => {
    mockPrisma.establishment.update.mockResolvedValue({
      tipoEntregaAtiva: "propria", api99Key: null, api99EmployeeId: null,
    })

    const res = await PUT(makePutRequest({ tipoEntregaAtiva: "propria" }), params)
    const data = await res.json()

    expect(data.tipoEntregaAtiva).toBe("propria")
    expect(mockPrisma.establishment.update).toHaveBeenCalledWith({
      where: { id: "est-1" },
      data: { tipoEntregaAtiva: "propria", api99Key: null, api99EmployeeId: null },
      select: expect.any(Object),
    })
  })

  it("não valida credenciais quando muda para modo próprio", async () => {
    mockPrisma.establishment.update.mockResolvedValue({
      tipoEntregaAtiva: "propria", api99Key: null, api99EmployeeId: null,
    })

    await PUT(makePutRequest({ tipoEntregaAtiva: "propria" }), params)

    expect(validarCredenciais99).not.toHaveBeenCalled()
  })
})
