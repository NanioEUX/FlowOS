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

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await getAuth()
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const zones = await prisma.deliveryZone.findMany({
    where: { establishmentId: params.id },
    orderBy: { order: "asc" },
  })
  return NextResponse.json(zones)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await getAuth()
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const body = await req.json()
  const zone = await prisma.deliveryZone.create({
    data: {
      establishmentId: params.id,
      name: body.name,
      minKm: body.minKm || 0,
      maxKm: body.maxKm,
      fee: body.fee || 0,
      freeAbove: body.freeAbove || null,
      estimatedMin: body.estimatedMin || 30,
      order: body.order || 0,
      enabled: body.enabled !== false,
    },
  })
  return NextResponse.json(zone)
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await getAuth()
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const body = await req.json()
  const { id, ...data } = body

  const zone = await prisma.deliveryZone.update({
    where: { id },
    data: {
      name: data.name,
      minKm: data.minKm,
      maxKm: data.maxKm,
      fee: data.fee,
      freeAbove: data.freeAbove,
      estimatedMin: data.estimatedMin,
      order: data.order,
      enabled: data.enabled,
    },
  })
  return NextResponse.json(zone)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await getAuth()
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { id } = await req.json()
  await prisma.deliveryZone.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
