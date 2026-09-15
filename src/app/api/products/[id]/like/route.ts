import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function getDeviceKey(request: NextRequest): string {
  const ua = request.headers.get("user-agent") || ""
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
  return `${ip}-${ua.slice(0, 50)}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = params.id
    const deviceKey = getDeviceKey(request)

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { likes: true },
    })

    if (!product) {
      return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 })
    }

    const existingLike = await prisma.productLike.findUnique({
      where: { productId_deviceKey: { productId, deviceKey } },
    })

    return NextResponse.json({
      likes: product.likes,
      liked: !!existingLike,
    })
  } catch (error) {
    console.error("[like:GET]", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = params.id
    const deviceKey = getDeviceKey(request)

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, likes: true },
    })

    if (!product) {
      return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 })
    }

    const existingLike = await prisma.productLike.findUnique({
      where: { productId_deviceKey: { productId, deviceKey } },
    })

    if (existingLike) {
      await prisma.productLike.delete({ where: { id: existingLike.id } })
      await prisma.product.update({
        where: { id: productId },
        data: { likes: { decrement: 1 } },
      })
      return NextResponse.json({ liked: false, likes: product.likes - 1 })
    } else {
      await prisma.productLike.create({
        data: { productId, deviceKey },
      })
      await prisma.product.update({
        where: { id: productId },
        data: { likes: { increment: 1 } },
      })
      return NextResponse.json({ liked: true, likes: product.likes + 1 })
    }
  } catch (error) {
    console.error("[like:POST]", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
