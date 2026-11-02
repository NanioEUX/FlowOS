import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getIfoodAuth } from "@/lib/integrations/ifood"
import { updateIfoodStatus } from "@/lib/integrations/ifood-status"
import { requireAuth } from "@/lib/require-auth"

export async function POST(req: NextRequest) {
  try {
    const authResult = requireAuth(req)
    if (authResult.error) return authResult.error
    const user = authResult.user!

    // F1B-002/F4D-025: antes o merchant iFood estava HARDCODED no código —
    // qualquer usuário logado (de qualquer loja) mexia nos pedidos de outro
    // estabelecimento. Agora usa o merchant do tenant autenticado e exige admin.
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Acesso restrito a admin" }, { status: 403 })
    }

    const establishment = await prisma.establishment.findUnique({
      where: { id: user.establishmentId },
      select: { ifoodMerchantId: true, ifoodEnabled: true },
    })
    if (!establishment?.ifoodMerchantId || !establishment.ifoodEnabled) {
      return NextResponse.json(
        { error: "Estabelecimento sem iFood habilitado" },
        { status: 400 }
      )
    }

    const { status, externalId } = await req.json()
    if (!externalId || !status) {
      return NextResponse.json({ error: "need status and externalId" })
    }

    const auth = await getIfoodAuth(
      process.env.IFOOD_CLIENT_ID!,
      process.env.IFOOD_CLIENT_SECRET!
    )
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "ifood auth failed" }, { status: 502 })
    }
    const accessToken = auth.accessToken

    const actionMap: Record<string, string> = {
      confirmed: "confirm",
      preparing: "startPreparation",
      ready: "readyForPickup",
      dispatched: "dispatch",
      out_to_delivery: "dispatch",
      out_for_delivery: "dispatch",
      outfordelivery: "dispatch",
      delivered: "dispatch",
      cancelled: "cancel",
    }
    const action = actionMap[status]
    if (!action) return NextResponse.json({ error: "no action for " + status })

    const result = await updateIfoodStatus(accessToken, establishment.ifoodMerchantId, externalId, action)
    return NextResponse.json({ action, ...result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}
