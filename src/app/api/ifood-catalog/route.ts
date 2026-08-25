import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getIfoodAuth } from "@/lib/integrations/ifood"
import { verifyAuth } from "@/lib/auth"
import https from "https"

interface IfoodOptionGroup {
  id: string
  name: string
  min: number
  max: number
  options: {
    id: string
    name: string
    description?: string
    price: { value: number }
    status: string
  }[]
}

interface IfoodItem {
  id: string
  name: string
  description?: string
  price: number
  originalPrice: number
  status: string
  imagePath?: string | null
  optionGroups?: IfoodOptionGroup[]
}

interface IfoodCategory {
  categoryId: string
  name: string
  items: IfoodItem[]
}

function httpsGet(path: string, token: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "merchant-api.ifood.com.br",
      path,
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept-Encoding": "identity",
      },
    }

    const req = https.request(options, (res) => {
      let body = ""
      res.on("data", (chunk) => (body += chunk))
      res.on("end", () => resolve({ status: res.statusCode || 0, body }))
    })

    req.on("error", reject)
    req.end()
  })
}

async function fetchProduct(merchantId: string, productId: string, token: string): Promise<any> {
  const res = await httpsGet(
    `/catalog/v2.0/merchants/${merchantId}/product/${productId}`,
    token
  )
  if (res.status === 200) {
    try {
      return JSON.parse(res.body)
    } catch {}
  }
  return null
}

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
}

function findCategoryMatch(
  ifoodName: string,
  existingCategories: { id: string; name: string }[]
): { id: string; name: string } | null {
  const normalized = normalizeString(ifoodName)

  // 1. Exact match (case-insensitive, accent-insensitive)
  const exact = existingCategories.find(
    (ec) => normalizeString(ec.name) === normalized
  )
  if (exact) return exact

  // 2. iFood name contains existing name or vice versa
  const contains = existingCategories.find((ec) => {
    const ecNorm = normalizeString(ec.name)
    return normalized.includes(ecNorm) || ecNorm.includes(normalized)
  })
  if (contains) return contains

  // 3. Single word match (e.g., "Picole" matches "Picolés")
  const ifoodWords = normalized.split(/\s+/)
  const wordMatch = existingCategories.find((ec) => {
    const ecNorm = normalizeString(ec.name)
    const ecWords = ecNorm.split(/\s+/)
    return ifoodWords.some((w) => ecWords.some((ew) => ew === w || ew.includes(w) || w.includes(ew)))
  })
  if (wordMatch) return wordMatch

  return null
}

async function fetchIfoodCatalog(merchantId: string, token: string): Promise<{ categories: IfoodCategory[] }> {
  console.log("[ifood-catalog] Step 1: Fetching catalogs")
  const catalogsRes = await httpsGet(
    `/catalog/v2.0/merchants/${merchantId}/catalogs`,
    token
  )

  if (catalogsRes.status !== 200) {
    throw new Error(`iFood catalogs API error: ${catalogsRes.status} - ${catalogsRes.body.slice(0, 300)}`)
  }

  const catalogs = JSON.parse(catalogsRes.body)
  if (!Array.isArray(catalogs) || catalogs.length === 0) {
    return { categories: [] }
  }

  const allCategories: IfoodCategory[] = []

  for (const catalog of catalogs) {
    const catalogId = catalog.catalogId

    const catRes = await httpsGet(
      `/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories`,
      token
    )

    if (catRes.status !== 200) continue

    const categoriesData = JSON.parse(catRes.body)
    if (!Array.isArray(categoriesData)) continue

    for (const cat of categoriesData) {
      const catId = cat.id || cat.categoryId
      const catName = cat.name

      const itemsRes = await httpsGet(
        `/catalog/v2.0/merchants/${merchantId}/categories/${catId}/items`,
        token
      )

      let rawItems: any[] = []
      if (itemsRes.status === 200) {
        try {
          const itemsData = JSON.parse(itemsRes.body)
          if (Array.isArray(itemsData)) {
            rawItems = itemsData
          } else if (itemsData.items && Array.isArray(itemsData.items)) {
            rawItems = itemsData.items
          }
        } catch {}
      }

      const productIds = [...new Set(rawItems.map((item: any) => item.productId).filter(Boolean))]

      const productMap = new Map<string, any>()
      for (const pid of productIds) {
        const product = await fetchProduct(merchantId, pid, token)
        if (product) {
          productMap.set(pid, product)
        }
      }

      allCategories.push({
        categoryId: catId,
        name: catName,
        items: rawItems.map((item: any) => {
          const product = productMap.get(item.productId) || {}

          const name = product.name || item.name || ""
          const description = product.description || item.description || ""
          const imagePath = product.image || product.imagePath || item.imagePath || null

          let price = 0
          let originalPrice = 0
          const ctxMod = item.contextModifiers?.[0]
          if (ctxMod?.price?.value) {
            price = ctxMod.price.value
            originalPrice = ctxMod.price.originalValue || ctxMod.price.value
          } else if (item.price && typeof item.price === "object") {
            price = item.price.value || 0
            originalPrice = item.price.originalValue || item.price.value || 0
          } else if (typeof item.price === "number") {
            price = item.price
            originalPrice = item.price
          }

          return {
            id: item.id || "",
            name,
            description,
            price,
            originalPrice,
            status: item.status || "AVAILABLE",
            imagePath,
            optionGroups: product.optionGroups || item.optionGroups || [],
          }
        }),
      })
    }
  }

  return { categories: allCategories }
}

export async function GET(req: NextRequest) {
  try {
    const auth = verifyAuth(req)
    if (!auth) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const establishment = await prisma.establishment.findUnique({
      where: { id: auth.establishmentId },
      select: { ifoodMerchantId: true, ifoodEnabled: true },
    })

    if (!establishment?.ifoodEnabled || !establishment?.ifoodMerchantId) {
      return NextResponse.json(
        { error: "iFood não configurado neste estabelecimento" },
        { status: 400 }
      )
    }

    const ifoodAuth = await getIfoodAuth(
      process.env.IFOOD_CLIENT_ID!,
      process.env.IFOOD_CLIENT_SECRET!
    )

    if (!ifoodAuth?.accessToken) {
      return NextResponse.json(
        { error: "Falha na autenticação com iFood" },
        { status: 502 }
      )
    }

    const { categories } = await fetchIfoodCatalog(
      establishment.ifoodMerchantId,
      ifoodAuth.accessToken
    )

    const existingCategories = await prisma.category.findMany({
      where: { establishmentId: auth.establishmentId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })

    const mappedCategories = categories.map((cat) => {
      const match = findCategoryMatch(cat.name, existingCategories)
      return {
        ifoodCategoryId: cat.categoryId,
        ifoodName: cat.name,
        itemCount: cat.items?.length || 0,
        items: (cat.items || []).map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description || "",
          price: item.price || 0,
          originalPrice: item.originalPrice || item.price || 0,
          status: item.status,
          imagePath: item.imagePath || null,
          hasPromotion: (item.originalPrice || 0) > (item.price || 0) && item.originalPrice > 0,
          optionGroups: (item.optionGroups || []).map((og: any) => ({
            id: og.id,
            name: og.name,
            min: og.min || 0,
            max: og.max || 0,
            options: (og.options || []).map((opt: any) => ({
              id: opt.id,
              name: opt.name,
              description: opt.description || "",
              price: opt.price?.value || 0,
              status: opt.status || "AVAILABLE",
            })),
          })),
        })),
        mappedCategoryId: match?.id || null,
        mappedCategoryName: match?.name || null,
      }
    })

    return NextResponse.json({
      categories: mappedCategories,
      existingCategories,
      totalItems: categories.reduce((sum, cat) => sum + (cat.items?.length || 0), 0),
    })
  } catch (error: any) {
    console.error("[ifood-catalog] error:", error.message)
    return NextResponse.json(
      { error: `Erro ao buscar catálogo do iFood: ${error.message}` },
      { status: 500 }
    )
  }
}
