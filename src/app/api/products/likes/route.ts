import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function getDeviceKey(request: NextRequest): string {
  const ua = request.headers.get("user-agent") || ""
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
  return `${ip}-${ua.slice(0, 50)}`
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const establishmentId = searchParams.get("establishmentId")
    if (!establishmentId) {
      return NextResponse.json({ error: "establishmentId required" }, { status: 400 })
    }

    const deviceKey = getDeviceKey(request)

    const products = await prisma.product.findMany({
      where: { establishmentId, isAvailable: true },
      select: { id: true, likes: true },
    })

    const productIds = products.map((p) => p.id)
    const userLikes = await prisma.productLike.findMany({
      where: { productId: { in: productIds }, deviceKey },
      select: { productId: true },
    })
    const likedSet = new Set(userLikes.map((l) => l.productId))

    const result: Record<string, { likes: number; liked: boolean }> = {}
    for (const p of products) {
      result[p.id] = { likes: p.likes, liked: likedSet.has(p.id) }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[likes:GET]", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
