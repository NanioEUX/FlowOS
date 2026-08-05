import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    const establishmentId = authUser.establishmentId
    const category = await prisma.category.findUnique({ where: { id: params.id } })
    if (!category || category.establishmentId !== establishmentId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
    }

    const body = await req.json()
    const filtered: Record<string, any> = {}
    for (const key of ["name", "order", "targetMarginPercent", "marginFormula"]) {
      if (key in body) filtered[key] = body[key]
    }

    const updated = await prisma.category.update({
      where: { id: params.id },
      data: filtered,
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao atualizar categoria" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    const establishmentId = authUser.establishmentId
    const category = await prisma.category.findUnique({ where: { id: params.id } })
    if (!category || category.establishmentId !== establishmentId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
    }

    await prisma.category.delete({ where: { id: params.id } })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao deletar categoria" }, { status: 500 })
  }
}
