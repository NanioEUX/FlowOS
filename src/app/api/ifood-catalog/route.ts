import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getIfoodAuth } from "@/lib/integrations/ifood"
import { verifyAuth } from "@/lib/auth"
import https from "https"

interface IfoodItem {
  id: string
  name: string
  description?: string
  price: { value: number; originalValue?: number }
  status: string
  imagePath?: string
  optionGroups?: any[]
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

async function fetchIfoodCatalog(merchantId: string, token: string): Promise<IfoodCategory[]> {
  // Try direct categories endpoint first
  console.log("[ifood-catalog] Trying /categories?include_items=true")
  const catRes = await httpsGet(
    `/catalog/v2.0/merchants/${merchantId}/categories?include_items=true`,
    token
  )
  console.log("[ifood-catalog] Categories response:", catRes.status, catRes.body.slice(0, 300))

  if (catRes.status === 200) {
    try {
      const data = JSON.parse(catRes.body)
      if (Array.isArray(data)) return data
    } catch {}
  }

  // Fallback: get catalogs first, then categories per catalog
  console.log("[ifood-catalog] Trying /catalogs first")
  const catalogsRes = await httpsGet(
    `/catalog/v2.0/merchants/${merchantId}/catalogs`,
    token
  )
  console.log("[ifood-catalog] Catalogs response:", catalogsRes.status, catalogsRes.body.slice(0, 300))

  if (catalogsRes.status !== 200) {
    throw new Error(`iFood catalog API error: ${catalogsRes.status} - ${catalogsRes.body.slice(0, 300)}`)
  }

  const catalogs = JSON.parse(catalogsRes.body)
  if (!Array.isArray(catalogs) || catalogs.length === 0) {
    console.log("[ifood-catalog] No catalogs found, returning empty")
    return []
  }

  const allCategories: IfoodCategory[] = []

  for (const catalog of catalogs) {
    const catalogId = catalog.catalogId
    console.log("[ifood-catalog] Fetching categories for catalog:", catalogId)

    const categoriesRes = await httpsGet(
      `/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories?include_items=true`,
      token
    )
    console.log("[ifood-catalog] Categories response:", categoriesRes.status, categoriesRes.body.slice(0, 300))

    if (categoriesRes.status === 200) {
      try {
        const cats = JSON.parse(categoriesRes.body)
        if (Array.isArray(cats)) {
          allCategories.push(...cats)
        }
      } catch {}
    }
  }

  return allCategories
}

export async function GET(req: NextRequest) {
  try {
    const auth = verifyAuth(req)
    if (!auth) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    console.log("[ifood-catalog] Authenticated, establishmentId:", auth.establishmentId)

    const establishment = await prisma.establishment.findUnique({
      where: { id: auth.establishmentId },
      select: { ifoodMerchantId: true, ifoodEnabled: true },
    })

    console.log("[ifood-catalog] Establishment:", {
      ifoodEnabled: establishment?.ifoodEnabled,
      ifoodMerchantId: establishment?.ifoodMerchantId,
    })

    if (!establishment?.ifoodEnabled || !establishment?.ifoodMerchantId) {
      return NextResponse.json(
        { error: "iFood não configurado neste estabelecimento" },
        { status: 400 }
      )
    }

    console.log("[ifood-catalog] Getting iFood auth...")
    const ifoodAuth = await getIfoodAuth(
      process.env.IFOOD_CLIENT_ID!,
      process.env.IFOOD_CLIENT_SECRET!
    )

    console.log("[ifood-catalog] iFood auth result:", ifoodAuth ? "success" : "failed")

    if (!ifoodAuth?.accessToken) {
      return NextResponse.json(
        { error: "Falha na autenticação com iFood" },
        { status: 502 }
      )
    }

    console.log("[ifood-catalog] Fetching catalog for merchant:", establishment.ifoodMerchantId)
    const categories = await fetchIfoodCatalog(
      establishment.ifoodMerchantId,
      ifoodAuth.accessToken
    )

    // Get existing categories for mapping
    const existingCategories = await prisma.category.findMany({
      where: { establishmentId: auth.establishmentId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })

    // Map categories and try to auto-match
    const mappedCategories = categories.map((cat) => {
      const existingMatch = existingCategories.find(
        (ec) => ec.name.toLowerCase() === cat.name.toLowerCase()
      )
      return {
        ifoodCategoryId: cat.categoryId,
        ifoodName: cat.name,
        itemCount: cat.items?.length || 0,
        items: (cat.items || []).map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description || "",
          price: item.price?.value || 0,
          originalPrice: item.price?.originalValue || item.price?.value || 0,
          status: item.status,
          imagePath: item.imagePath || null,
          hasPromotion: (item.price?.originalValue || 0) > (item.price?.value || 0),
          hasOptions: (item.optionGroups?.length || 0) > 0,
        })),
        mappedCategoryId: existingMatch?.id || null,
        mappedCategoryName: existingMatch?.name || null,
      }
    })

    return NextResponse.json({
      categories: mappedCategories,
      existingCategories,
      totalItems: categories.reduce((sum, cat) => sum + (cat.items?.length || 0), 0),
    })
  } catch (error: any) {
    console.error("[ifood-catalog] error:", error.message)
    console.error("[ifood-catalog] error stack:", error.stack)
    return NextResponse.json(
      { error: `Erro ao buscar catálogo do iFood: ${error.message}` },
      { status: 500 }
    )
  }
}
