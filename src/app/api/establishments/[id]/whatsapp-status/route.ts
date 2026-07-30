import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"
import { EvolutionProvider } from "@/lib/whatsapp/evolution"

export async function GET(
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
        whatsappNumber: true,
      },
    })

    if (!establishment?.evolutionBaseUrl || !establishment.evolutionApiKey || !establishment.evolutionInstanceName) {
      return NextResponse.json({
        state: "close",
        configured: false,
      })
    }

    const provider = new EvolutionProvider({
      baseUrl: establishment.evolutionBaseUrl,
      apiKey: establishment.evolutionApiKey,
      instanceName: establishment.evolutionInstanceName,
    })

    const state = await provider.getConnectionState()

    if (state.state === "open" && state.number && !establishment.whatsappNumber) {
      await prisma.establishment.update({
        where: { id: params.id },
        data: { whatsappNumber: state.number },
      })
    }

    return NextResponse.json({
      state: state.state,
      number: state.number || establishment.whatsappNumber,
      profileName: state.profileName,
    })
  } catch (error: any) {
    console.error("[WhatsApp Status] Erro:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
