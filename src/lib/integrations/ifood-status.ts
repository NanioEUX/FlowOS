import https from "https"

function pathForAction(action: string): string {
  // Map a Flow action to the iFood endpoint path suffix.
  switch (action) {
    case "confirm": return "/confirm"
    case "dispatch": return "/dispatch"
    case "deliver": return "/deliver"
    case "cancel": return "/cancellation"
    case "ready": return "/ready" // fallback: not always available
    default: return ""
  }
}

export function updateIfoodStatus(
  token: string,
  merchantId: string,
  orderId: string,
  action: string
): Promise<{ success: boolean; status?: number; body?: string }> {
  return new Promise((resolve) => {
    const suffix = pathForAction(action)
    if (!suffix) {
      resolve({ success: false, body: `unknown action: ${action}` })
      return
    }

    const body = JSON.stringify({})
    const options = {
      hostname: "merchant-api.ifood.com.br",
      path: `/order/v1.0/orders/${orderId}${suffix}`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        MerchantId: merchantId,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    }

    const req = https.request(options, (res) => {
      let b = ""
      res.on("data", (c) => (b += c))
      res.on("end", () => {
        resolve({
          success: res.statusCode === 200 || res.statusCode === 202 || res.statusCode === 204,
          status: res.statusCode,
          body: b
        })
      })
    })
    req.on("error", (e) => resolve({ success: false, body: e.message }))
    req.write(body)
    req.end()
  })
}
