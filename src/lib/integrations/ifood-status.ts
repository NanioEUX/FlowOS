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
 * NOTE: iFood sandbox only exposes /confirm and /dispatch reliably.
 * /conclude (or /deliver depending on docs version) is the canonical endpoint
 * for marking an order as delivered, but the sandbox does NOT expose it
 * for the standard test merchant — every variation returns 404. In
 * production (real merchant account), /conclude (POST) is the documented
 * endpoint and works. The dispatcher falls back to "do nothing" so the
 * order stays in "delivered" locally even when iFood does not acknowledge
 * the state change.
 *
 * We log the response so callers can decide whether to retry or alert.
 */
function pathForAction(action: string): string {
  switch (action) {
    case "confirm": return "/confirm"
    case "readyForPickup": return "/readyForPickup"
    case "dispatch": return "/dispatch"
    case "deliver": return "/conclude"  // iFood's canonical finish endpoint
    case "cancel": return "/cancellation"
    default: return ""
  }
}

function callEndpoint(action: string, token: string, merchantId: string, orderId: string): Promise<{ success: boolean; status?: number; body?: string }> {
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

export async function updateIfoodStatus(
  token: string,
  merchantId: string,
  orderId: string,
  action: string
): Promise<{ success: boolean; status?: number; body?: string; tried?: string[] }> {
  const tried: string[] = [action]
  let result = await callEndpoint(action, token, merchantId, orderId)

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
