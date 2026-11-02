import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/require-auth"

export async function GET(req: Request) {
  // F1B-002: usa o mesmo validador do resto do app (header Bearer ou cookie
  // httpOnly `auth_token`) — sem fallback manual de leitura de cookie.
  const { user: authUser, error } = requireAuth(req)
  if (error) return error

  const establishment = await prisma.establishment.findUnique({
    where: { id: authUser!.establishmentId },
    select: {
      id: true,
      name: true,
      address: true,
      addressLat: true,
      addressLng: true,
      deliveryRadiusKm: true,
    },
  })

  return NextResponse.json(establishment)
}
