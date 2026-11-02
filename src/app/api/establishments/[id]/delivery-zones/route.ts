import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { requireEstablishment } from "@/lib/require-auth"

export async function GET(req: Request, { params }: { params: { id: string } }) {
  // F1B-002/F5B-004: escopo de tenant obrigatório (403 se o token for de outra loja)
  const { error } = requireEstablishment(req, params.id)
  if (error) return error

  const zones = await prisma.deliveryZone.findMany({
    where: { establishmentId: params.id },
    orderBy: { order: "asc" },
  })
  return NextResponse.json(zones)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  // F1B-002/F5B-004: escopo de tenant obrigatório (403 se o token for de outra loja)
  const { error } = requireEstablishment(req, params.id)
  if (error) return error

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
  // F1B-002/F5B-004: escopo de tenant obrigatório (403 se o token for de outra loja)
  const { error } = requireEstablishment(req, params.id)
  if (error) return error

  const body = await req.json()
  const { id, ...data } = body

  // F2-001/F1B: a zona precisa pertencer a este establishment (senão o `id` do
  // body permitiria editar zona de outra loja).
  const existing = await prisma.deliveryZone.findFirst({
    where: { id, establishmentId: params.id },
    select: { id: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "Zona não encontrada" }, { status: 404 })
  }

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
  // F1B-002/F5B-004: escopo de tenant obrigatório (403 se o token for de outra loja)
  const { error } = requireEstablishment(req, params.id)
  if (error) return error

  const { id } = await req.json()
  // F2-001/F1B: apagar só zona própria (id do body sem ownership = cross-tenant).
  const existing = await prisma.deliveryZone.findFirst({
    where: { id, establishmentId: params.id },
    select: { id: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "Zona não encontrada" }, { status: 404 })
  }
  await prisma.deliveryZone.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
