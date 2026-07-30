import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"
import { EvolutionProvider } from "@/lib/whatsapp/evolution"

export async function POST(
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

    const establishment = await prisma.establishment.findUnique({
      where: { id: params.id },
      select: {
        evolutionBaseUrl: true,
        evolutionApiKey: true,
        evolutionInstanceName: true,
      },
    })

    if (!establishment?.evolutionBaseUrl || !establishment.evolutionApiKey || !establishment.evolutionInstanceName) {
      return NextResponse.json({ error: "Evolution não configurada" }, { status: 400 })
    }

    const provider = new EvolutionProvider({
      baseUrl: establishment.evolutionBaseUrl,
      apiKey: establishment.evolutionApiKey,
      instanceName: establishment.evolutionInstanceName,
    })

    const result = await provider.logoutInstance()

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[WhatsApp Disconnect] Erro:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
