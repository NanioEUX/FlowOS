import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    const establishmentId = authUser.establishmentId
    const person = await prisma.deliveryPerson.findUnique({ where: { id: params.id } })
    if (!person || person.establishmentId !== establishmentId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
    }

    const body = await req.json()
    // F2-001 — mass assignment: só escalares do DeliveryPerson. establishmentId
    // fica de fora (mudaria o tenant) e token/createdAt/id também. Nenhum front
    // usa este PATCH hoje — allowlist preventiva.
    const data: Record<string, unknown> = {}
    for (const key of ["name", "phone", "userId", "isActive"] as const) {
      if (key in body && body[key] !== undefined && (body[key] === null || typeof body[key] !== "object")) {
        data[key] = body[key]
      }
    }
    const updated = await prisma.deliveryPerson.update({
      where: { id: params.id },
      data,
    })
    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    const establishmentId = authUser.establishmentId
    const person = await prisma.deliveryPerson.findUnique({ where: { id: params.id } })
    if (!person || person.establishmentId !== establishmentId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
    }

    await prisma.deliveryPerson.update({
      where: { id: params.id },
      data: { isActive: false },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Erro ao remover" }, { status: 500 })
  }
}
