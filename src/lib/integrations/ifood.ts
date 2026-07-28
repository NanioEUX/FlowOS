import https from "https"

const IFOOD_API = "merchant-api.ifood.com.br"
const IFOOD_AUTH = "/authentication/v1.0/oauth/token"
const IFOOD_EVENTS = "/order/v1.0/events:polling"
const IFOOD_ORDERS = "/order/v1.0/orders"

export async function getIfoodAuth(clientId: string, clientSecret: string): Promise<{ accessToken: string } | null> {
  return new Promise((resolve) => {
    const data = new URLSearchParams({ grantType: "client_credentials", clientId, clientSecret }).toString()
    const options = { hostname: IFOOD_API, path: IFOOD_AUTH, method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(data) } }
    const req = https.request(options, (res) => {
      let body = ""
      res.on("data", (c) => (body += c))
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body)
          if (res.statusCode && res.statusCode >= 400) {
            console.error("[ifood auth] HTTP", res.statusCode, body.slice(0, 200))
            resolve(null)
            return
          }
          resolve(parsed)
        } catch {
          console.error("[ifood auth] parse error, status=", res.statusCode, "body=", body.slice(0, 200))
          resolve(null)
        }
      })
    })
    req.on("error", (err) => { console.error("[ifood auth] request error:", err.message); resolve(null) })
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
  const rawItems = Array.isArray(order?.items) ? order.items : []
  const items = rawItems.map((item: any) => {
    let name = item.name
    let observation = item.observations || ""
    if (item.options && item.options.length > 0) {
      const optNames = item.options.map((opt: any) => opt.name).join(", ")
      observation = observation ? `${observation} | Adicionais: ${optNames}` : `Adicionais: ${optNames}`
    }
    return { productId: "", code: item.externalCode, name, price: item.unitPrice, quantity: item.quantity, observation, totalPrice: item.totalPrice }
  })
  // Determine payment status:
  // - "pending" if there is value to collect on delivery (cash) and no online
  //   payment was made.
  // - "paid" if iFood already collected the money online (prepaid).
  const paymentMethods: any[] = Array.isArray(order.payments?.methods) ? order.payments.methods : []
  const hasOnlinePaid = paymentMethods.some((m: any) => m?.type === "ONLINE" && m?.prepaid === true)
  const hasCashPending = paymentMethods.some((m: any) => m?.method === "CASH" && m?.prepaid === false)
  const isPendingPayment = hasCashPending || (order.payments?.pending || 0) > 0
  // sanity: if online payment was captured, don't mark pending just because cash
  // method is also listed.
  const paymentStatusFinal = hasOnlinePaid ? "paid" : isPendingPayment ? "pending" : "paid"
  // iFood order status is tracked by events; the order resource itself does
  // not expose a status field we can map 1:1 to Flow. The caller (poll or
  // webhook handler) passes the event code so we can decide the initial
  // Flow status.
  const code = eventCode || ""
  const initialStatus = (code === "PLC" || code === "PLACED") ? "pending" : "preparing"
  // iFood delivery.observations is the customer note for delivery (e.g. "leave
  // at the door"). Email and other metadata go elsewhere so they don't pollute
  // the order notes the merchant sees in the dashboard.
  const deliveryNotes = order.delivery?.observations || ""
  // Phone is stored on the Customer record. Caller should upsert the customer
  // before saving the order; we expose it via the mapped object for clarity.
  // Detect iFood payment method to map to a Flow value:
  //   - "cash"   : CASH OFFLINE (paying cash on delivery)
  //   - "card"   : CREDIT or DEBIT OFFLINE (paying with card on delivery)
  //   - "online" : any ONLINE (already paid online)
  const hasCash = paymentMethods.some((m: any) => m?.method === "CASH" && m?.prepaid === false)
  const hasCardOffline = paymentMethods.some(
    (m: any) => (m?.method === "CREDIT" || m?.method === "DEBIT") && m?.prepaid === false
  )
  const flowPaymentMethod = hasCash ? "cash" : hasCardOffline ? "card" : "online"
  // Cash on delivery: customer may ask for change. iFood exposes this on the
  // first cash method (cash.changeFor). 0 or null means the customer pays exact.
  const cashMethod = paymentMethods.find((m: any) => m?.method === "CASH" && m?.prepaid === false)
  const changeFor = cashMethod?.cash?.changeFor && cashMethod.cash.changeFor > 0
    ? cashMethod.cash.changeFor
    : null

  return {
    establishmentId,
    customerName: order.customer?.name || "Cliente iFood",
    customerPhone: order.customer?.phone?.number || "",
    customerAddress: order.orderType === "DELIVERY" && order.delivery?.deliveryAddress ? order.delivery.deliveryAddress.formattedAddress : null,
    orderType: order.orderType === "DELIVERY" ? "delivery" : "pickup",
    paymentMethod: flowPaymentMethod,
    items: JSON.stringify(items),
    total: order.total?.orderAmount || 0,
    deliveryFee: order.total?.deliveryFee || 0,
    notes: deliveryNotes,
    externalDisplayId: order.displayId || null,
    ifoodDeliveryBy: order.delivery?.deliveredBy || null,
    changeFor,
    status: initialStatus,
    paymentStatus: paymentStatusFinal,
    method: "ifood",
  }
}
