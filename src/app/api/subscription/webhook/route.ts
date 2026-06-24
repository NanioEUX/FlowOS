import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const { event, payment } = body

    if (!event || !payment) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const establishmentId = payment.externalReference

    if (!establishmentId) {
      return NextResponse.json({ error: "No establishment reference" }, { status: 400 })
    }

    const establishment = await prisma.establishment.findUnique({
      where: { id: establishmentId },
    })

    if (!establishment) {
      return NextResponse.json({ error: "Establishment not found" }, { status: 404 })
    }

    if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
      const nextPayment = new Date()
      nextPayment.setMonth(nextPayment.getMonth() + 1)

      await prisma.establishment.update({
        where: { id: establishmentId },
        data: {
          subscriptionStatus: "active",
          nextPaymentAt: nextPayment,
        },
      })

      console.log(`Subscription activated for ${establishment.name} (${establishmentId})`)
    } else if (event === "PAYMENT_OVERDUE") {
      await prisma.establishment.update({
        where: { id: establishmentId },
        data: {
          subscriptionStatus: "expired",
        },
      })

      console.log(`Subscription expired for ${establishment.name} (${establishmentId})`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
