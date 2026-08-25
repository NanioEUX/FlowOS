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

async function fetchIfoodCatalog(merchantId: string, token: string): Promise<IfoodCategory[]> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "merchant-api.ifood.com.br",
      path: `/catalog/v2.0/merchants/${merchantId}/categories?include_items=true`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }

    const req = https.request(options, (res) => {
      let body = ""
      res.on("data", (chunk) => (body += chunk))
      res.on("end", () => {
        try {
          if (res.statusCode === 200) {
            const data = JSON.parse(body)
            resolve(data)
          } else {
            reject(new Error(`iFood API error: ${res.statusCode} - ${body}`))
          }
        } catch (e) {
          reject(new Error(`Failed to parse iFood response: ${body}`))
        }
      })
    })

    req.on("error", reject)
    req.end()
  })
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
    return NextResponse.json(
      { error: "Erro ao buscar catálogo do iFood" },
      { status: 500 }
    )
  }
}
