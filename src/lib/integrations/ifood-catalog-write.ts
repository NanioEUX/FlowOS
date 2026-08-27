import https from "https"

const IFOOD_API = "merchant-api.ifood.com.br"

function httpsRequest(method: string, path: string, token: string, body?: any): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined
    const options: any = {
      hostname: IFOOD_API,
      path,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept-Encoding": "identity",
      },
    }
    if (bodyStr) {
      options.headers["Content-Length"] = Buffer.byteLength(bodyStr)
    }

    const req = https.request(options, (res) => {
      let data = ""
      res.on("data", (chunk) => (data += chunk))
      res.on("end", () => resolve({ status: res.statusCode || 0, body: data }))
    })
    req.on("error", reject)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

/**
 * Update item price on iFood catalog.
 * PATCH /catalog/v2.0/merchants/{merchantId}/catalogs/{groupId}/items/{itemId}
 */
export async function updateItemPrice(
  token: string,
  merchantId: string,
  groupId: string,
  itemId: string,
  newPrice: number
): Promise<{ success: boolean; status: number; body: string }> {
  const path = `/catalog/v2.0/merchants/${merchantId}/catalogs/${groupId}/items/${itemId}`
  const result = await httpsRequest("PATCH", path, token, {
    itemPrice: { value: newPrice },
  })
  return { success: result.status >= 200 && result.status < 300, status: result.status, body: result.body }
}

/**
 * Update item status (AVAILABLE / UNAVAILABLE) on iFood catalog.
 * PATCH /catalog/v2.0/merchants/{merchantId}/catalogs/{groupId}/items/{itemId}
 */
export async function updateItemStatus(
  token: string,
  merchantId: string,
  groupId: string,
  itemId: string,
  status: "AVAILABLE" | "UNAVAILABLE"
): Promise<{ success: boolean; status: number; body: string }> {
  const path = `/catalog/v2.0/merchants/${merchantId}/catalogs/${groupId}/items/${itemId}`
  const result = await httpsRequest("PATCH", path, token, { status })
  return { success: result.status >= 200 && result.status < 300, status: result.status, body: result.body }
}

/**
 * Update item description on iFood catalog.
 * PATCH /catalog/v2.0/merchants/{merchantId}/catalogs/{groupId}/items/{itemId}
 */
export async function updateItemDescription(
  token: string,
  merchantId: string,
  groupId: string,
  itemId: string,
  description: string
): Promise<{ success: boolean; status: number; body: string }> {
  const path = `/catalog/v2.0/merchants/${merchantId}/catalogs/${groupId}/items/${itemId}`
  const result = await httpsRequest("PATCH", path, token, {
    itemDescription: description,
  })
  return { success: result.status >= 200 && result.status < 300, status: result.status, body: result.body }
}

/**
 * Update option (add-on) price on iFood catalog.
 * PATCH /catalog/v2.0/merchants/{merchantId}/catalogs/{groupId}/items/{itemId}/options/{optionId}
 */
export async function updateOptionPrice(
  token: string,
  merchantId: string,
  groupId: string,
  itemId: string,
  optionId: string,
  newPrice: number
): Promise<{ success: boolean; status: number; body: string }> {
  const path = `/catalog/v2.0/merchants/${merchantId}/catalogs/${groupId}/items/${itemId}/options/${optionId}`
  const result = await httpsRequest("PATCH", path, token, {
    price: { value: newPrice },
  })
  return { success: result.status >= 200 && result.status < 300, status: result.status, body: result.body }
}

/**
 * Update merchant operating hours on iFood.
 * PATCH /merchant/v1.0/merchants/{merchantId}
 */
export async function updateMerchantHours(
  token: string,
  merchantId: string,
  operatingHours: any[]
): Promise<{ success: boolean; status: number; body: string }> {
  const path = `/merchant/v1.0/merchants/${merchantId}`
  const result = await httpsRequest("PATCH", path, token, {
    operatingHours,
  })
  return { success: result.status >= 200 && result.status < 300, status: result.status, body: result.body }
}

/**
 * Batch update: sync multiple item prices/statuses at once.
 * Returns results per item.
 */
export async function batchUpdateItems(
  token: string,
  merchantId: string,
  updates: Array<{
    groupId: string
    itemId: string
    price?: number
    status?: "AVAILABLE" | "UNAVAILABLE"
  }>
): Promise<Array<{ itemId: string; success: boolean; status: number; error?: string }>> {
  const results: Array<{ itemId: string; success: boolean; status: number; error?: string }> = []

  for (const update of updates) {
    try {
      const body: any = {}
      if (update.price !== undefined) body.itemPrice = { value: update.price }
      if (update.status) body.status = update.status

      if (Object.keys(body).length === 0) {
        results.push({ itemId: update.itemId, success: false, status: 0, error: "no fields to update" })
        continue
      }

      const path = `/catalog/v2.0/merchants/${merchantId}/catalogs/${update.groupId}/items/${update.itemId}`
      const result = await httpsRequest("PATCH", path, token, body)
      results.push({
        itemId: update.itemId,
        success: result.status >= 200 && result.status < 300,
        status: result.status,
        error: result.status >= 400 ? result.body.slice(0, 200) : undefined,
      })
    } catch (e: any) {
      results.push({ itemId: update.itemId, success: false, status: 0, error: e.message })
    }
  }

  return results
}
