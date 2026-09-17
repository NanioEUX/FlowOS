import https from "https"

const IFOOD_API = "merchant-api.ifood.com.br"

// --- HTTP helper with retry + exponential backoff ---
async function httpsRequest(
  method: string,
  path: string,
  token: string,
  body?: any,
  retries = 2
): Promise<{ status: number; body: string }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const result = await new Promise<{ status: number; body: string }>((resolve, reject) => {
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
      req.setTimeout(15000, () => { req.destroy(); reject(new Error("timeout")) })
      if (bodyStr) req.write(bodyStr)
      req.end()
    })

    if (result.status === 429 && attempt < retries) {
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500
      await new Promise((r) => setTimeout(r, delay))
      continue
    }
    return result
  }
  return { status: 429, body: "max retries exceeded" }
}

// ═══════════════════════════════════════════════════
// MERCHANT — Status e Interrupções
// ═══════════════════════════════════════════════════

/** GET /merchant/v1.0/merchants — listar lojas do token */
export async function listMerchants(token: string) {
  const result = await httpsRequest("GET", "/merchant/v1.0/merchants", token)
  return { success: result.status >= 200 && result.status < 300, status: result.status, data: JSON.parse(result.body || "[]") }
}

/** GET /merchant/v1.0/merchants/{mid}/status — status da loja */
export async function getMerchantStatus(token: string, merchantId: string) {
  const result = await httpsRequest("GET", `/merchant/v1.0/merchants/${merchantId}/status`, token)
  return { success: result.status >= 200 && result.status < 300, status: result.status, data: JSON.parse(result.body || "{}") }
}

/** GET /merchant/v1.0/merchants/{mid}/interruptions — listar pausas */
export async function getInterruptions(token: string, merchantId: string) {
  const result = await httpsRequest("GET", `/merchant/v1.0/merchants/${merchantId}/interruptions`, token)
  return { success: result.status >= 200 && result.status < 300, status: result.status, data: JSON.parse(result.body || "[]") }
}

/** POST /merchant/v1.0/merchants/{mid}/interruptions — criar pausa */
export async function createInterruption(
  token: string,
  merchantId: string,
  startDateTime: string,
  endDateTime: string,
  description: string
) {
  const result = await httpsRequest("POST", `/merchant/v1.0/merchants/${merchantId}/interruptions`, token, {
    startDateTime,
    endDateTime,
    description,
  })
  return { success: result.status >= 200 && result.status < 300, status: result.status, data: JSON.parse(result.body || "{}") }
}

/** DELETE /merchant/v1.0/merchants/{mid}/interruptions/{iid} — remover pausa */
export async function deleteInterruption(token: string, merchantId: string, interruptionId: string) {
  const result = await httpsRequest("DELETE", `/merchant/v1.0/merchants/${merchantId}/interruptions/${interruptionId}`, token)
  return { success: result.status >= 200 && result.status < 300, status: result.status, body: result.body }
}

// ═══════════════════════════════════════════════════
// CATALOG — Leitura
// ═══════════════════════════════════════════════════

/** GET /catalog/v2.0/merchants/{mid}/catalogs — listar catálogos */
export async function listCatalogs(token: string, merchantId: string) {
  const result = await httpsRequest("GET", `/catalog/v2.0/merchants/${merchantId}/catalogs`, token)
  return { success: result.status >= 200 && result.status < 300, status: result.status, data: JSON.parse(result.body || "[]") }
}

/** GET /catalog/v2.0/merchants/{mid}/categories?include_items=true — listar categorias com itens */
export async function listCategories(token: string, merchantId: string) {
  const result = await httpsRequest("GET", `/catalog/v2.0/merchants/${merchantId}/categories?include_items=true`, token)
  return { success: result.status >= 200 && result.status < 300, status: result.status, data: JSON.parse(result.body || "[]") }
}

// ═══════════════════════════════════════════════════
// CATALOG — Criar
// ═══════════════════════════════════════════════════

/** POST /catalog/v2.0/merchants/{mid}/catalogs/{catalogId}/categories — criar categoria */
export async function createCategory(
  token: string,
  merchantId: string,
  catalogId: string,
  name: string,
  template: string = "DEFAULT"
) {
  const result = await httpsRequest("POST", `/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories`, token, {
    name,
    status: "AVAILABLE",
    template,
  })
  return { success: result.status >= 200 && result.status < 300, status: result.status, data: JSON.parse(result.body || "{}") }
}

/** PUT /catalog/v2.0/merchants/{mid}/items — criar ou atualizar item completo */
export async function createOrUpdateItem(
  token: string,
  merchantId: string,
  item: {
    id?: string
    categoryId: string
    status?: string
    price: number
    externalCode?: string
    productId?: string
  },
  products: Array<{
    id?: string
    name: string
    description?: string
    externalCode?: string
    imagePath?: string
  }>,
  optionGroups: Array<{
    id?: string
    name: string
    status?: string
    optionGroupType?: string
    optionIds?: string[]
  }> = [],
  options: Array<{
    id: string
    productId: string
    status?: string
    price: { value: number }
    externalCode?: string
  }> = []
) {
  const body = {
    item: {
      id: item.id,
      type: "DEFAULT",
      categoryId: item.categoryId,
      status: item.status || "AVAILABLE",
      price: { value: item.price },
      ...(item.productId ? { productId: item.productId } : {}),
      ...(item.externalCode ? { externalCode: item.externalCode } : {}),
    },
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      ...(p.description ? { description: p.description } : {}),
      ...(p.externalCode ? { externalCode: p.externalCode } : {}),
      ...(p.imagePath ? { imagePath: p.imagePath } : {}),
    })),
    optionGroups: optionGroups.map((og) => ({
      id: og.id,
      name: og.name,
      status: og.status || "AVAILABLE",
      ...(og.optionGroupType ? { optionGroupType: og.optionGroupType } : {}),
      optionIds: og.optionIds || [],
    })),
    options,
  }

  console.log("[ifood-catalog-write] PUT items body:", JSON.stringify(body, null, 2))
  const result = await httpsRequest("PUT", `/catalog/v2.0/merchants/${merchantId}/items`, token, body)
  const parsedBody = JSON.parse(result.body || "{}")
  if (parsedBody?.error?.details) {
    console.error("[ifood-catalog-write] VALIDATION DETAILS:", JSON.stringify(parsedBody.error.details, null, 2))
  }
  console.log("[ifood-catalog-write] PUT items response:", result.status, result.body.slice(0, 500))
  return { success: result.status >= 200 && result.status < 300, status: result.status, data: parsedBody }
}

// ═══════════════════════════════════════════════════
// CATALOG — Atualizar (endpoints oficiais)
// ═══════════════════════════════════════════════════

/** PATCH /catalog/v2.0/merchants/{mid}/items/price — atualizar preço */
export async function updateItemPrice(
  token: string,
  merchantId: string,
  itemId: string,
  newPrice: number
): Promise<{ success: boolean; status: number; body: string }> {
  const path = `/catalog/v2.0/merchants/${merchantId}/items/price`
  const result = await httpsRequest("PATCH", path, token, {
    itemId,
    price: { value: newPrice },
  })
  return { success: result.status >= 200 && result.status < 300, status: result.status, body: result.body }
}

/** PATCH /catalog/v2.0/merchants/{mid}/items/status — atualizar status */
export async function updateItemStatus(
  token: string,
  merchantId: string,
  itemId: string,
  status: "AVAILABLE" | "UNAVAILABLE"
): Promise<{ success: boolean; status: number; body: string }> {
  const path = `/catalog/v2.0/merchants/${merchantId}/items/status`
  const result = await httpsRequest("PATCH", path, token, {
    itemId,
    status,
  })
  return { success: result.status >= 200 && result.status < 300, status: result.status, body: result.body }
}

/** PATCH /catalog/v2.0/merchants/{mid}/options/price — atualizar preço de opção */
export async function updateOptionPrice(
  token: string,
  merchantId: string,
  optionId: string,
  newPrice: number
): Promise<{ success: boolean; status: number; body: string }> {
  const path = `/catalog/v2.0/merchants/${merchantId}/options/price`
  const result = await httpsRequest("PATCH", path, token, {
    optionId,
    price: { value: newPrice },
  })
  return { success: result.status >= 200 && result.status < 300, status: result.status, body: result.body }
}

/** PATCH /catalog/v2.0/merchants/{mid}/options/status — atualizar status de opção */
export async function updateOptionStatus(
  token: string,
  merchantId: string,
  optionId: string,
  status: "AVAILABLE" | "UNAVAILABLE"
): Promise<{ success: boolean; status: number; body: string }> {
  const path = `/catalog/v2.0/merchants/${merchantId}/options/status`
  const result = await httpsRequest("PATCH", path, token, {
    optionId,
    status,
  })
  return { success: result.status >= 200 && result.status < 300, status: result.status, body: result.body }
}

// ═══════════════════════════════════════════════════
// CATALOG — Batch (endpoints oficiais)
// ═══════════════════════════════════════════════════

/** PATCH /catalog/v2.0/merchants/{mid}/products/price — batch preço */
export async function batchUpdatePrices(
  token: string,
  merchantId: string,
  updates: Array<{ externalCode: string; price: number }>
): Promise<{ success: boolean; batchId?: string; status: number; body: string }> {
  const path = `/catalog/v2.0/merchants/${merchantId}/products/price`
  const body = updates.map((u) => ({
    externalCode: u.externalCode,
    price: { value: u.price },
    resources: ["ITEM"],
  }))
  const result = await httpsRequest("PATCH", path, token, body)
  const data = JSON.parse(result.body || "{}")
  return {
    success: result.status >= 200 && result.status < 300,
    batchId: data.batchId,
    status: result.status,
    body: result.body,
  }
}

/** PATCH /catalog/v2.0/merchants/{mid}/products/status — batch status */
export async function batchUpdateStatuses(
  token: string,
  merchantId: string,
  updates: Array<{ externalCode: string; status: "AVAILABLE" | "UNAVAILABLE" }>
): Promise<{ success: boolean; batchId?: string; status: number; body: string }> {
  const path = `/catalog/v2.0/merchants/${merchantId}/products/status`
  const body = updates.map((u) => ({
    externalCode: u.externalCode,
    status: u.status,
    resources: ["ITEM"],
  }))
  const result = await httpsRequest("PATCH", path, token, body)
  const data = JSON.parse(result.body || "{}")
  return {
    success: result.status >= 200 && result.status < 300,
    batchId: data.batchId,
    status: result.status,
    body: result.body,
  }
}

/** GET /catalog/v2.0/merchants/{mid}/batch/{batchId} — checar status do batch */
export async function getBatchStatus(
  token: string,
  merchantId: string,
  batchId: string
): Promise<{ success: boolean; status: number; data: any }> {
  const result = await httpsRequest("GET", `/catalog/v2.0/merchants/${merchantId}/batch/${batchId}`, token)
  return { success: result.status >= 200 && result.status < 300, status: result.status, data: JSON.parse(result.body || "{}") }
}

// ═══════════════════════════════════════════════════
// MERCHANT — Horários
// ═══════════════════════════════════════════════════

/** PUT /merchant/v1.0/merchants/{mid}/opening-hours — configurar horários */
export async function updateMerchantHours(
  token: string,
  merchantId: string,
  operatingHours: any[]
): Promise<{ success: boolean; status: number; body: string }> {
  const path = `/merchant/v1.0/merchants/${merchantId}/opening-hours`
  const result = await httpsRequest("PUT", path, token, operatingHours)
  return { success: result.status >= 200 && result.status < 300, status: result.status, body: result.body }
}
