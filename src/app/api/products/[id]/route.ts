import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = params
    const contentType = req.headers.get("content-type") || ""
    let data: any = {}

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      const booleanFields = ["sendToPrep", "active", "available"]
      for (const [key, value] of formData.entries()) {
        if (key === "file") {
          continue
        }
        if (value === "null" || value === "undefined") {
          data[key] = null
        } else if (key === "price") {
          data[key] = parseFloat(value as string)
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

    console.log("[PRODUCT PATCH]", id, data)

    const product = await prisma.product.update({
      where: { id },
      data,
    })

    console.log("[PRODUCT PATCH] result:", product.sendToPrep)

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
    const authUser = await verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = params

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
