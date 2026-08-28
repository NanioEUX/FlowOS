import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { jwtVerify } from "jose"
import { validarCredenciais99 } from "@/lib/integrations/nine-nine"

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

  return NextResponse.json(establishment)
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await getAuth()
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const body = await req.json()
  const { tipoEntregaAtiva, api99Key, api99EmployeeId } = body

  // Validação: modo 99 exige credenciais
  if (tipoEntregaAtiva === "99entrega") {
    if (!api99Key || !api99EmployeeId) {
      return NextResponse.json(
        { error: "Modo 99Entrega requer Chave de API e Employee ID" },
        { status: 400 }
      )
    }

    // Validar credenciais na 99 antes de salvar
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
      api99Key: true,
      api99EmployeeId: true,
    },
  })

  return NextResponse.json(establishment)
}
