import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { requireEstablishment } from "@/lib/require-auth"
import { validarCredenciais99 } from "@/lib/integrations/nine-nine"

export async function GET(req: Request, { params }: { params: { id: string } }) {
  // F1B-002/F5B-004: escopo de tenant obrigatório (403 se o token for de outra loja)
  const { error } = requireEstablishment(req, params.id)
  if (error) return error

  const establishment = await prisma.establishment.findUnique({
    where: { id: params.id },
    select: {
      tipoEntregaAtiva: true,
      api99Key: true,
      api99EmployeeId: true,
      addressLat: true,
      addressLng: true,
      deliveryRadiusKm: true,
    },
  })

  if (!establishment) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  }

  // F1C-002: a chave da 99 é credencial — devolve só o estado da configuração.
  return NextResponse.json({
    tipoEntregaAtiva: establishment.tipoEntregaAtiva,
    api99Configured: !!establishment.api99Key && !!establishment.api99EmployeeId,
    addressLat: establishment.addressLat,
    addressLng: establishment.addressLng,
    deliveryRadiusKm: establishment.deliveryRadiusKm,
  })
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  // F1B-002/F5B-004: escopo de tenant obrigatório (403 se o token for de outra loja)
  const { error } = requireEstablishment(req, params.id)
  if (error) return error

  const body = await req.json()
  const { tipoEntregaAtiva, api99Key, api99EmployeeId } = body

  if (tipoEntregaAtiva === "99entrega") {
    if (!api99Key || !api99EmployeeId) {
      return NextResponse.json(
        { error: "Modo 99Entrega requer Chave de API e Employee ID" },
        { status: 400 }
      )
    }

    const validacao = await validarCredenciais99(api99Key, api99EmployeeId)
    if (!validacao.success) {
      return NextResponse.json(
        { error: `Credenciais 99 inválidas: ${validacao.error}` },
        { status: 400 }
      )
    }
  }

  const establishment = await prisma.establishment.update({
    where: { id: params.id },
    data: {
      tipoEntregaAtiva: tipoEntregaAtiva || "propria",
      api99Key: tipoEntregaAtiva === "99entrega" ? api99Key : null,
      api99EmployeeId: tipoEntregaAtiva === "99entrega" ? api99EmployeeId : null,
    },
    select: {
      tipoEntregaAtiva: true,
    },
  })

  return NextResponse.json(establishment)
}
