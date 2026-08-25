import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"
import https from "https"
import { createClient } from "@supabase/supabase-js"

interface ImportOption {
  id: string
  name: string
  description: string
  price: number
  status: string
}

interface ImportOptionGroup {
  id: string
  name: string
  min: number
  max: number
  options: ImportOption[]
}

interface ImportItem {
  id: string
  name: string
  description: string
  price: number
  originalPrice: number
  imagePath: string | null
  targetCategoryId: string
  ifoodCategoryName?: string
  optionGroups: ImportOptionGroup[]
}

async function downloadImage(url: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    https
      .get(url, { timeout: 10000 }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          https
            .get(res.headers.location!, { timeout: 10000 }, (res2) => {
              const chunks: Buffer[] = []
              res2.on("data", (chunk) => chunks.push(chunk))
              res2.on("end", () => resolve(Buffer.concat(chunks)))
              res2.on("error", () => resolve(null))
            })
            .on("error", () => resolve(null))
          return
        }
        const chunks: Buffer[] = []
        res.on("data", (chunk) => chunks.push(chunk))
        res.on("end", () => resolve(Buffer.concat(chunks)))
        res.on("error", () => resolve(null))
      })
      .on("error", () => resolve(null))
  })
}

export async function POST(req: NextRequest) {
  try {
    const auth = verifyAuth(req)
    if (!auth) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await req.json()
    const { items } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Nenhum item para importar" },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const results = {
      created: 0,
      optionsCreated: 0,
      imagesDownloaded: 0,
      imagesFailed: 0,
      errors: [] as string[],
    }

    for (const item of items) {
      try {
        let categoryId = item.targetCategoryId

        if (!categoryId) {
          const newCat = await prisma.category.create({
            data: {
              name: item.ifoodCategoryName || "Sem categoria",
              establishmentId: auth.establishmentId,
              order: 0,
            },
          })
          categoryId = newCat.id
        }

        let imageUrl: string | null = null
        if (item.imagePath) {
          try {
            const imageBuffer = await downloadImage(item.imagePath)
            if (imageBuffer && imageBuffer.length > 0 && imageBuffer.length < 5 * 1024 * 1024) {
              const fileName = `products/${auth.establishmentId}/${Date.now()}-${item.id.slice(0, 8)}.jpg`
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from("products")
                .upload(fileName, imageBuffer, {
                  contentType: "image/jpeg",
                })

              if (!uploadError && uploadData) {
                const { data: urlData } = supabase.storage
                  .from("products")
                  .getPublicUrl(uploadData.path)
                imageUrl = urlData.publicUrl
                results.imagesDownloaded++
              } else {
                results.imagesFailed++
              }
            } else {
              results.imagesFailed++
            }
          } catch {
            results.imagesFailed++
          }
        }

        const product = await prisma.product.create({
          data: {
            name: item.name,
            description: item.description || null,
            price: item.price,
            image: imageUrl,
            isAvailable: item.status === "AVAILABLE",
            categoryId,
            establishmentId: auth.establishmentId,
            onSale: item.originalPrice > item.price,
            promoPrice: item.originalPrice > item.price ? item.price : null,
            order: 0,
          },
        })

        results.created++

        // Create AdditionalOption records from optionGroups
        if (item.optionGroups && item.optionGroups.length > 0) {
          for (let groupIdx = 0; groupIdx < item.optionGroups.length; groupIdx++) {
            const og = item.optionGroups[groupIdx]

            // Determine selection type
            let selectionType = "multiple"
            if (og.min >= 1 && og.max === 1) {
              selectionType = "required"
            } else if (og.max === 1) {
              selectionType = "single"
            }

            for (let optIdx = 0; optIdx < og.options.length; optIdx++) {
              const opt = og.options[optIdx]

              await prisma.additionalOption.create({
                data: {
                  name: opt.name,
                  price: opt.price,
                  selectionType,
                  inputType: "radio",
                  groupName: og.name,
                  headerText: og.min >= 1
                    ? `Escolha ${og.min === og.max ? og.min : `de ${og.min} a ${og.max}`}`
                    : `Escolha até ${og.max}`,
                  maxSelection: og.max || null,
                  order: optIdx,
                  groupOrder: groupIdx,
                  productId: product.id,
                  establishmentId: auth.establishmentId,
                },
              })

              results.optionsCreated++
            }
          }
        }
      } catch (error: any) {
        results.errors.push(`Erro ao importar "${item.name}": ${error.message}`)
      }
    }

    return NextResponse.json(results)
  } catch (error: any) {
    console.error("[ifood-catalog-import] error:", error.message)
    return NextResponse.json(
      { error: "Erro ao importar catálogo" },
      { status: 500 }
    )
  }
}
