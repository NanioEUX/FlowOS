import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const establishmentId = searchParams.get("establishmentId")

  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId é obrigatório" }, { status: 400 })
  }

  const user = await verifyAuth(req)
  if (!user || user.establishmentId !== establishmentId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const purchases = await prisma.purchase.findMany({
    where: { establishmentId },
    include: {
      items: {
        include: { stockItem: { select: { name: true, unit: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return NextResponse.json(purchases)
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await req.json()
    const {
      supplierId,
      supplierName,
      documentNumber,
      purchaseDate,
      items,
      paymentMethod,
      paymentCondition,
      expenseType,
      dueDate,
      recurrenceFreq,
      notes,
    } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Adicione pelo menos um insumo" }, { status: 400 })
    }

    const establishmentId = user.establishmentId

    // Calculate total
    const totalAmount = items.reduce((sum: number, item: any) => sum + item.totalCost, 0)

    // Create purchase with items
    const purchase = await prisma.purchase.create({
      data: {
        supplierId: supplierId || null,
        supplierName: supplierName || null,
        documentNumber: documentNumber || null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
        totalAmount,
        paymentMethod: paymentMethod || "dinheiro",
        paymentCondition: paymentCondition || "avista",
        expenseType: expenseType || "lancamento",
        dueDate: dueDate ? new Date(dueDate) : null,
        recurrenceFreq: recurrenceFreq || null,
        notes: notes || null,
        establishmentId,
        items: {
          create: items.map((item: any) => ({
            stockItemId: item.stockItemId,
            quantity: item.quantity,
            unit: item.unit || "un",
            unitCost: item.unitCost,
            totalCost: item.totalCost,
          })),
        },
      },
      include: { items: true },
    })

    // Update stock for each item
    for (const item of items) {
      const stockItem = await prisma.stockItem.findUnique({
        where: { id: item.stockItemId },
      })

      if (stockItem) {
        // Calculate new weighted average cost
        const currentTotalCost = stockItem.quantity * stockItem.unitCost
        const newTotalCost = currentTotalCost + item.totalCost
        const newQuantity = stockItem.quantity + item.quantity
        const newUnitCost = newQuantity > 0 ? newTotalCost / newQuantity : 0

        await prisma.stockItem.update({
          where: { id: item.stockItemId },
          data: {
            quantity: newQuantity,
            unitCost: newUnitCost,
            previousUnitCost: stockItem.unitCost,
          },
        })

        // Create stock movement
        await prisma.stockMovement.create({
          data: {
            type: "entrada",
            quantity: item.quantity,
            unitCost: item.unitCost,
            notes: `Compra #${purchase.id.slice(-6)}`,
            itemId: item.stockItemId,
          },
        })
      }
    }

    // Create expense if payment is "avista" (cash)
    if (paymentCondition === "avista") {
      const expenseDescription = items.length === 1
        ? `Compra: ${items[0].stockItemName || "Insumo"}`
        : `Compra: ${items.length} insumos`

      await prisma.expense.create({
        data: {
          description: expenseDescription,
          amount: totalAmount,
          category: "estoque",
          type: expenseType || "lancamento",
          paymentMethod: paymentMethod || "dinheiro",
          isRecurring: expenseType === "recorrente",
          recurrenceFreq: expenseType === "recorrente" ? recurrenceFreq : null,
          date: purchaseDate ? new Date(purchaseDate) : new Date(),
          dueDate: expenseType === "agendada" && dueDate ? new Date(dueDate) : null,
          purchaseId: purchase.id,
          establishmentId,
        },
      })
    }

    return NextResponse.json(purchase)
  } catch (error: any) {
    console.error("[PURCHASE]", error)
    return NextResponse.json(
      { error: error.message || "Erro ao criar compra" },
      { status: 500 }
    )
  }
}
