import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const { id: productId } = params
    const { links } = await req.json()

    if (!Array.isArray(links)) {
      return NextResponse.json({ error: "links deve ser array" }, { status: 400 })
    }

    // Verifica que o produto pertence ao estabelecimento
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { establishmentId: true },
    })
    if (!product || product.establishmentId !== authUser.establishmentId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
    }

    // Deleta todos os links existentes
    await prisma.productStockLink.deleteMany({ where: { productId } })

    // Recria os novos
    if (links.length > 0) {
      await prisma.productStockLink.createMany({
        data: links.map((l: any) => ({
          productId,
          stockItemId: l.stockItemId,
          quantity: parseFloat(l.quantity),
          unit: l.unit || "un",
        })),
      })
    }

    return NextResponse.json({ success: true, count: links.length })
  } catch (error: any) {
    console.error("[stock-links/reset]", error)
    return NextResponse.json({ error: error.message || "Erro" }, { status: 500 })
  }
}
