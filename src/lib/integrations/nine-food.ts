/**
 * Map 99Food order payload to internal Flow format.
 *
 * 99Food uses Open Delivery Abrasel standard:
 * {
 *   "displayId": "4567",
 *   "deliveryMethod": "99_DELIVERY",
 *   "payment": { "prepaid": true, "method": "ONLINE_CREDIT_CARD", "totalAmount": 45.90 },
 *   "items": [{ "id", "name", "quantity", "unitPrice", "options": [{ "name", "price", "quantity" }] }],
 *   "delivery": { "fee": 0.00, "deliveryAddress": { "formattedAddress", "coordinates": { "lat", "lng" } } }
 * }
 */
export function map99FoodOrderToFlow(order: any, establishmentId: string, eventCode?: string) {
  // Items with options (addons)
  const rawItems = Array.isArray(order?.items) ? order.items : []
  const items = rawItems.map((item: any) => {
    let observation = ""
    if (item.options && item.options.length > 0) {
      observation = item.options
        .map((opt: any) => `${opt.name}${opt.quantity > 1 ? ` x${opt.quantity}` : ""} (+R$ ${(opt.price || 0).toFixed(2)})`)
        .join(", ")
    }
    return {
      productId: item.id || "",
      code: item.id || "",
      name: item.name || "Item",
      price: item.unitPrice || 0,
      quantity: item.quantity || 1,
      observation,
      totalPrice: (item.unitPrice || 0) * (item.quantity || 1),
    }
  })

  // Payment mapping (Abrasel standard)
  const payment = order.payment || {}
  const paymentMethod = payment.method || ""
  const prepaid = payment.prepaid === true

  // Flow payment method
  let flowPaymentMethod = "online"
  if (paymentMethod === "CASH" || paymentMethod === "cash") {
    flowPaymentMethod = "cash"
  } else if (["CREDIT_CARD", "DEBIT_CARD", "CARD"].includes(paymentMethod)) {
    flowPaymentMethod = prepaid ? "online" : "card"
  }

  // Payment status
  const paymentStatus = prepaid ? "paid" : "pending"

  // Order type from deliveryMethod
  const deliveryMethod = order.deliveryMethod || ""
  const orderType = deliveryMethod === "PICKUP" || deliveryMethod === "MERCHANT_DELIVERY"
    ? "pickup"
    : "delivery"

  // Delivery fee
  const deliveryFee = order.delivery?.fee || 0

  // Total from payment
  const total = payment.totalAmount || 0

  // Customer address
  const addr = order.delivery?.deliveryAddress
  const customerAddress = addr?.formattedAddress || null

  // Coordinates for delivery tracking
  const coordinates = addr?.coordinates || null

  return {
    establishmentId,
    customerName: order.customerName || "Cliente 99Food",
    customerPhone: order.customerPhone || "",
    customerAddress,
    customerLat: coordinates?.latitude || coordinates?.lat || null,
    customerLng: coordinates?.longitude || coordinates?.lng || null,
    orderType,
    paymentMethod: flowPaymentMethod,
    items: JSON.stringify(items),
    total,
    deliveryFee,
    notes: order.delivery?.observations || order.observations || "",
    externalDisplayId: order.displayId || null,
    status: "pending",
    paymentStatus,
    method: "99food",
  }
}
