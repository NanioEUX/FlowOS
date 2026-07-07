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

  // One-time cleanup: clear date for agendada/recorrente that have date set
  const cleanup = req.nextUrl.searchParams.get("cleanup")
  if (cleanup === "fix-dates") {
    await prisma.expense.updateMany({
      where: { establishmentId, type: { in: ["agendada", "recorrente"] }, date: { not: null } },
      data: { date: null },
    })
    return NextResponse.json({ cleaned: true })
  }

  const where: any = { establishmentId }
  if (from || to) {
    const dateFilter: any = {}
    if (from) dateFilter.gte = new Date(from)
    if (to) dateFilter.lte = new Date(to + "T23:59:59")
    where.OR = [
      { type: "lancamento", date: dateFilter },
      { type: "agendada", dueDate: dateFilter },
      { type: "recorrente", recurrenceStart: dateFilter },
    ]
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

  // Enrich with computed status (use local date, not UTC)
  const today = new Date().toLocaleDateString("en-CA")
  const enriched = expenses.map((e) => {
    let computedStatus = "pago"
    if (e.type === "lancamento") {
      computedStatus = "pago"
    } else if (e.type === "agendada") {
      if (e.date) {
        computedStatus = "pago"
      } else if (e.dueDate) {
        const due = new Date(e.dueDate).toISOString().split("T")[0]
        if (due < today) computedStatus = "atrasada"
        else if (due === today) computedStatus = "vence_hoje"
        else computedStatus = "a_vencer"
      } else {
        computedStatus = "pendente"
      }
    } else if (e.type === "recorrente") {
      if (e.date) {
        computedStatus = "pago"
      } else if (e.recurrenceStart) {
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
  const todayISO = new Date().toLocaleDateString("en-CA")

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
      entries.push({
        description,
        amount,
        category: category || "variavel",
        type: "recorrente",
        paymentMethod: paymentMethod || "dinheiro",
        isRecurring: true,
        recurrenceFreq: recurrenceFreq || "mensal",
        recurrenceStart: new Date(d),
        recurrenceEnd: recEnd ? new Date(recEnd + "T00:00:00") : null,
        receiptUrl: receiptUrl || null,
        date: null,
        dueDate: new Date(iso + "T00:00:00"),
        cashRegisterId: null,
        establishmentId,
      })
      if (d >= end) break
      d.setMonth(d.getMonth() + 1)
      i++
    }

    const created = await prisma.expense.createMany({ data: entries })
    return NextResponse.json({ count: created.count })
  }

  // For agendada: set dueDate
  const finalDueDate = (expenseType === "agendada" || expenseType === "recorrente") && dueDate ? new Date(dueDate + "T00:00:00") : null

  // Only lancamento has payment date; agendada/recorrente have null (paid later)
  const paymentDate = expenseType === "lancamento" ? (date ? new Date(date + "T00:00:00") : new Date()) : null

  const expense = await prisma.expense.create({
    data: {
      description,
      amount,
      category: category || "variavel",
      type: expenseType,
      paymentMethod: paymentMethod || "dinheiro",
      isRecurring: expenseType === "recorrente",
      recurrenceFreq: expenseType === "recorrente" ? (recurrenceFreq || "mensal") : null,
      recurrenceStart: recStart ? new Date(recStart + "T00:00:00") : null,
      recurrenceEnd: recEnd ? new Date(recEnd + "T00:00:00") : null,
      receiptUrl: receiptUrl || null,
      date: paymentDate,
      dueDate: finalDueDate,
      cashRegisterId: cashRegisterId || null,
      establishmentId,
    },
  })

  // Only create cash movement for lancamento (already paid)
  if (expenseType === "lancamento" && cashRegisterId) {
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
