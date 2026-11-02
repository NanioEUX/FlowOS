import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET!

export interface AuthUser {
  userId: string
  email: string
  role: string
  permissions: string[]
  establishmentId: string
}

export function verifyAuth(request: Request): AuthUser | null {
  const authHeader = request.headers.get("authorization")
  let token: string | null = null

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7)
  } else {
    // F1B-002/F5B-004: fallback para o cookie httpOnly `auth_token` (mesmo JWT,
    // mesmo secret). Antes, rotas que liam só o cookie (delivery-config,
    // delivery-zones, location) aceitavam qualquer tenant logado — sem conferir
    // o `establishmentId` do token contra o da rota.
    token = readCookieToken(request)
  }

  if (!token) return null

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any
    
    // Check if token type is not access token
    if (payload.type === "refresh") return null
    
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions || [],
      establishmentId: payload.establishmentId,
    }
  } catch (e) {
    const error = e as any
    // Log different error types
    if (error.name === "TokenExpiredError") {
      console.error("[verifyAuth] token expired")
    } else {
      console.error("[verifyAuth] failed:", error.message)
    }
    return null
  }
}

/**
 * Lê o cookie httpOnly `auth_token` de uma requisição (Node e Edge).
 */
function readCookieToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") || ""
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=")
    if (name === "auth_token") {
      const value = rest.join("=")
      try {
        return decodeURIComponent(value)
      } catch {
        return value
      }
    }
  }
  return null
}

export function jsonError(message: string, status: number = 401) {
  return Response.json({ error: message }, { status })
}
