import { PrismaClient } from "@prisma/client"
import { convertQuantity } from "@/lib/units"

type PrismaTx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

export interface OrderItem {
  productId?: string
  name?: string
  quantity: number
  options?: Array<{ name: string; quantity?: number; productId?: string }>
}

export interface StockLowItem {
  name: string
  quantity: number
  minQuantity: number
}

/**
 * Match a marketplace item (iFood/99Food) to a local Product by name.
 * Tries exact match first, then case-insensitive, then partial (includes).
 */
export async function matchProductByName(
  tx: PrismaTx,
  name: string,
  establishmentId: string
): Promise<string | null> {
  if (!name) return null

  // 1. Exact match
  const exact = await tx.product.findFirst({
    where: { establishmentId, name },
    select: { id: true },
  })
  if (exact) return exact.id

  // 2. Case-insensitive match (using contains with mode)
  const insensitive = await tx.product.findFirst({
    where: { establishmentId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  })
  if (insensitive) return insensitive.id

  // 3. Partial match (product name contains the marketplace item name)
  const partial = await tx.product.findFirst({
    where: { establishmentId, name: { contains: name, mode: "insensitive" } },
    select: { id: true },
  })
  if (partial) return partial.id

  // 4. Reverse partial (marketplace name contains product name)
  const allProducts = await tx.product.findMany({
    where: { establishmentId },
    select: { id: true, name: true },
  })
  const lowerName = name.toLowerCase()
  const reversePartial = allProducts.find((p) =>
    lowerName.includes(p.name.toLowerCase())
  )
  if (reversePartial) return reversePartial.id

  return null
}

/**
 * Deduct stock for a single product (direct sale + ficha técnica).
 * Returns low stock items encountered.
 */
async function deductProductStock(
  tx: PrismaTx,
  productId: string,
  quantity: number,
  orderId: string,
  itemName: string,
  lowStockItems: StockLowItem[]
): Promise<void> {
  const product = await tx.product.findUnique({ where: { id: productId } })
  if (!product) return

  // Direct sale: product linked to a stock item
  if (product.stockItemId) {
    const stockItem = await tx.stockItem.findUnique({ where: { id: product.stockItemId } })
    if (stockItem) {
      const newQty = stockItem.quantity - quantity
      await tx.stockItem.update({
        where: { id: product.stockItemId },
        data: { quantity: newQty },
      })
      await tx.stockMovement.create({
        data: {
          type: "exit",
          quantity,
          notes: `Pedido ${orderId} - ${itemName}`,
          itemId: product.stockItemId,
        },
      })
      if (stockItem.minQuantity > 0 && newQty <= stockItem.minQuantity && !lowStockItems.find((l) => l.name === stockItem.name)) {
        lowStockItems.push({ name: stockItem.name, quantity: newQty, minQuantity: stockItem.minQuantity })
      }
    }
  }

  // BOM links: product made of multiple stock items (ficha técnica)
  const links = await tx.productStockLink.findMany({ where: { productId } })
  for (const link of links) {
    const stockItem = await tx.stockItem.findUnique({ where: { id: link.stockItemId } })
    if (stockItem) {
      const linkUnit = link.unit || "un"
      const deductionInLinkUnit = link.quantity * quantity
      const deductionInStockUnit = convertQuantity(deductionInLinkUnit, linkUnit, stockItem.unit) ?? deductionInLinkUnit
      const newQty = stockItem.quantity - deductionInStockUnit
      await tx.stockItem.update({
        where: { id: link.stockItemId },
        data: { quantity: newQty },
      })
      await tx.stockMovement.create({
        data: {
          type: "exit",
          quantity: deductionInStockUnit,
          notes: `Pedido ${orderId} - ${deductionInLinkUnit}${linkUnit}`,
          itemId: link.stockItemId,
        },
      })
      if (stockItem.minQuantity > 0 && newQty <= stockItem.minQuantity && !lowStockItems.find((l) => l.name === stockItem.name)) {
        lowStockItems.push({ name: stockItem.name, quantity: newQty, minQuantity: stockItem.minQuantity })
      }
    }
  }
}

/**
 * Deduct stock for additional options that have consumesStock=true.
 */
async function deductAdditionalStock(
  tx: PrismaTx,
  productId: string,
  optionNames: string[],
  quantity: number,
  orderId: string,
  lowStockItems: StockLowItem[]
): Promise<void> {
  if (!optionNames.length) return

  const additionals = await tx.additionalOption.findMany({
    where: { productId, consumesStock: true },
  })

  for (const opt of additionals) {
    const nameMatch = optionNames.some(
      (n) => n.toLowerCase().trim() === opt.name.toLowerCase().trim()
    )
    if (!nameMatch) continue
    if (!opt.stockProductId) continue

    const stockProduct = await tx.product.findUnique({ where: { id: opt.stockProductId } })
    if (!stockProduct) continue

    const deductionQty = opt.stockQuantity * quantity
    await deductProductStock(tx, opt.stockProductId, deductionQty, orderId, `${opt.name} (adicional)`, lowStockItems)
  }
}

/**
 * Deduct stock for all items in an order.
 * Works for cardápio online, iFood, and 99Food orders.
 * Returns low stock warnings.
 */
export async function deductOrderStock(
  tx: PrismaTx,
  items: OrderItem[],
  orderId: string,
  establishmentId: string,
  isMarketplaceOrder: boolean = false
): Promise<StockLowItem[]> {
  const lowStockItems: StockLowItem[] = []

  for (const item of items) {
    let productId = item.productId || ""

    // For marketplace orders, try to match by name if no valid productId
    if (isMarketplaceOrder && (!productId || productId === "" || productId === "custom")) {
      if (item.name) {
        const matchedId = await matchProductByName(tx, item.name, establishmentId)
        if (matchedId) {
          productId = matchedId
        }
      }
    }

    // Skip custom items or unmatched marketplace items
    if (!productId || productId === "custom") continue

    // Deduct main product stock
    await deductProductStock(tx, productId, item.quantity, orderId, item.name || "Item", lowStockItems)

    // Deduct additional options stock
    if (item.options && item.options.length > 0) {
      const optionNames = item.options.map((o) => o.name)
      await deductAdditionalStock(tx, productId, optionNames, item.quantity, orderId, lowStockItems)
    }
  }

  return lowStockItems
}

/**
 * Restore stock for a single product (reverse of deductProductStock).
 */
async function restoreProductStock(
  tx: PrismaTx,
  productId: string,
  quantity: number,
  orderId: string,
  itemName: string
): Promise<void> {
  const product = await tx.product.findUnique({ where: { id: productId } })
  if (!product) return

  // Direct sale: product linked to a stock item
  if (product.stockItemId) {
    const stockItem = await tx.stockItem.findUnique({ where: { id: product.stockItemId } })
    if (stockItem) {
      const newQty = stockItem.quantity + quantity
      await tx.stockItem.update({
        where: { id: product.stockItemId },
        data: { quantity: newQty },
      })
      await tx.stockMovement.create({
        data: {
          type: "entry",
          quantity,
          notes: `Estorno Pedido ${orderId} - ${itemName}`,
          itemId: product.stockItemId,
        },
      })
    }
  }

  // BOM links: restore each ingredient
  const links = await tx.productStockLink.findMany({ where: { productId } })
  for (const link of links) {
    const stockItem = await tx.stockItem.findUnique({ where: { id: link.stockItemId } })
    if (stockItem) {
      const linkUnit = link.unit || "un"
      const restoreInLinkUnit = link.quantity * quantity
      const restoreInStockUnit = convertQuantity(restoreInLinkUnit, linkUnit, stockItem.unit) ?? restoreInLinkUnit
      const newQty = stockItem.quantity + restoreInStockUnit
      await tx.stockItem.update({
        where: { id: link.stockItemId },
        data: { quantity: newQty },
      })
      await tx.stockMovement.create({
        data: {
          type: "entry",
          quantity: restoreInStockUnit,
          notes: `Estorno Pedido ${orderId} - ${restoreInLinkUnit}${linkUnit}`,
          itemId: link.stockItemId,
        },
      })
    }
  }
}

/**
 * Restore stock for additional options.
 */
async function restoreAdditionalStock(
  tx: PrismaTx,
  productId: string,
  optionNames: string[],
  quantity: number,
  orderId: string
): Promise<void> {
  if (!optionNames.length) return

  const additionals = await tx.additionalOption.findMany({
    where: { productId, consumesStock: true },
  })

  for (const opt of additionals) {
    const nameMatch = optionNames.some(
      (n) => n.toLowerCase().trim() === opt.name.toLowerCase().trim()
    )
    if (!nameMatch) continue
    if (!opt.stockProductId) continue

    const restoreQty = opt.stockQuantity * quantity
    await restoreProductStock(tx, opt.stockProductId, restoreQty, orderId, `${opt.name} (adicional)`)
  }
}

/**
 * Restore stock for all items in a cancelled order.
 */
export async function restoreOrderStock(
  tx: PrismaTx,
  itemsJson: string,
  orderId: string,
  establishmentId: string
): Promise<void> {
  try {
    const items: OrderItem[] = typeof itemsJson === "string" ? JSON.parse(itemsJson) : itemsJson
    if (!Array.isArray(items) || items.length === 0) return

    for (const item of items) {
      let productId = item.productId || ""

      // For marketplace orders, try to match by name
      if (!productId || productId === "" || productId === "custom") {
        if (item.name) {
          const matchedId = await matchProductByName(tx, item.name, establishmentId)
          if (matchedId) {
            productId = matchedId
          }
        }
      }

      if (!productId || productId === "custom") continue

      // Restore main product stock
      await restoreProductStock(tx, productId, item.quantity, orderId, item.name || "Item")

      // Restore additional options stock
      if (item.options && item.options.length > 0) {
        const optionNames = item.options.map((o) => o.name)
        await restoreAdditionalStock(tx, productId, optionNames, item.quantity, orderId)
      }
    }
  } catch (e) {
    console.error("[restoreOrderStock] error:", e)
  }
}
