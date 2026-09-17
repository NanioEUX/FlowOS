import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getIfoodAuth } from "@/lib/integrations/ifood"
import { verifyAuth } from "@/lib/auth"
import {
  createCategory,
  createOrUpdateItem,
  batchUpdatePrices,
  batchUpdateStatuses,
  getBatchStatus,
} from "@/lib/integrations/ifood-catalog-write"

/**
 * POST /api/ifood-catalog/push
 *
 * Send local catalog TO iFood.
 * Body:
 *   - categoryIds?: string[] — specific categories to push (all syncToIfood if empty)
 *   - dryRun?: boolean — return what would be sent without actually sending
 */
export async function POST(req: NextRequest) {
  try {
    const auth = verifyAuth(req)
    if (!auth) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const establishment = await prisma.establishment.findUnique({
      where: { id: auth.establishmentId },
      select: {
        ifoodMerchantId: true,
        ifoodEnabled: true,
        name: true,
      },
    })

    if (!establishment?.ifoodEnabled || !establishment?.ifoodMerchantId) {
      return NextResponse.json(
        { error: "iFood não configurado neste estabelecimento" },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { categoryIds, dryRun } = body

    // Fetch all categories (we'll filter syncToIfood in code for null = true legacy)
    const whereCategories: any = {
      establishmentId: auth.establishmentId,
    }
    if (categoryIds && categoryIds.length > 0) {
      whereCategories.id = { in: categoryIds }
    }

    const allCategories = await prisma.category.findMany({
      where: whereCategories,
      include: {
        products: {
          include: { additionalOptions: true },
        },
      },
      orderBy: { order: "asc" },
    })

    // Filter: syncToIfood = true OR null (legacy records)
    const categories = allCategories
      .filter((c) => c.syncToIfood !== false)
      .map((c) => ({
        ...c,
        products: c.products.filter((p: any) => p.syncToIfood !== false),
      }))

    if (categories.length === 0) {
      return NextResponse.json({
        message: "Nenhuma categoria para sincronizar",
        created: 0,
        updated: 0,
        errors: [],
      })
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

    const token = ifoodAuth.accessToken
    const mid = establishment.ifoodMerchantId

    console.log("[ifood-catalog-push] start:", {
      establishmentId: auth.establishmentId,
      merchantId: mid,
      categoriesFound: categories.length,
      categoryNames: categories.map((c) => c.name),
    })

    const results = {
      categoriesCreated: 0,
      categoriesUpdated: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      errors: [] as Array<{ entity: string; name: string; error: string }>,
    }

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        categories: categories.map((c) => ({
          name: c.name,
          ifoodCategoryId: c.ifoodCategoryId,
          products: c.products.map((p) => ({
            name: p.name,
            price: p.price,
            ifoodItemId: p.ifoodItemId,
            ifoodProductId: p.ifoodProductId,
            options: p.additionalOptions.length,
          })),
        })),
      })
    }

    // Process each category
    for (const category of categories) {
      try {
        let ifoodCategoryId = category.ifoodCategoryId
        console.log("[ifood-catalog-push] processing category:", category.name, "ifoodCategoryId:", ifoodCategoryId, "products:", category.products.length)

        // Create category on iFood if it doesn't have an ID yet
        if (!ifoodCategoryId) {
          const catResult = await createCategory(token, mid, category.name)
          console.log("[ifood-catalog-push] createCategory result:", catResult.status, catResult.data?.id || "no id")
          if (catResult.success && catResult.data?.id) {
            ifoodCategoryId = catResult.data.id
            await prisma.category.update({
              where: { id: category.id },
              data: { ifoodCategoryId },
            })
            results.categoriesCreated++
          } else {
            const errMsg = `Falha ao criar: ${catResult.status} ${catResult.data?.message || ""}`
            console.error("[ifood-catalog-push] category create failed:", category.name, errMsg, catResult)
            results.errors.push({
              entity: "category",
              name: category.name,
              error: errMsg,
            })
            continue // Skip products of this category
          }
        } else {
          results.categoriesUpdated++
        }

        // Process each product in this category
        for (const product of category.products) {
          try {
            const externalCode = `saas_${product.id.slice(0, 12)}`

            // Build option groups from additionalOptions
            const optionGroupsMap = new Map<string, any[]>()
            for (const opt of product.additionalOptions) {
              const groupName = opt.groupName || "Adicionais"
              if (!optionGroupsMap.has(groupName)) {
                optionGroupsMap.set(groupName, [])
              }
              optionGroupsMap.get(groupName)!.push({
                name: opt.name,
                price: opt.price || 0,
                externalCode: `saas_opt_${opt.id.slice(0, 12)}`,
                status: "AVAILABLE",
              })
            }

            const optionGroups = Array.from(optionGroupsMap.entries()).map(
              ([name, options]) => ({
                name,
                minQuantity: 0,
                maxQuantity: options.length,
                options,
              })
            )

            const itemResult = await createOrUpdateItem(
              token,
              mid,
              {
                id: product.ifoodItemId || undefined,
                categoryId: ifoodCategoryId!,
                status: product.isAvailable ? "AVAILABLE" : "UNAVAILABLE",
                price: product.promoPrice && product.onSale ? product.promoPrice : product.price,
                externalCode,
              },
              [
                {
                  id: product.ifoodProductId || undefined,
                  name: product.name,
                  description: product.description || undefined,
                  externalCode,
                },
              ],
              optionGroups
            )

            if (itemResult.success) {
              // Save iFood IDs back to local DB
              const updateData: any = {}
              if (itemResult.data?.itemId && !product.ifoodItemId) {
                updateData.ifoodItemId = itemResult.data.itemId
              }
              if (itemResult.data?.productId && !product.ifoodProductId) {
                updateData.ifoodProductId = itemResult.data.productId
              }
              if (Object.keys(updateData).length > 0) {
                await prisma.product.update({
                  where: { id: product.id },
                  data: updateData,
                })
              }
              results.itemsUpdated++
            } else {
              const errMsg = `Falha: ${itemResult.status} ${JSON.stringify(itemResult.data).slice(0, 100)}`
              console.error("[ifood-catalog-push] product create/update failed:", product.name, errMsg, itemResult)
              results.errors.push({
                entity: "product",
                name: product.name,
                error: errMsg,
              })
            }
          } catch (e: any) {
            console.error("[ifood-catalog-push] product exception:", product.name, e.message)
            results.errors.push({
              entity: "product",
              name: product.name,
              error: e.message,
            })
          }
        }
      } catch (e: any) {
        console.error("[ifood-catalog-push] category exception:", category.name, e.message)
        results.errors.push({
          entity: "category",
          name: category.name,
          error: e.message,
        })
      }
    }

    return NextResponse.json(results)
  } catch (error: any) {
    console.error("[ifood-catalog-push] error:", error.message)
    return NextResponse.json(
      { error: `Erro ao enviar cardápio: ${error.message}` },
      { status: 500 }
    )
  }
}
