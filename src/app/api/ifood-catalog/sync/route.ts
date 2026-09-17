import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getIfoodAuth } from "@/lib/integrations/ifood"
import { verifyAuth } from "@/lib/auth"
import {
  updateItemPrice,
  updateItemStatus,
  updateOptionPrice,
  updateOptionStatus,
  updateMerchantHours,
  batchUpdatePrices,
  batchUpdateStatuses,
  getBatchStatus,
  createCategory,
  createOrUpdateItem,
  getMerchantStatus,
  getInterruptions,
  createInterruption,
  deleteInterruption,
} from "@/lib/integrations/ifood-catalog-write"

/**
 * POST /api/ifood-catalog/sync
 *
 * Sync local catalog changes TO iFood.
 * Actions:
 *   update_price     — { itemId, price }
 *   update_status    — { itemId, status }
 *   update_option_price — { optionId, price }
 *   update_option_status — { optionId, status }
 *   batch_prices     — { updates: [{ externalCode, price }] }
 *   batch_statuses   — { updates: [{ externalCode, status }] }
 *   check_batch      — { batchId }
 *   update_hours     — { operatingHours: [...] }
 *   create_category  — { name }
 *   create_item      — { item, products, optionGroups }
 *   merchant_status  — {}
 *   list_interruptions — {}
 *   create_interruption — { startDateTime, endDateTime, description }
 *   delete_interruption — { interruptionId }
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

    const token = ifoodAuth.accessToken
    const mid = establishment.ifoodMerchantId
    const body = await req.json()
    const { action } = body

    switch (action) {
      // --- Catalog updates ---
      case "update_price": {
        const { itemId, price } = body
        if (!itemId || price === undefined) {
          return NextResponse.json({ error: "itemId e price são obrigatórios" }, { status: 400 })
        }
        const result = await updateItemPrice(token, mid, itemId, price)
        return NextResponse.json(result)
      }

      case "update_status": {
        const { itemId, status } = body
        if (!itemId || !status) {
          return NextResponse.json({ error: "itemId e status são obrigatórios" }, { status: 400 })
        }
        if (!["AVAILABLE", "UNAVAILABLE"].includes(status)) {
          return NextResponse.json({ error: "status deve ser AVAILABLE ou UNAVAILABLE" }, { status: 400 })
        }
        const result = await updateItemStatus(token, mid, itemId, status)
        return NextResponse.json(result)
      }

      case "update_option_price": {
        const { optionId, price } = body
        if (!optionId || price === undefined) {
          return NextResponse.json({ error: "optionId e price são obrigatórios" }, { status: 400 })
        }
        const result = await updateOptionPrice(token, mid, optionId, price)
        return NextResponse.json(result)
      }

      case "update_option_status": {
        const { optionId, status } = body
        if (!optionId || !status) {
          return NextResponse.json({ error: "optionId e status são obrigatórios" }, { status: 400 })
        }
        const result = await updateOptionStatus(token, mid, optionId, status)
        return NextResponse.json(result)
      }

      // --- Batch operations ---
      case "batch_prices": {
        const { updates } = body
        if (!Array.isArray(updates) || updates.length === 0) {
          return NextResponse.json({ error: "updates deve ser um array não vazio" }, { status: 400 })
        }
        const result = await batchUpdatePrices(token, mid, updates)
        return NextResponse.json(result)
      }

      case "batch_statuses": {
        const { updates } = body
        if (!Array.isArray(updates) || updates.length === 0) {
          return NextResponse.json({ error: "updates deve ser um array não vazio" }, { status: 400 })
        }
        const result = await batchUpdateStatuses(token, mid, updates)
        return NextResponse.json(result)
      }

      case "check_batch": {
        const { batchId } = body
        if (!batchId) {
          return NextResponse.json({ error: "batchId é obrigatório" }, { status: 400 })
        }
        const result = await getBatchStatus(token, mid, batchId)
        return NextResponse.json(result)
      }

      // --- Catalog creation ---
      case "create_category": {
        const { name } = body
        if (!name) {
          return NextResponse.json({ error: "name é obrigatório" }, { status: 400 })
        }
        const result = await createCategory(token, mid, name)
        return NextResponse.json(result)
      }

      case "create_item": {
        const { item, products, optionGroups } = body
        if (!item || !products || products.length === 0) {
          return NextResponse.json({ error: "item e products são obrigatórios" }, { status: 400 })
        }
        const result = await createOrUpdateItem(token, mid, item, products, optionGroups || [])
        return NextResponse.json(result)
      }

      // --- Merchant status ---
      case "merchant_status": {
        const result = await getMerchantStatus(token, mid)
        return NextResponse.json(result)
      }

      // --- Interruptions ---
      case "list_interruptions": {
        const result = await getInterruptions(token, mid)
        return NextResponse.json(result)
      }

      case "create_interruption": {
        const { startDateTime, endDateTime, description } = body
        if (!startDateTime || !endDateTime) {
          return NextResponse.json({ error: "startDateTime e endDateTime são obrigatórios" }, { status: 400 })
        }
        const result = await createInterruption(token, mid, startDateTime, endDateTime, description || "Pausa temporária")
        return NextResponse.json(result)
      }

      case "delete_interruption": {
        const { interruptionId } = body
        if (!interruptionId) {
          return NextResponse.json({ error: "interruptionId é obrigatório" }, { status: 400 })
        }
        const result = await deleteInterruption(token, mid, interruptionId)
        return NextResponse.json(result)
      }

      // --- Operating hours ---
      case "update_hours": {
        const { operatingHours } = body
        if (!Array.isArray(operatingHours)) {
          return NextResponse.json({ error: "operatingHours deve ser um array" }, { status: 400 })
        }
        const result = await updateMerchantHours(token, mid, operatingHours)
        return NextResponse.json(result)
      }

      default:
        return NextResponse.json(
          { error: `action inválida: ${action}` },
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
