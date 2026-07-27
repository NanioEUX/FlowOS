import https from "https"

/**
 * Maps a Flow action to the iFood endpoint path suffix.
 *
 * iFood order lifecycle:
 *   PLC (placed)        -> in "Aceitar" tab, awaiting acceptance
 *   CFM (confirmed)     -> in "Em preparo" tab after confirmation via /confirm
 *   DSP (dispatched)    -> in "Em rota" tab after /dispatch
 *   CON (concluded)     -> in "Finalizados" tab after /deliver
 *
 * NOTE: iFood sandbox only exposes /confirm and /dispatch. /deliver,
 * /ready, /preparation and /cancellation may return 404 in sandbox but
 * are expected to work in production. We log the response so callers can
 * decide whether to retry or alert.
 */
function pathForAction(action: string): string {
  switch (action) {
    case "confirm": return "/confirm"
    case "dispatch": return "/dispatch"
    case "deliver": return "/deliver"
    case "cancel": return "/cancellation"
    case "ready": return "/ready" // not always available; falls back to no-op
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
