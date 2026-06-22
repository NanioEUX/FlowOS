import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
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
    const user = await prisma.user.findUnique({ where: { id: params.id } })
    if (!user || user.establishmentId !== establishmentId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
    }

    const body = await req.json()
    const data: any = {}

    if (body.name) data.name = body.name
    if (body.email) data.email = body.email
    if (body.role) data.role = body.role
    if (body.permissions) data.permissions = JSON.stringify(body.permissions)
    if (typeof body.isActive === "boolean") data.isActive = body.isActive
    if (typeof body.canCloseRegister === "boolean") data.canCloseRegister = body.canCloseRegister
    if (body.password && body.password.length > 0) {
      data.password = await bcrypt.hash(body.password, 10)
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        canCloseRegister: true,
        isActive: true,
        createdAt: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 })
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
    const user = await prisma.user.findUnique({ where: { id: params.id } })
    if (!user || user.establishmentId !== establishmentId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
    }

    await prisma.user.delete({ where: { id: params.id } })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao deletar" }, { status: 500 })
  }
}
