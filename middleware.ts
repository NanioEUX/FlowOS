import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

const JWT_SECRET = process.env.JWT_SECRET || "flowos-secret-key-change-in-production"
const secret = new TextEncoder().encode(JWT_SECRET)

const PUBLIC_ROUTES = [
  "/api/auth",
  "/api/auth/login",
  "/api/customers",
  "/api/orders",
  "/api/tracking",
  "/api/push",
  "/api/delivery-persons/deliveries",
  "/api/users/change-password",
]

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Token de autenticação necessário" }, { status: 401 })
  }

  const token = authHeader.slice(7)
  try {
    const { payload } = await jwtVerify(token, secret)

    if (!payload.establishmentId || !payload.userId) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 })
    }

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-user-id", payload.userId as string)
    requestHeaders.set("x-establishment-id", payload.establishmentId as string)
    requestHeaders.set("x-user-role", payload.role as string)

    return NextResponse.next({
      request: { headers: requestHeaders },
    })
  } catch {
    return NextResponse.json({ error: "Token inválido ou expirado" }, { status: 401 })
  }
}

export const config = {
  matcher: ["/api/:path*"],
}
