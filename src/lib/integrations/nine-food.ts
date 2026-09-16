import https from "https"

const NINE_FOOD_API = "api-developer.99food.com"

// Token cache: key = apiKey, value = { token, expiresAt }
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

/**
 * Authenticate with 99Food API.
 * 99Food uses API key authentication (x-api-key header).
 * If they use OAuth, this function will need to be updated.
 */
export async function getNineFoodAuth(apiKey: string): Promise<{ token: string } | null> {
  const cached = tokenCache.get(apiKey)
  if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
    return { token: cached.token }
  }

  // For now, we use the API key directly as the token
  // If 99Food uses OAuth, we'll need to implement the auth flow here
  tokenCache.set(apiKey, {
    token: apiKey,
    expiresAt: Date.now() + 3600 * 1000, // 1 hour default
  })

  return { token: apiKey }
}

/**
 * Map 99Food order format to internal Flow format.
 * This is a flexible mapper that handles various possible 99Food structures.
 * Will be refined once we receive actual webhook payloads.
 */
export function map99FoodOrderToFlow(order: any, establishmentId: string, eventCode?: string) {
  const rawItems = Array.isArray(order?.items) ? order.items :
                   Array.isArray(order?.orderItems) ? order.orderItems :
                   Array.isArray(order?.products) ? order.products : []

  const items = rawItems.map((item: any) => {
    const name = item.name || item.productName || item.itemName || "Item"
    const observation = item.observation || item.note || item.observations || ""
    const price = item.unitPrice || item.price || item.unit_price || 0
    const quantity = item.quantity || item.qty || 1
    const totalPrice = item.totalPrice || item.total || (price * quantity)

    return {
      productId: item.productId || item.id || "",
      code: item.code || item.externalCode || "",
      name,
      price,
      quantity,
      observation,
      totalPrice,
    }
  })

  // Determine payment status
  const paymentMethod = order.paymentMethod || order.payment?.method || "online"
  const paymentStatus = order.paymentStatus || order.payment?.status || "pending"
  const flowPaymentMethod = paymentMethod === "cash" || paymentMethod === "CASH"
    ? "cash"
    : paymentMethod === "card" || paymentMethod === "CREDIT" || paymentMethod === "DEBIT"
    ? "card"
    : "online"

  // Determine order type
  const orderType = order.orderType || order.type || "delivery"
  const flowOrderType = orderType === "pickup" || orderType === "PICKUP" ? "pickup" : "delivery"

  // Get customer info
  const customerName = order.customerName || order.customer?.name || "Cliente 99Food"
  const customerPhone = order.customerPhone || order.customer?.phone || order.customer?.phoneNumber || ""
  const customerAddress = order.deliveryAddress || order.customer?.address || order.address || null

  // Get totals
  const total = order.total || order.totalAmount || order.orderAmount || 0
  const deliveryFee = order.deliveryFee || order.delivery?.fee || 0

  // Get notes
  const notes = order.notes || order.observation || order.delivery?.observations || ""

  // Get external display ID
  const externalDisplayId = order.displayId || order.orderNumber || order.code || null

  // Determine initial status based on event code
  const code = eventCode || ""
  const initialStatus = code === "PLACED" || code === "NEW" || code === "placed"
    ? "pending"
    : code === "CONFIRMED" || code === "confirmed"
    ? "confirmed"
    : "preparing"

  return {
    establishmentId,
    customerName,
    customerPhone,
    customerAddress,
    orderType: flowOrderType,
    paymentMethod: flowPaymentMethod,
    items: JSON.stringify(items),
    total,
    deliveryFee,
    notes,
    externalDisplayId,
    status: initialStatus,
    paymentStatus,
    method: "99food",
  }
}
