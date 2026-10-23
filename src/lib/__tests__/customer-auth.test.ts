import { describe, it, expect } from "vitest"
import { SignJWT } from "jose"

// O módulo lê JWT_SECRET de forma lazy; garante o segredo nos testes
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret"

import {
  signCustomerSession,
  verifyCustomerSession,
  CUSTOMER_SESSION_COOKIE,
  type CustomerSession,
} from "@/lib/customer-auth"

const secret = new TextEncoder().encode(process.env.JWT_SECRET)

const SESSION: CustomerSession = {
  customerId: "cus_123",
  establishmentId: "est_456",
  phone: "47999998888",
}

function requestWithCookie(cookie: string | null): Request {
  return new Request("http://localhost/api/test", {
    headers: cookie ? { cookie } : {},
  })
}

describe("customer-auth (sessão de cliente — F7A-015)", () => {
  it("emite e valida o cookie da sessão", async () => {
    const token = await signCustomerSession(SESSION)
    const session = await verifyCustomerSession(requestWithCookie(`${CUSTOMER_SESSION_COOKIE}=${token}`))
    expect(session).toEqual(SESSION)
  })

  it("rejeita requisição sem cookie", async () => {
    expect(await verifyCustomerSession(requestWithCookie(null))).toBeNull()
  })

  it("rejeita token adulterado", async () => {
    const token = await signCustomerSession(SESSION)
    const tampered = token.slice(0, -4) + "AAAA"
    expect(await verifyCustomerSession(requestWithCookie(`${CUSTOMER_SESSION_COOKIE}=${tampered}`))).toBeNull()
  })

  it("rejeita JWT de outro tipo (ex.: access token de staff)", async () => {
    const token = await new SignJWT({ type: "access", userId: "u1", establishmentId: SESSION.establishmentId })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(secret)
    expect(await verifyCustomerSession(requestWithCookie(`${CUSTOMER_SESSION_COOKIE}=${token}`))).toBeNull()
  })

  it("rejeita token expirado", async () => {
    const token = await new SignJWT({
      type: "customer",
      customerId: SESSION.customerId,
      establishmentId: SESSION.establishmentId,
      phone: SESSION.phone,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(secret)
    expect(await verifyCustomerSession(requestWithCookie(`${CUSTOMER_SESSION_COOKIE}=${token}`))).toBeNull()
  })
})
