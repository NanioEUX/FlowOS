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
  // Step 1: Get catalogs
  console.log("[ifood-catalog] Step 1: Fetching catalogs")
  const catalogsRes = await httpsGet(
    `/catalog/v2.0/merchants/${merchantId}/catalogs`,
    token
  )
  console.log("[ifood-catalog] Catalogs response:", catalogsRes.status, catalogsRes.body.slice(0, 500))

  if (catalogsRes.status !== 200) {
    throw new Error(`iFood catalogs API error: ${catalogsRes.status} - ${catalogsRes.body.slice(0, 300)}`)
  }

  const catalogs = JSON.parse(catalogsRes.body)
  if (!Array.isArray(catalogs) || catalogs.length === 0) {
    console.log("[ifood-catalog] No catalogs found")
    return []
  }

  console.log("[ifood-catalog] Found", catalogs.length, "catalogs")

  const allCategories: IfoodCategory[] = []

  // Step 2: For each catalog, get categories with items
  for (const catalog of catalogs) {
    const catalogId = catalog.catalogId
    console.log("[ifood-catalog] Step 2: Fetching categories for catalog:", catalogId)

    const catRes = await httpsGet(
      `/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories?include_items=true`,
      token
    )
    console.log("[ifood-catalog] Categories response:", catRes.status, catRes.body.slice(0, 500))

    if (catRes.status !== 200) {
      console.log("[ifood-catalog] Failed to fetch categories for catalog:", catalogId)
      continue
    }

    const categoriesData = JSON.parse(catRes.body)
    if (!Array.isArray(categoriesData)) {
      console.log("[ifood-catalog] Categories is not an array for catalog:", catalogId)
      continue
    }

    console.log("[ifood-catalog] Found", categoriesData.length, "categories in catalog", catalogId)

    for (const cat of categoriesData) {
      const catId = cat.id || cat.categoryId
      const catName = cat.name
      const items = cat.items || []

      console.log("[ifood-catalog] Category", catName, "has", items.length, "items")

      allCategories.push({
        categoryId: catId,
        name: catName,
        items: items.map((item: any) => ({
          id: item.id || "",
          name: item.name || "",
          description: item.description || "",
          price: item.price || { value: 0 },
          status: item.status || "AVAILABLE",
          imagePath: item.imagePath || null,
          optionGroups: item.optionGroups || [],
        })),
      })
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
