import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getInterPixStatus } from "@/lib/integrations/inter"
import { getPagarmeConfig } from "@/lib/pagarme-config"

const ASAAS_API_URL =
  process.env.ASAAS_ENVIRONMENT === "sandbox"
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3"

// Public endpoint used by the cardápio to poll payment status. Requires the
// order's trackingToken as ?token= so only someone with the order link can
// trigger an Asaas/Inter status check. Never returns secrets.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get("token")
  if (!token) {
    return NextResponse.json({ error: "Token necessário" }, { status: 401 })
  }

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    select: {
      trackingToken: true,
      paymentStatus: true,
      status: true,
      paymentId: true,
      establishment: {
        select: {
          asaasApiKey: true,
          interClientId: true,
          interClientSecret: true,
          interCertificate: true,
          interCertificatePassword: true,
        },
      },
    },
  })

  if (!order || order.trackingToken !== token) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
  }

  const isInterPayment = order.paymentId?.startsWith("inter_")

  if (isInterPayment && order.paymentStatus === "pending" && order.establishment.interClientId) {
    const txid = order.paymentId!.replace("inter_", "")
    try {
      const config = {
        clientId: order.establishment.interClientId!,
        clientSecret: order.establishment.interClientSecret!,
        certificate: order.establishment.interCertificate!,
        certificatePassword: order.establishment.interCertificatePassword || "",
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

  // Pagar.me payment status polling (charge IDs start with "ch_")
  const isPagarmePayment = order.paymentId?.startsWith("ch_")
  if (isPagarmePayment && order.paymentStatus === "pending" && order.paymentId) {
    try {
      const config = await getPagarmeConfig()
      if (config.apiKey) {
        const res = await fetch(`https://api.pagar.me/core/v5/charges/${order.paymentId}`, {
          headers: { Authorization: `Basic ${Buffer.from(config.apiKey + ":").toString("base64")}` },
        })
        if (res.ok) {
          const charge = await res.json()
          if (charge.status === "paid" || charge.last_transaction_status === "paid") {
            // Check autoAcceptOrders to decide between confirmed or preparing
            const est = await prisma.establishment.findUnique({
              where: { id: order.establishmentId },
              select: { autoAcceptOrders: true },
            })
            const newStatus = est?.autoAcceptOrders ? "preparing" : "confirmed"
            await prisma.order.update({
              where: { id: params.id },
              data: { paymentStatus: "paid", status: newStatus },
            })
            return NextResponse.json({ paymentStatus: "paid", status: newStatus })
          }
        }
      }
    } catch (e: any) {
      console.error("[Pagar.me Payment Status] Error:", e.message)
    }
  }

  return NextResponse.json({
    paymentStatus: order.paymentStatus,
    status: order.status,
  })
}
