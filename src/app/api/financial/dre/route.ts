import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const establishmentId = req.nextUrl.searchParams.get("establishmentId")
  const from = req.nextUrl.searchParams.get("from")
  const to = req.nextUrl.searchParams.get("to")

  if (!establishmentId) return NextResponse.json({ error: "establishmentId required" }, { status: 400 })

  const dateFilter: any = {}
  if (from) dateFilter.gte = new Date(from)
  if (to) dateFilter.lte = new Date(to + "T23:59:59")

  const orderWhere: any = {
    establishmentId,
    status: { not: "cancelled" },
  }
  if (Object.keys(dateFilter).length > 0) {
    orderWhere.createdAt = dateFilter
  }

  const expenseWhere: any = { establishmentId }
  if (Object.keys(dateFilter).length > 0) {
    expenseWhere.date = dateFilter
  }

  const deliveryPaymentWhere: any = { establishmentId }
  if (Object.keys(dateFilter).length > 0) {
    deliveryPaymentWhere.createdAt = dateFilter
  }

  const [orders, expenses, deliveryPayments] = await Promise.all([
    prisma.order.findMany({ where: orderWhere }),
    prisma.expense.findMany({ where: expenseWhere }),
    prisma.deliveryPayment.findMany({ where: deliveryPaymentWhere }),
  ])

  // Revenue breakdown
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0)
  const onlineOrders = orders.filter((o) => o.paymentMethod === "online")
  const presencialOrders = orders.filter((o) => o.orderType === "presencial")
  const onlineRevenue = onlineOrders.reduce((sum, o) => sum + o.total, 0)
  const presencialRevenue = presencialOrders.reduce((sum, o) => sum + o.total, 0)
  const deliveryRevenue = orders.filter((o) => o.orderType === "delivery").reduce((sum, o) => sum + o.total, 0)
  const pickupRevenue = orders.filter((o) => o.orderType === "pickup").reduce((sum, o) => sum + o.total, 0)

  // Coupons discount
  const couponsUsed = orders.filter((o) => o.couponId)
  let couponsDiscount = 0
  // Desconto de cupons - funcionalidade em implementação
  // for (const order of couponsUsed) {
  //   try {
  //     const coupon = await prisma.coupon.findUnique({ where: { id: order.couponId! } })
  //     if (coupon) {
  //       if (coupon.type === "percent") {
  //         couponsDiscount += order.total * (coupon.value / 100)
  //       } else {
  //         couponsDiscount += coupon.value
  //       }
  //     }
  //   } catch {}
  // }

  // Expenses by category
  const expensesByCategory = {
    fixa: expenses.filter((e) => e.category === "fixa").reduce((sum, e) => sum + e.amount, 0),
    variavel: expenses.filter((e) => e.category === "variavel").reduce((sum, e) => sum + e.amount, 0),
    motoboy: expenses.filter((e) => e.category === "motoboy").reduce((sum, e) => sum + e.amount, 0),
    insumo: expenses.filter((e) => e.category === "insumo").reduce((sum, e) => sum + e.amount, 0),
    salario: expenses.filter((e) => e.category === "salario").reduce((sum, e) => sum + e.amount, 0),
    aluguel: expenses.filter((e) => e.category === "aluguel").reduce((sum, e) => sum + e.amount, 0),
    energia: expenses.filter((e) => e.category === "energia").reduce((sum, e) => sum + e.amount, 0),
    agua: expenses.filter((e) => e.category === "agua").reduce((sum, e) => sum + e.amount, 0),
    internet: expenses.filter((e) => e.category === "internet").reduce((sum, e) => sum + e.amount, 0),
    imposto: expenses.filter((e) => e.category === "imposto").reduce((sum, e) => sum + e.amount, 0),
    manutencao: expenses.filter((e) => e.category === "manutencao").reduce((sum, e) => sum + e.amount, 0),
    marketing: expenses.filter((e) => e.category === "marketing").reduce((sum, e) => sum + e.amount, 0),
    outro: expenses.filter((e) => !["fixa","variavel","motoboy","insumo","salario","aluguel","energia","agua","internet","imposto","manutencao","marketing"].includes(e.category)).reduce((sum, e) => sum + e.amount, 0),
  }
  const totalExpenses = Object.values(expensesByCategory).reduce((sum, v) => sum + v, 0)

  // Delivery payments (motoboy costs)
  const deliveryCosts = deliveryPayments.reduce((sum, p) => sum + p.amount, 0)

  // DRE calculation
  const receitaBruta = totalRevenue
  const descontos = couponsDiscount
  const receitaLiquida = receitaBruta - descontos
  const custoEntregas = deliveryCosts
  const despesasOperacionais = totalExpenses
  const lucroBruto = receitaLiquida - custoEntregas
  const lucroLiquido = lucroBruto - despesasOperacionais

  const result = {
    period: { from: from || "início", to: to || "agora" },
    summary: {
      receitaBruta,
      descontos,
      receitaLiquida,
      custoEntregas,
      despesasOperacionais,
      lucroBruto,
      lucroLiquido,
    },
    breakdown: {
      byType: {
        delivery: deliveryRevenue,
        pickup: pickupRevenue,
        presencial: presencialRevenue,
        online: onlineRevenue,
      },
      byPayment: {
        money: orders.filter((o) => o.paymentMethod === "money").reduce((sum, o) => sum + o.total, 0),
        card: orders.filter((o) => o.paymentMethod === "card").reduce((sum, o) => sum + o.total, 0),
        pix: orders.filter((o) => o.paymentMethod === "pix").reduce((sum, o) => sum + o.total, 0),
        online: onlineRevenue,
      },
      expensesByCategory,
    },
    counts: {
      orders: orders.length,
      expenses: expenses.length,
      deliveryPayments: deliveryPayments.length,
    },
  }

  return NextResponse.json(result)
}
