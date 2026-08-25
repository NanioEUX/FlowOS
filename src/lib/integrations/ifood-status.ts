import https from "https"

/**
 * Maps a Flow action to the iFood endpoint path suffix.
 *
 * iFood order lifecycle (current API):
 *   PLC (placed)        -> in "Aceitar" tab, awaiting acceptance
 *   CFM (confirmed)     -> in "Em preparo" tab after /confirm
 *   DSP (dispatched)    -> in "Em rota" tab after /dispatch
 *   CON (concluded)     -> automatic after dispatch OR handshake
 *
 * Endpoints:
 *   /confirm           - Confirm order (202)
 *   /startPreparation  - Start preparation (optional, 202)
 *   /readyToPickup     - Ready for pickup / delivery (202)
 *   /dispatch          - Dispatch for delivery (202)
 *   /handshake         - Delivery confirmation with customer code (200/204)
 *   /cancellation      - Request cancellation (requires body with reason)
 */
function pathForAction(action: string): string {
  switch (action) {
    case "confirm": return "/confirm"
    case "startPreparation": return "/startPreparation"
    case "readyForPickup": return "/readyToPickup"
    case "dispatch": return "/dispatch"
    case "handshake": return "/handshake"
    case "cancel": return "/cancellation"
    default: return ""
  }
}

function callEndpoint(action: string, token: string, merchantId: string, orderId: string, deliveredBy?: string): Promise<{ success: boolean; status?: number; body?: string }> {
  return new Promise((resolve) => {
    const suffix = pathForAction(action)
    if (!suffix) {
      resolve({ success: false, body: `unknown action: ${action}` })
      return
    }

    // readyToPickup and dispatch require deliveredBy; handshake requires handshakeCode
    let requestBody: any = {}
    if (action === "readyToPickup" || action === "dispatch") {
      requestBody.deliveredBy = deliveredBy || "MERCHANT"
    }
    if (action === "handshake" && deliveredBy) {
      requestBody.handshakeCode = deliveredBy
    }

    const body = JSON.stringify(requestBody)
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

export async function updateIfoodStatus(
  token: string,
  merchantId: string,
  orderId: string,
  action: string,
  deliveredBy?: string
): Promise<{ success: boolean; status?: number; body?: string; tried?: string[] }> {
  const tried: string[] = [action]
  let result = await callEndpoint(action, token, merchantId, orderId, deliveredBy)

  // Fallback: if /readyForPickup returns 404 (sandbox limitation), fall back to
  // /confirm (idempotent) so the order at least reaches CFM state.
  if (
    action === "readyForPickup" &&
    result.status === 404
  ) {
    tried.push("confirm")
    const fallback = await callEndpoint("confirm", token, merchantId, orderId)
    if (fallback.success) {
      return { ...fallback, tried }
    }
    result = fallback
  }

  return { ...result, tried }
}

/**
 * Calls iFood /handshake endpoint to confirm delivery with customer code.
 * Only for MERCHANT delivery orders.
 * Returns { success, status, body } where:
 *   - 200/204 = code correct, order CONCLUDED
 *   - 400/422 = incorrect code
 *   - 409 = already concluded or invalid state
 */
export async function ifoodHandshake(
  token: string,
  merchantId: string,
  orderId: string,
  handshakeCode: string
): Promise<{ success: boolean; status?: number; body?: string }> {
  return new Promise((resolve) => {
    const body = JSON.stringify({ handshakeCode })
    const options = {
      hostname: "merchant-api.ifood.com.br",
      path: `/order/v1.0/orders/${orderId}/handshake`,
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
          success: res.statusCode === 200 || res.statusCode === 204,
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
