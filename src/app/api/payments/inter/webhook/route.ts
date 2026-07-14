import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log("[Inter Webhook] Received:", JSON.stringify(body).slice(0, 500))

    // Inter sends PIX webhook with pix array containing payment details
    const pixList = body.pix || []

    for (const pix of pixList) {
      const txid = pix.txid
      if (!txid) continue

      // Find order by paymentId (stored as "inter_{txid}")
      const order = await prisma.order.findFirst({
        where: { paymentId: `inter_${txid}` },
      })

      if (!order) {
        console.log("[Inter Webhook] Order not found for txid:", txid)
        continue
      }

      if (order.paymentStatus === "paid") {
        console.log("[Inter Webhook] Order already paid:", order.id)
        continue
      }

      // pix.horario is when payment was made, pix.valor is amount paid
      if (pix.valor && parseFloat(pix.valor) >= order.total * 0.99) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: "paid",
            status: "confirmed",
          },
        })
        console.log("[Inter Webhook] Order paid:", order.id, "value:", pix.valor)
      } else {
        console.log("[Inter Webhook] Value mismatch:", pix.valor, "expected:", order.total)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error("[Inter Webhook] Error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
