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
  listCatalogs,
} from "@/lib/integrations/ifood-catalog-write"
import crypto from "crypto"

/**
 * Generate a deterministic UUID v4 from a cuid string.
 * iFood API requires UUID v4 format for all IDs.
 */
function cuidToUUIDv4(cuid: string): string {
  const hash = crypto.createHash("sha256").update(cuid).digest("hex")
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16),
    ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.slice(18, 20),
    hash.slice(20, 32),
  ].join("-")
}

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

    // Get the default catalog ID (required for creating categories)
    const catalogsResult = await listCatalogs(token, mid)
    if (!catalogsResult.success || !catalogsResult.data || catalogsResult.data.length === 0) {
      return NextResponse.json(
        { error: "Nenhum catálogo encontrado no iFood. Crie um catálogo no iFood primeiro." },
        { status: 400 }
      )
    }
    const catalogId = catalogsResult.data[0].catalogId || catalogsResult.data[0].id
    console.log("[ifood-catalog-push] using catalogId:", catalogId)

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
          const catResult = await createCategory(token, mid, catalogId, category.name)
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
            // iFood requires UUID v4 for item/product IDs
            const itemId = product.ifoodItemId || cuidToUUIDv4(product.id)
            const productId = product.ifoodProductId || cuidToUUIDv4(`prod_${product.id}`)

            // Build option groups and options from additionalOptions
            const optionGroupsMap = new Map<string, Array<{ id: string; name: string; price: number }>>()
            for (const opt of product.additionalOptions) {
              const groupName = opt.groupName || "Adicionais"
              if (!optionGroupsMap.has(groupName)) {
                optionGroupsMap.set(groupName, [])
              }
              optionGroupsMap.get(groupName)!.push({
                id: cuidToUUIDv4(opt.id),
                name: opt.name,
                price: opt.price || 0,
              })
            }

            const hasOptions = optionGroupsMap.size > 0

            // Build optionGroups, options, and extra products per iFood API spec
            const optionGroups: any[] = []
            const optionsList: any[] = []
            const extraProducts: any[] = []

            // Main product with optionGroups reference (if has complements)
            const mainProduct: any = {
              id: productId,
              name: product.name,
              description: product.description || undefined,
              externalCode,
              imagePath: product.image || undefined,
            }

            if (hasOptions) {
              const productOptionGroupRefs: any[] = []

              for (const [groupName, opts] of optionGroupsMap.entries()) {
                const groupId = cuidToUUIDv4(`grp_${groupName}_${product.id}`)
                const optionIds: string[] = []

                for (const opt of opts) {
                  const optId = cuidToUUIDv4(opt.id)
                  optionIds.push(optId)

                  // Each option needs its own product
                  const optProductId = cuidToUUIDv4(`optprod_${opt.id}`)
                  extraProducts.push({
                    id: optProductId,
                    name: opt.name,
                  })

                  optionsList.push({
                    id: optId,
                    productId: optProductId,
                    status: "AVAILABLE",
                    price: { value: opt.price },
                  })
                }

                // Reference in main product
                productOptionGroupRefs.push({
                  id: groupId,
                  min: 0,
                  max: opts.length,
                })

                // Top-level optionGroup
                optionGroups.push({
                  id: groupId,
                  name: groupName,
                  status: "AVAILABLE",
                  optionGroupType: "OFFER_UNIT",
                  optionIds,
                })
              }

              mainProduct.optionGroups = productOptionGroupRefs
            }

            const allProducts = [mainProduct, ...extraProducts]

            const itemResult = await createOrUpdateItem(
              token,
              mid,
              {
                id: itemId,
                categoryId: ifoodCategoryId!,
                status: product.isAvailable ? "AVAILABLE" : "UNAVAILABLE",
                price: product.promoPrice && product.onSale ? product.promoPrice : product.price,
                externalCode,
                productId,
              },
              allProducts,
              optionGroups,
              optionsList
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
              const errMsg = `Falha: ${itemResult.status} ${JSON.stringify(itemResult.data).slice(0, 300)}`
              console.error("[ifood-catalog-push] product create/update failed:", product.name, errMsg)
              console.error("[ifood-catalog-push] full iFood response:", JSON.stringify(itemResult))
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
