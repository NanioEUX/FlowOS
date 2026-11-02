import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { requireEstablishment } from "@/lib/require-auth"

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  // F1B-002/F5B-004: escopo de tenant obrigatório (403 se o token for de outra loja)
  const { error } = requireEstablishment(req, params.id)
  if (error) return error

  const body = await req.json()
  const { addressLat, addressLng, deliveryRadiusKm } = body

  await prisma.establishment.update({
    where: { id: params.id },
    data: {
      addressLat: addressLat ?? null,
      addressLng: addressLng ?? null,
      deliveryRadiusKm: deliveryRadiusKm ?? 8,
    },
  })

  return NextResponse.json({ success: true })
}
