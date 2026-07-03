import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const establishmentId = req.nextUrl.searchParams.get("establishmentId")
  const from = req.nextUrl.searchParams.get("from")
  const to = req.nextUrl.searchParams.get("to")
  const category = req.nextUrl.searchParams.get("category")
  const paymentMethod = req.nextUrl.searchParams.get("paymentMethod")
  const status = req.nextUrl.searchParams.get("status")
  const search = req.nextUrl.searchParams.get("search")
  const type = req.nextUrl.searchParams.get("type")

  if (!establishmentId) return NextResponse.json({ error: "establishmentId required" }, { status: 400 })

  const where: any = { establishmentId }
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) where.date.lte = new Date(to + "T23:59:59")
  }
  if (category && category !== "all") where.category = category
  if (paymentMethod && paymentMethod !== "all") where.paymentMethod = paymentMethod
  if (type && type !== "all") where.type = type

  if (search) {
    where.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
    ]
  }

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { date: "desc" },
  })

  // Enrich with computed status
  const today = new Date().toISOString().split("T")[0]
  const enriched = expenses.map((e) => {
    let computedStatus = "pago"
    if (e.type === "lancamento") {
      computedStatus = "pago"
    } else if (e.type === "agendada") {
      if (e.dueDate) {
        const due = new Date(e.dueDate).toISOString().split("T")[0]
        if (due < today) computedStatus = "atrasada"
        else if (due === today) computedStatus = "vence_hoje"
        else computedStatus = "a_vencer"
      } else {
        computedStatus = "pendente"
      }
    } else if (e.type === "recorrente") {
      if (e.recurrenceStart) {
        const start = new Date(e.recurrenceStart).toISOString().split("T")[0]
        if (start < today) computedStatus = "atrasada"
        else if (start === today) computedStatus = "vence_hoje"
        else computedStatus = "a_vencer"
      } else {
        computedStatus = "pendente"
      }
    }
    return { ...e, computedStatus }
  })

  // Filter by status if requested
  const filtered = status && status !== "all"
    ? enriched.filter((e) => e.computedStatus === status)
    : enriched

  return NextResponse.json(filtered)
}

export async function POST(req: NextRequest) {
  const {
    description, amount, category, date, dueDate, type,
    paymentMethod, isRecurring, recurrenceFreq,
    recurrenceStart, recurrenceEnd,
    receiptUrl, cashRegisterId, establishmentId,
  } = await req.json()

  if (!description || !amount || !establishmentId) {
    return NextResponse.json({ error: "description, amount, establishmentId required" }, { status: 400 })
  }

  const expenseType = type || "lancamento"
  const today = new Date()
  const todayISO = today.toISOString().split("T")[0]

  // For recorrente type without explicit recurrenceStart, use date
  const recStart = recurrenceStart || (expenseType === "recorrente" ? (date || todayISO) : null)
  const recEnd = recurrenceEnd || null

  // Compute initial status
  let initialStatus = "pago"
  if (expenseType === "agendada") {
    initialStatus = "pendente"
    if (dueDate && dueDate < todayISO) initialStatus = "atrasada"
  } else if (expenseType === "recorrente") {
    initialStatus = "pendente"
    if (recStart && recStart < todayISO) initialStatus = "atrasada"
  }

  // For recorrente: generate monthly entries
  if (expenseType === "recorrente" && recStart) {
    const entries: any[] = []
    const start = new Date(recStart + "T00:00:00")
    const end = recEnd ? new Date(recEnd + "T00:00:00") : new Date(start.getFullYear(), start.getMonth() + 1, start.getDate())
    const maxIter = 120
    let i = 0
    const d = new Date(start)

    while (i < maxIter) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      const entryStatus = iso < todayISO ? "atrasada" : "pendente"
      entries.push({
        description,
        amount,
        category: category || "variavel",
        type: "recorrente",
        paymentMethod: paymentMethod || "dinheiro",
        isRecurring: true,
        recurrenceFreq: recurrenceFreq || "mensal",
        recurrenceStart: new Date(d),
        recurrenceEnd: recEnd ? new Date(recEnd) : null,
        receiptUrl: receiptUrl || null,
        date: new Date(iso),
        dueDate: new Date(iso),
        cashRegisterId: cashRegisterId || null,
        establishmentId,
      })
      if (d >= end) break
      d.setMonth(d.getMonth() + 1)
      i++
    }

    const created = await prisma.expense.createMany({ data: entries })

    if (cashRegisterId) {
      await prisma.cashMovement.createMany({
        data: entries
          .filter((e) => e.date <= today)
          .map((e) => ({
            type: "expense",
            amount: e.amount,
            description: e.description,
            cashRegisterId,
          })),
      })
    }

    return NextResponse.json({ count: created.count })
  }

  // For agendada: set dueDate
  const finalDueDate = expenseType === "agendada" && dueDate ? new Date(dueDate) : null

  const expense = await prisma.expense.create({
    data: {
      description,
      amount,
      category: category || "variavel",
      type: expenseType,
      paymentMethod: paymentMethod || "dinheiro",
      isRecurring: expenseType === "recorrente",
      recurrenceFreq: expenseType === "recorrente" ? (recurrenceFreq || "mensal") : null,
      recurrenceStart: recStart ? new Date(recStart) : null,
      recurrenceEnd: recEnd ? new Date(recEnd) : null,
      receiptUrl: receiptUrl || null,
      date: date ? new Date(date) : new Date(),
      dueDate: finalDueDate,
      cashRegisterId: cashRegisterId || null,
      establishmentId,
    },
  })

  if (cashRegisterId) {
    await prisma.cashMovement.create({
      data: {
        type: "expense",
        amount,
        description,
        cashRegisterId,
      },
    })
  }

  return NextResponse.json(expense)
}
