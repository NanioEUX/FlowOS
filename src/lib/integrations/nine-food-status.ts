import https from "https"

/**
 * Maps a Flow action to the 99Food endpoint path.
 * Will be refined once we receive actual API documentation.
 */
function pathForAction(action: string): string {
  switch (action) {
    case "confirm": return "/orders/{orderId}/confirm"
    case "startPreparation": return "/orders/{orderId}/start-preparation"
    case "readyForPickup": return "/orders/{orderId}/ready"
    case "dispatch": return "/orders/{orderId}/dispatch"
    case "cancel": return "/orders/{orderId}/cancel"
    default: return ""
  }
}

/**
 * Call a 99Food API endpoint.
 * Will be refined once we receive actual API documentation.
 */
async function callEndpoint(
  action: string,
  token: string,
  orderId: string,
  body?: any
): Promise<{ success: boolean; status?: number; body?: string }> {
  return new Promise((resolve) => {
    const pathTemplate = pathForAction(action)
    if (!pathTemplate) {
      resolve({ success: false, body: `unknown action: ${action}` })
      return
    }

    const path = pathTemplate.replace("{orderId}", orderId)
    const requestBody = JSON.stringify(body || {})

    const options = {
      hostname: NINE_FOOD_API,
      path,
      method: "POST",
      headers: {
        "x-api-key": token,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(requestBody),
      },
    }

    const req = https.request(options, (res) => {
      let b = ""
      res.on("data", (c) => (b += c))
      res.on("end", () => {
        resolve({
          success: res.statusCode === 200 || res.statusCode === 202 || res.statusCode === 204,
          status: res.statusCode,
          body: b,
        })
      })
    })

    req.on("error", (e) => resolve({ success: false, body: e.message }))
    req.write(requestBody)
    req.end()
  })
}

/**
 * Update order status on 99Food.
 * Follows the same pattern as updateIfoodStatus.
 */
export async function update99FoodStatus(
  token: string,
  orderId: string,
  action: string,
  cancelReason?: string
): Promise<{ success: boolean; status?: number; body?: string; tried?: string[] }> {
  const tried: string[] = [action]

  const body = action === "cancel"
    ? { reason: cancelReason || "Pedido cancelado pelo estabelecimento" }
    : {}

  const result = await callEndpoint(action, token, orderId, body)

  // Fallback: if readyForPickup fails, try confirm (like iFood pattern)
  if (action === "readyForPickup" && !result.success) {
    tried.push("confirm")
    const fallback = await callEndpoint("confirm", token, orderId)
    if (fallback.success) {
      return { ...fallback, tried }
    }
  }

  return { ...result, tried }
}

const NINE_FOOD_API = "api-developer.99food.com"
