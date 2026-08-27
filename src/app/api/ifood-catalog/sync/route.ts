import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getIfoodAuth } from "@/lib/integrations/ifood"
import { verifyAuth } from "@/lib/auth"
import {
  updateItemPrice,
  updateItemStatus,
  updateMerchantHours,
  batchUpdateItems,
} from "@/lib/integrations/ifood-catalog-write"

/**
 * POST /api/ifood-catalog/sync
 * 
 * Sync local catalog changes TO iFood.
 * Body:
 *   - action: "update_price" | "update_status" | "batch" | "update_hours"
 *   - For update_price: { groupId, itemId, price }
 *   - For update_status: { groupId, itemId, status: "AVAILABLE" | "UNAVAILABLE" }
 *   - For batch: { updates: [{ groupId, itemId, price?, status? }] }
 *   - For update_hours: { operatingHours: [...] }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = verifyAuth(req)
    if (!auth) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const establishment = await prisma.establishment.findUnique({
      where: { id: auth.establishmentId },
      select: { ifoodMerchantId: true, ifoodEnabled: true },
    })

    if (!establishment?.ifoodEnabled || !establishment?.ifoodMerchantId) {
      return NextResponse.json(
        { error: "iFood não configurado neste estabelecimento" },
        { status: 400 }
      )
    }

    const ifoodAuth = await getIfoodAuth(
      process.env.IFOOD_CLIENT_ID!,
      process.env.IFOOD_CLIENT_SECRET!
    )

    if (!ifoodAuth?.accessToken) {
      return NextResponse.json(
        { error: "Falha na autenticação com iFood" },
        { status: 502 }
      )
    }

    const body = await req.json()
    const { action } = body

    switch (action) {
      case "update_price": {
        const { groupId, itemId, price } = body
        if (!groupId || !itemId || price === undefined) {
          return NextResponse.json({ error: "groupId, itemId e price são obrigatórios" }, { status: 400 })
        }
        const result = await updateItemPrice(
          ifoodAuth.accessToken,
          establishment.ifoodMerchantId,
          groupId,
          itemId,
          price
        )
        return NextResponse.json(result)
      }

      case "update_status": {
        const { groupId, itemId, status } = body
        if (!groupId || !itemId || !status) {
          return NextResponse.json({ error: "groupId, itemId e status são obrigatórios" }, { status: 400 })
        }
        if (!["AVAILABLE", "UNAVAILABLE"].includes(status)) {
          return NextResponse.json({ error: "status deve ser AVAILABLE ou UNAVAILABLE" }, { status: 400 })
        }
        const result = await updateItemStatus(
          ifoodAuth.accessToken,
          establishment.ifoodMerchantId,
          groupId,
          itemId,
          status
        )
        return NextResponse.json(result)
      }

      case "batch": {
        const { updates } = body
        if (!Array.isArray(updates) || updates.length === 0) {
          return NextResponse.json({ error: "updates deve ser um array não vazio" }, { status: 400 })
        }
        const results = await batchUpdateItems(
          ifoodAuth.accessToken,
          establishment.ifoodMerchantId,
          updates
        )
        return NextResponse.json({ results })
      }

      case "update_hours": {
        const { operatingHours } = body
        if (!Array.isArray(operatingHours)) {
          return NextResponse.json({ error: "operatingHours deve ser um array" }, { status: 400 })
        }
        const result = await updateMerchantHours(
          ifoodAuth.accessToken,
          establishment.ifoodMerchantId,
          operatingHours
        )
        return NextResponse.json(result)
      }

      default:
        return NextResponse.json(
          { error: `action inválida: ${action}. Use: update_price, update_status, batch, update_hours` },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error("[ifood-catalog-sync] error:", error.message)
    return NextResponse.json(
      { error: `Erro ao sincronizar com iFood: ${error.message}` },
      { status: 500 }
    )
  }
}
