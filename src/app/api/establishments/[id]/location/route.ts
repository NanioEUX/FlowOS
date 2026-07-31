import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { jwtVerify } from "jose"

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "flowos-secret")

async function getAuth() {
  const token = cookies().get("auth_token")?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload
  } catch {
    return null
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await getAuth()
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

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
