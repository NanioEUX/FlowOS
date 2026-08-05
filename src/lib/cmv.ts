import { prisma } from "@/lib/prisma"
import { convertQuantity } from "@/lib/units"

export interface ParsedItem {
  id?: string
  productId?: string
  name: string
  price: number
  quantity: number
}

export interface ItemCostResult {
  productId: string | null
  productName: string
  quantity: number
  unitCostCents: number
  totalCostCents: number
  hasRecipe: boolean
}

/**
 * Calcula o CMV (custo de mercadoria vendida) de cada item de um pedido
 * somando os custos unitários dos insumos vinculados via ProductStockLink.
 *
 * Retorna o custo TOTAL em centavos do pedido (somando todos os itens).
 * Itens sem ficha técnica têm custo 0 (não conta pra CMV).
 */
export async function computeOrderItemCosts(items: ParsedItem[]): Promise<{
  costs: ItemCostResult[]
  totalCostCents: number
}> {
  const costs: ItemCostResult[] = []

  for (const item of items) {
    const productId = item.productId || item.id
    const quantity = Number(item.quantity) || 1

    if (!productId) {
      costs.push({
        productId: null,
        productName: item.name,
        quantity,
        unitCostCents: 0,
        totalCostCents: 0,
        hasRecipe: false,
      })
      continue
    }

    const links = await prisma.productStockLink.findMany({
      where: { productId },
      include: { stockItem: { select: { unitCost: true, unit: true } } },
    })

    if (links.length === 0) {
      costs.push({
        productId,
        productName: item.name,
        quantity,
        unitCostCents: 0,
        totalCostCents: 0,
        hasRecipe: false,
      })
      continue
    }

    // Para cada link, converte da unidade do link pra unidade do StockItem
    // antes de multiplicar pelo custo unitário. Se incompatível, usa como está.
    const unitCost = links.reduce((sum, link) => {
      const linkUnit = link.unit || "un"
      const stockUnit = link.stockItem.unit || "un"
      const qtyInStockUnit = convertQuantity(link.quantity, linkUnit, stockUnit) ?? link.quantity
      return sum + qtyInStockUnit * link.stockItem.unitCost
    }, 0)
    const unitCostCents = Math.round(unitCost * 100)
    const totalCostCents = unitCostCents * quantity

    costs.push({
      productId,
      productName: item.name,
      quantity,
      unitCostCents,
      totalCostCents,
      hasRecipe: true,
    })
  }

  const totalCostCents = costs.reduce((sum, c) => sum + c.totalCostCents, 0)
  return { costs, totalCostCents }
}
