import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getIfoodAuth } from "@/lib/integrations/ifood"
import { verifyAuth } from "@/lib/auth"
import https from "https"

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

  const exact = existingCategories.find(
    (ec) => normalizeString(ec.name) === normalized
  )
  if (exact) return exact

  const contains = existingCategories.find((ec) => {
    const ecNorm = normalizeString(ec.name)
    return normalized.includes(ecNorm) || ecNorm.includes(normalized)
  })
  if (contains) return contains

  const ifoodWords = normalized.split(/\s+/)
  const wordMatch = existingCategories.find((ec) => {
    const ecNorm = normalizeString(ec.name)
    const ecWords = ecNorm.split(/\s+/)
    return ifoodWords.some((w) => ecWords.some((ew) => ew === w || ew.includes(w) || w.includes(ew)))
  })
  if (wordMatch) return wordMatch

  return null
}

async function fetchIfoodCatalog(merchantId: string, token: string) {
  // Get catalogs
  const catalogsRes = await httpsGet(
    `/catalog/v2.0/merchants/${merchantId}/catalogs`,
    token
  )

  if (catalogsRes.status !== 200) {
    throw new Error(`iFood catalogs API error: ${catalogsRes.status} - ${catalogsRes.body.slice(0, 300)}`)
  }

  const catalogs = JSON.parse(catalogsRes.body)
  if (!Array.isArray(catalogs) || catalogs.length === 0) {
    return []
  }

  const allItems: any[] = []

  for (const catalog of catalogs) {
    const groupId = catalog.groupId

    const sellableRes = await httpsGet(
      `/catalog/v2.0/merchants/${merchantId}/catalogs/${groupId}/sellableItems`,
      token
    )

    if (sellableRes.status === 200) {
      try {
        const items = JSON.parse(sellableRes.body)
        if (Array.isArray(items)) {
          allItems.push(...items)
        }
      } catch {}
    }
  }

  return allItems
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

    const sellableItems = await fetchIfoodCatalog(
      establishment.ifoodMerchantId,
      ifoodAuth.accessToken
    )

    // Group items by category
    const categoryMap = new Map<string, any>()
    for (const item of sellableItems) {
      const catId = item.categoryId
      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, {
          categoryId: catId,
          name: item.categoryName || "Sem categoria",
          items: [],
        })
      }
      categoryMap.get(catId)!.items.push(item)
    }

    const existingCategories = await prisma.category.findMany({
      where: { establishmentId: auth.establishmentId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })

    const categories = Array.from(categoryMap.values())
    let totalItems = 0

    const mappedCategories = categories.map((cat) => {
      const match = findCategoryMatch(cat.name, existingCategories)

      const mappedItems = cat.items.map((item: any) => {
        totalItems++
        const price = item.itemPrice?.value || 0
        const originalPrice = item.itemPrice?.originalValue || price

        // Build image URL
        const imagePath = item.logosUrls?.[0]
          ? `https://static-images.ifood.com.br/pratos/${item.logosUrls[0]}`
          : null

        // Map option groups
        const optionGroups = (item.itemOptionGroups || []).map((og: any) => ({
          id: og.optionGroupId,
          name: og.name,
          min: og.minQuantity || 0,
          max: og.maxQuantity || 0,
          options: (og.options || []).map((opt: any) => ({
            id: opt.optionId,
            name: opt.name,
            description: "",
            price: opt.price?.value || 0,
            status: "AVAILABLE",
          })),
        }))

        return {
          id: item.itemId,
          name: item.itemName || "",
          description: item.itemDescription || "",
          price,
          originalPrice,
          status: "AVAILABLE",
          imagePath,
          optionGroups,
          hasPromotion: originalPrice > price && originalPrice > 0,
        }
      })

      return {
        ifoodCategoryId: cat.categoryId,
        ifoodName: cat.name,
        itemCount: mappedItems.length,
        items: mappedItems,
        mappedCategoryId: match?.id || null,
        mappedCategoryName: match?.name || null,
      }
    })

    return NextResponse.json({
      categories: mappedCategories,
      existingCategories,
      totalItems,
    })
  } catch (error: any) {
    console.error("[ifood-catalog] error:", error.message)
    return NextResponse.json(
      { error: `Erro ao buscar catálogo do iFood: ${error.message}` },
      { status: 500 }
    )
  }
}
