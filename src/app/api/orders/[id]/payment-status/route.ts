import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getInterPixStatus } from "@/lib/integrations/inter"

const ASAAS_API_URL =
  process.env.ASAAS_ENVIRONMENT === "sandbox"
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
      total: true,
      establishment: {
        select: {
          asaasApiKey: true,
          interClientId: true,
          interClientSecret: true,
          interCertificate: true,
          interPixKey: true,
        },
      },
    },
  })

  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
  }

  const isInterPayment = order.paymentId?.startsWith("inter_")

  // Inter payment - poll Inter API
  if (isInterPayment && order.paymentStatus === "pending" && order.establishment.interClientId) {
    const txid = order.paymentId!.replace("inter_", "")
    try {
      const config = {
        clientId: order.establishment.interClientId!,
        clientSecret: order.establishment.interClientSecret!,
        certificate: order.establishment.interCertificate!,
      }
      const result = await getInterPixStatus(config, txid)

      if (result.status === "CONCLUIDA") {
        await prisma.order.update({
          where: { id: params.id },
          data: { paymentStatus: "paid", status: "confirmed" },
        })
        return NextResponse.json({ paymentStatus: "paid", status: "confirmed" })
      }
    } catch (error: any) {
      console.error("[Inter Payment Status] Error:", error.message)
    }
  }

  // Asaas payment - poll Asaas API
  if (!isInterPayment && order.paymentStatus === "pending" && order.paymentId && order.establishment.asaasApiKey) {
    try {
      const res = await fetch(`${ASAAS_API_URL}/payments/${order.paymentId}`, {
        headers: { access_token: order.establishment.asaasApiKey },
      })
      if (res.ok) {
        const asaasPayment = await res.json()
        let asaasStatus = asaasPayment.status
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
