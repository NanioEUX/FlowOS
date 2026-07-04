import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Alerts: 30s cache (stock/expenses don't change every second)
export const revalidate = 30

export async function GET(req: NextRequest) {
  const establishmentId = req.headers.get("x-establishment-id") || req.nextUrl.searchParams.get("establishmentId")
  if (!establishmentId) return NextResponse.json({ expenseAlert: "none", stockAlert: "none" })

  const today = new Date().toISOString().split("T")[0]

  // Check expenses
  let expenseAlert: "none" | "warning" | "danger" = "none"
  try {
    const expenses = await prisma.expense.findMany({
      where: { establishmentId, type: { in: ["agendada", "recorrente"] } },
      select: { dueDate: true, recurrenceStart: true, type: true },
    })

    for (const e of expenses) {
      const dateStr = e.type === "agendada" && e.dueDate
        ? new Date(e.dueDate).toISOString().split("T")[0]
        : e.type === "recorrente" && e.recurrenceStart
          ? new Date(e.recurrenceStart).toISOString().split("T")[0]
          : null
      if (!dateStr) continue
      if (dateStr < today) { expenseAlert = "danger"; break }
      if (dateStr === today) expenseAlert = "warning"
    }
  } catch {}

  // Check stock
  let stockAlert: "none" | "warning" | "danger" = "none"
  try {
    const items = await prisma.stockItem.findMany({
      where: { establishmentId },
      select: { quantity: true, minQuantity: true },
    })
    for (const item of items) {
      if (item.quantity <= 0) { stockAlert = "danger"; break }
      if (item.quantity <= item.minQuantity && item.minQuantity > 0) stockAlert = "warning"
    }
  } catch {}

  return NextResponse.json({ expenseAlert, stockAlert })
}
