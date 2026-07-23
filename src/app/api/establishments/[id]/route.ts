import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const establishment = await prisma.establishment.findUnique({
    where: { id: params.id },
    include: {
      categories: {
        include: { products: true },
        orderBy: { order: "asc" },
      },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  })

  if (!establishment) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  }

  return NextResponse.json(establishment)
}

const SAFE_FIELDS = ["name", "slug", "phone", "email", "address", "logo", "cover", "description", "deliveryFeeType", "deliveryFeeAmount", "deliveryFreeAbove", "paymentConfig", "orderConfig", "primaryColor", "backgroundColor", "textColor", "headerColor", "colorsPublished", "instagramUrl", "businessHours", "loyaltyConfig", "pickupMessage", "deliveryMessage", "confirmationTitle", "confirmationImage", "closedTitle", "closedSub", "tableCount", "defaultTheme", "expenseCategories", "asaasApiKey", "asaasWalletId", "efiClientId", "efiClientSecret", "efiPixKey", "efiCertificate", "efiEnvironment", "efiWebhookToken", "paymentProvider", "interClientId", "interClientSecret", "interCertificate", "interCertificatePassword", "interPixKey"]

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    const establishmentId = authUser.establishmentId
    if (establishmentId !== params.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
    }

    const body = await req.json()
    const filtered: Record<string, any> = {}
    for (const key of SAFE_FIELDS) {
      if (key in body) filtered[key] = body[key]
    }

    const establishment = await prisma.establishment.update({
      where: { id: params.id },
      data: filtered,
    })
    return NextResponse.json(establishment)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 })
  }
}
