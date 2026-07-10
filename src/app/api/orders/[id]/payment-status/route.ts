import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const IS_SANDBOX = process.env.ASAAS_ENVIRONMENT === "sandbox"
const ASAAS_API_URL =
  IS_SANDBOX
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3"

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    select: {
      paymentStatus: true,
      status: true,
      paymentId: true,
      paymentLink: true,
      establishment: { select: { asaasApiKey: true } },
    },
  })

  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
  }

  // If still pending and has Asaas paymentId, check with Asaas and update DB
  if (order.paymentStatus === "pending" && order.paymentId && order.establishment.asaasApiKey) {
    try {
      const res = await fetch(`${ASAAS_API_URL}/payments/${order.paymentId}`, {
        headers: { access_token: order.establishment.asaasApiKey },
      })
      if (res.ok) {
        const asaasPayment = await res.json()
        let asaasStatus = asaasPayment.status
        if (IS_SANDBOX && asaasStatus === "PENDING") asaasStatus = "AUTHORIZED"
        if (["CONFIRMED", "RECEIVED", "AUTHORIZED"].includes(asaasStatus)) {
          await prisma.order.update({
            where: { id: params.id },
            data: { paymentStatus: "paid", status: "confirmed" },
          })
          return NextResponse.json({ paymentStatus: "paid", status: "confirmed" })
        }
      }
    } catch {}
  }

  return NextResponse.json({
    paymentStatus: order.paymentStatus,
    status: order.status,
  })
}
