import { SignJWT, jwtVerify } from "jose"
import { NextResponse } from "next/server"

// Lê o segredo de forma lazy: o módulo pode ser importado em testes/build sem
// JWT_SECRET presente; o erro (explícito) só aparece na emissão/validação.
function getSecret(): Uint8Array {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    throw new Error("JWT_SECRET não configurado. Defina no .env ou nas Environment Variables da Vercel.")
  }
  return new TextEncoder().encode(jwtSecret)
}

export const CUSTOMER_SESSION_COOKIE = "flowos_customer"
export const CUSTOMER_SESSION_TTL_DAYS = 30

export interface CustomerSession {
  customerId: string
  establishmentId: string
  phone: string
}

function parseCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=")
    if (idx === -1) continue
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim())
    }
  }
  return null
}

/** Emite a sessão do cliente final (cookie httpOnly, 30 dias) — F7A-015. */
export async function signCustomerSession(session: CustomerSession): Promise<string> {
  return new SignJWT({
    type: "customer",
    customerId: session.customerId,
    establishmentId: session.establishmentId,
    phone: session.phone,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${CUSTOMER_SESSION_TTL_DAYS}d`)
    .sign(getSecret())
}

/** Lê e valida a sessão do cliente a partir do cookie da requisição. */
export async function verifyCustomerSession(request: Request): Promise<CustomerSession | null> {
  const token = parseCookie(request.headers.get("cookie"), CUSTOMER_SESSION_COOKIE)
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (
      payload.type !== "customer" ||
      typeof payload.customerId !== "string" ||
      typeof payload.establishmentId !== "string" ||
      typeof payload.phone !== "string"
    ) {
      return null
    }
    return {
      customerId: payload.customerId,
      establishmentId: payload.establishmentId,
      phone: payload.phone,
    }
  } catch {
    return null
  }
}

export function customerSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: CUSTOMER_SESSION_TTL_DAYS * 24 * 60 * 60,
  }
}

export function clearCustomerSessionCookieOptions() {
  return { ...customerSessionCookieOptions(), maxAge: 0 }
}

/** Resposta padrão para rotas de cliente sem sessão válida. */
export function customerSessionRequired() {
  return NextResponse.json(
    { error: "Sessão expirada. Entre novamente.", code: "session_expired" },
    { status: 401 }
  )
}
