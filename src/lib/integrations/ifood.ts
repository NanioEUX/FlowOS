import https from "https"

const IFOOD_API = "merchant-api.ifood.com.br"
const IFOOD_AUTH = "/authentication/v1.0/oauth/token"
const IFOOD_EVENTS = "/order/v1.0/events:polling"
const IFOOD_ORDERS = "/order/v1.0/orders"

export async function getIfoodAuth(clientId: string, clientSecret: string): Promise<{ accessToken: string }> {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams({ grantType: "client_credentials", clientId, clientSecret }).toString()
    const options = { hostname: IFOOD_API, path: IFOOD_AUTH, method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(data) } }
    const req = https.request(options, (res) => {
      let body = ""
      res.on("data", (c) => (body += c))
      res.on("end", () => { try { resolve(JSON.parse(body)) } catch { reject(new Error("Auth parse error")) } })
    })
    req.on("error", reject)
    req.write(data)
    req.end()
  })
}

export async function getIfoodEvents(token: string, merchantId: string): Promise<any[]> {
  return new Promise((resolve) => {
    const options = { hostname: IFOOD_API, path: IFOOD_EVENTS, method: "GET", headers: { Authorization: `Bearer ${token}`, MerchantId: merchantId } }
    const req = https.request(options, (res) => {
      let body = ""
      res.on("data", (c) => (body += c))
      res.on("end", () => { try { resolve(JSON.parse(body)) } catch { resolve([]) } })
    })
    req.on("error", () => resolve([]))
    req.end()
  })
}

export async function getIfoodOrder(token: string, merchantId: string, orderId: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = { hostname: IFOOD_API, path: `${IFOOD_ORDERS}/${orderId}`, method: "GET", headers: { Authorization: `Bearer ${token}`, MerchantId: merchantId } }
    const req = https.request(options, (res) => {
      let body = ""
      res.on("data", (c) => (body += c))
      res.on("end", () => { try { resolve(JSON.parse(body)) } catch { reject(new Error("Parse error")) } })
    })
    req.on("error", reject)
    req.end()
  })
}

export function mapIfoodOrderToFlow(order: any, establishmentId: string, eventCode?: string) {
  const items = order.items.map((item: any) => {
    let name = item.name
    let observation = item.observations || ""
    if (item.options && item.options.length > 0) {
      const optNames = item.options.map((opt: any) => opt.name).join(", ")
      observation = observation ? `${observation} | Adicionais: ${optNames}` : `Adicionais: ${optNames}`
    }
    return { productId: "", code: item.externalCode, name, price: item.unitPrice, quantity: item.quantity, observation, totalPrice: item.totalPrice }
  })
  const isPendingPayment = (order.payments?.pending || 0) > 0
  // iFood order status is tracked by events; the order resource itself does
  // not expose a status field we can map 1:1 to Flow. The caller (poll or
  // webhook handler) passes the event code so we can decide the initial
  // Flow status.
  const code = eventCode || ""
  const initialStatus = (code === "PLC" || code === "PLACED") ? "pending" : "confirmed"
  return {
    establishmentId,
    customerName: order.customer?.name || "Cliente iFood",
    customerPhone: order.customer?.phone?.number || "",
    customerAddress: order.orderType === "DELIVERY" && order.delivery?.deliveryAddress ? order.delivery.deliveryAddress.formattedAddress : null,
    orderType: order.orderType === "DELIVERY" ? "delivery" : "pickup",
    paymentMethod: "online",
    items: JSON.stringify(items),
    total: order.total?.orderAmount || 0,
    deliveryFee: order.total?.deliveryFee || 0,
    notes: order.additionalInfo?.metadata?.customerEmail || "",
    status: initialStatus,
    paymentStatus: isPendingPayment ? "pending" : "paid",
    method: "ifood",
  }
}
