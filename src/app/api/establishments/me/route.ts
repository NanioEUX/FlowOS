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
    return payload as any
  } catch {
    return null
  }
}

export async function GET() {
  const auth = await getAuth()
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { establishmentId: true },
  })

  if (!user?.establishmentId) {
    return NextResponse.json({ error: "Sem estabelecimento" }, { status: 404 })
  }

  const establishment = await prisma.establishment.findUnique({
    where: { id: user.establishmentId },
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
