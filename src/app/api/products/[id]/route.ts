import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireEstablishment } from "@/lib/require-auth"

export const dynamic = "force-dynamic"

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = requireEstablishment(req)
    if (error) return error

    const product = await prisma.product.findFirst({
      where: { id: params.id, establishmentId: user.establishmentId },
      include: {
        stockLinks: true,
        stockItem: true,
      },
    })
    if (!product) {
      return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 })
    }
    return NextResponse.json(product)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = requireEstablishment(req)
    if (error) return error

    const { id } = params

    // Verify product belongs to this establishment
    const existing = await prisma.product.findFirst({
      where: { id, establishmentId: user.establishmentId },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 })
    }

    const contentType = req.headers.get("content-type") || ""
    let data: any = {}

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      const booleanFields = ["sendToPrep", "onSale", "active", "available", "availableOnline", "availablePresencial", "availableWhatsapp", "featured", "zoomEnabled", "syncToIfood", "ifoodPriceLocked"]
      for (const [key, value] of formData.entries()) {
        if (key === "file") {
          continue
        }
        if (value === "null" || value === "undefined") {
          data[key] = null
        } else if (key === "price" || key === "promoPrice" || key === "featuredDiscountPrice" || key === "ifoodPrice") {
          data[key] = value === "null" ? null : parseFloat(value as string)
        } else if (booleanFields.includes(key)) {
          data[key] = value === "true" || value === "1"
        } else {
          data[key] = value
        }
      }

      const file = formData.get("file") as File | null
      if (file && file.size > 0) {
        const bytes = await file.arrayBuffer()
        const base64 = Buffer.from(bytes).toString("base64")
        const mime = file.type || "image/jpeg"
        data.image = `data:${mime};base64,${base64}`
      }
    } else {
      data = await req.json()
    }

    // Prevent client from changing establishmentId
    delete data.establishmentId

    const product = await prisma.product.update({
      where: { id },
      data,
    })

    return NextResponse.json(product)
  } catch (error: any) {
    console.error("[PRODUCT PATCH]", error)
    return NextResponse.json(
      { error: error.message || "Erro ao atualizar produto" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = requireEstablishment(req)
    if (error) return error

    const { id } = params

    // Verify product belongs to this establishment
    const existing = await prisma.product.findFirst({
      where: { id, establishmentId: user.establishmentId },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 })
    }

    // Delete stock links first
    await prisma.productStockLink.deleteMany({ where: { productId: id } })

    // Delete the product
    await prisma.product.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao deletar produto" },
      { status: 500 }
    )
  }
}
