import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"
import { getRequestId, logger } from "@/lib/logger"

/**
 * F9C-010 — Exportação de dados do estabelecimento (LGPD art. 18 V - portabilidade).
 *
 * O estabelecimento pode exportar todos os seus dados em JSON para download.
 * A rota exige autenticação e verifica se o establishmentId pertence ao usuário logado.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const establishmentId = searchParams.get("establishmentId")

  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId é obrigatório" }, { status: 400 })
  }

  const user = await verifyAuth(req)
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  if (user.establishmentId !== establishmentId && user.role !== "saas_admin") {
    return NextResponse.json({ error: "Estabelecimento não autorizado" }, { status: 403 })
  }

  try {
    const establishment = await prisma.establishment.findUnique({
      where: { id: establishmentId },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        category: true,
        address: true,
        description: true,
        isActive: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        trialStartsAt: true,
        trialEndsAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!establishment) {
      return NextResponse.json({ error: "Estabelecimento não encontrado" }, { status: 404 })
    }

    const [categories, customers, orders, cashRegisters, expenses, deliveryPersons] =
      await Promise.all([
        prisma.category.findMany({
          where: { establishmentId },
          include: {
            products: {
              where: { isAvailable: true },
              orderBy: { order: "asc" },
              include: {
                additionalOptions: true,
                stockLinks: true,
              },
            },
          },
          orderBy: { order: "asc" },
        }),
        prisma.customer.findMany({
          where: { establishmentId },
          orderBy: { createdAt: "desc" },
        }),
        prisma.order.findMany({
          where: { establishmentId },
          orderBy: { createdAt: "desc" },
          take: 5000,
        }),
        prisma.cashRegister.findMany({
          where: { establishmentId },
          orderBy: { createdAt: "desc" },
        }),
        prisma.expense.findMany({
          where: { establishmentId },
          orderBy: { createdAt: "desc" },
        }),
        prisma.deliveryPerson.findMany({
          where: { establishmentId },
          orderBy: { createdAt: "asc" },
        }),
      ])

    // products já vêm dentro de categories acima, mas listamos também de forma plana
    const allProducts = categories.flatMap((c) => c.products)

    const exportData = {
      exportedAt: new Date().toISOString(),
      establishment,
      categories,
      products: allProducts,
      customers,
      orders,
      cashRegisters,
      expenses,
      deliveryPersons,
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const fileName = `flowos-export-${establishment.slug || establishmentId}-${new Date().toISOString().split("T")[0]}.json`

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-cache",
      },
    })
  } catch (error) {
    logger.error("establishments-export", "falha ao exportar dados", {
      requestId: getRequestId(req),
      establishmentId,
      error: (error as any)?.message,
    })
    return NextResponse.json({ error: "Erro ao exportar dados" }, { status: 500 })
  }
}
