import { NextResponse } from "next/server"
import { verifyAuth, type AuthUser } from "@/lib/auth"

export type RequireAuthResult =
  | { user: AuthUser; error: null }
  | { user: null; error: NextResponse }

/**
 * Exige autenticação via JWT (header Authorization: Bearer).
 * Retorna 401 se não houver token válido.
 */
export function requireAuth(request: Request): RequireAuthResult {
  const user = verifyAuth(request)
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Não autorizado" }, { status: 401 }),
    }
  }
  return { user, error: null }
}

/**
 * Exige autenticação e que o establishmentId do JWT corresponda ao
 * establishmentId enviado pelo cliente (query param ou body).
 * Retorna 401 sem token, 403 se establishmentId divergir.
 */
export function requireEstablishment(
  request: Request,
  establishmentIdFromClient?: string | null
): RequireAuthResult {
  const { user, error } = requireAuth(request)
  if (error) return { user: null, error }

  if (
    establishmentIdFromClient &&
    establishmentIdFromClient !== user!.establishmentId
  ) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Estabelecimento não autorizado" },
        { status: 403 }
      ),
    }
  }

  return { user: user!, error: null }
}
