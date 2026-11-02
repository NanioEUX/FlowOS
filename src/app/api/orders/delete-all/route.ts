import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

// Endpoint restrito: apaga SOMENTE os pedidos do estabelecimento autenticado.
// Usado para limpar dado de teste.
//
// F4D-025/F1C-110: rota destrutiva não deve existir em produção. Em produção
// ela só responde se o dono habilitar explicitamente com ALLOW_DELETE_ALL=true.
export async function DELETE(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const allowed = process.env.NODE_ENV !== "production" || process.env.ALLOW_DELETE_ALL === "true"
  if (!allowed) {
    return NextResponse.json(
      { error: "Rota desabilitada em produção (ALLOW_DELETE_ALL=true habilita)" },
      { status: 403 }
    )
  }
  try {
    const result = await prisma.order.deleteMany({
      where: { establishmentId: auth.establishmentId },
    })
    return NextResponse.json({ success: true, deleted: result.count })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}