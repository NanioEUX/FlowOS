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
    if (authUser.establishmentId !== params.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
    }

    const current = await prisma.establishment.findUnique({
      where: { id: params.id },
      select: { isOpenOverride: true },
    })

    if (!current) {
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
    }

    const newValue = current.isOpenOverride === true ? false : true

    const updated = await prisma.establishment.update({
      where: { id: params.id },
      data: { isOpenOverride: newValue },
      select: { isOpenOverride: true },
    })

    return NextResponse.json({ isOpenOverride: updated.isOpenOverride })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao alterar status" }, { status: 500 })
  }
}
