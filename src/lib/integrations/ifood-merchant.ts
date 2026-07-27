import https from "https"

/**
 * Fetches the merchant configuration from iFood to know whether the
 * merchant uses STORE (iFood delivery) or MERCHANT (own delivery) logistics.
 * Cached for 1 hour to avoid hammering the API.
 */

interface MerchantInfo {
  id: string
  type: "STORE" | "MERCHANT" | string
}

let cache: { value: MerchantInfo | null; at: number } | null = null
const TTL_MS = 60 * 60 * 1000 // 1 hour

function fetchMerchant(merchantId: string, token: string): Promise<MerchantInfo> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "merchant-api.ifood.com.br",
      path: `/merchant/v1.0/merchants/${merchantId}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        MerchantId: merchantId,
      },
    }
    const req = https.request(options, (res) => {
      let body = ""
      res.on("data", (c) => (body += c))
      res.on("end", () => {
        try {
          resolve(JSON.parse(body))
        } catch (e) {
          reject(new Error("invalid json: " + body))
        }
      })
    })
    req.on("error", reject)
    req.end()
  })
}

export async function getMerchantType(
  merchantId: string,
  token: string
): Promise<"STORE" | "MERCHANT" | string> {
  if (cache && Date.now() - cache.at < TTL_MS && cache.value?.id === merchantId) {
    return cache.value.type
  }
  try {
    const m = await fetchMerchant(merchantId, token)
    cache = { value: m, at: Date.now() }
    return m.type
  } catch {
    return "STORE" // default fallback: assume iFood delivery
  }
}
