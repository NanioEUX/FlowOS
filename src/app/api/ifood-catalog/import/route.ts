import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"
import https from "https"
import { createClient } from "@supabase/supabase-js"

interface ImportItem {
  id: string
  name: string
  description: string
  price: number
  originalPrice: number
  imagePath: string | null
  targetCategoryId: string
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
    const { items, categoryMappings } = body

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
      imagesDownloaded: 0,
      imagesFailed: 0,
      errors: [] as string[],
    }

    for (const item of items) {
      try {
        // Find or create category
        let categoryId = item.targetCategoryId

        if (!categoryId) {
          // Create new category from iFood name
          const newCat = await prisma.category.create({
            data: {
              name: item.ifoodCategoryName || "Sem categoria",
              establishmentId: auth.establishmentId,
              order: 0,
            },
          })
          categoryId = newCat.id
        }

        // Download image if available
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

        // Create product
        await prisma.product.create({
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
