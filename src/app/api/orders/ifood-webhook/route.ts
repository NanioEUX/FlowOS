import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { getIfoodAuth, getIfoodOrder, mapIfoodOrderToFlow } from "@/lib/integrations/ifood"

function verifySignature(body: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex")
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  )
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text()
    console.log("[ifood webhook] HIT", new Date().toISOString(), "body-len=", raw.length, "headers=", Object.fromEntries(req.headers))
    const signature =
      req.headers.get("x-ifood-signature") ||
      req.headers.get("X-Ifood-Signature") ||
      req.headers.get("authorization")?.replace("Bearer ", "") ||
      ""

    const secret = process.env.IFOOD_WEBHOOK_SECRET || process.env.IFOOD_CLIENT_SECRET || ""

    if (secret && signature && signature.length > 16) {
      try {
        const ok = verifySignature(raw, signature, secret)
        if (!ok) {
          console.warn("[ifood webhook] signature mismatch")
        }
      } catch {
        // buffers may have different lengths; ignore
      }
    }

    const payload = JSON.parse(raw)
    let events: any[] = []
    if (Array.isArray(payload)) {
      events = payload
    } else if (payload.orderId || payload.code) {
      events = [payload]
    } else if (payload.events && Array.isArray(payload.events)) {
      events = payload.events
    } else {
      events = []
    }

    if (events.length === 0) {
      return NextResponse.json({ ok: true, msg: "noop" })
    }

    console.log("[ifood webhook] received", events.length, "events:", events.map((e: any) => ({ code: e.code || e.fullCode, orderId: (e.orderId || e.id || "").slice(0, 8) })).slice(0, 5))

    const establishments = await prisma.establishment.findMany({
      where: { ifoodEnabled: true, ifoodMerchantId: { not: null } },
    })

    if (establishments.length === 0) {
      return NextResponse.json({ ok: true, msg: "no establishment enabled" })
    }

    const est = establishments[0]

    let created = 0
    let updated = 0
    const results: any[] = []

    for (const event of events) {
      const code = event.code || event.fullCode
      const orderId = event.orderId || event.id

      console.log("[ifood webhook] processing event", { code, orderId: orderId?.slice(0, 8), fullEvent: JSON.stringify(event).slice(0, 300) })

      if (!orderId) {
        console.log("[ifood webhook] no orderId, skipping")
        continue
      }

      // iFood sends KEEPALIVE events to verify the webhook is alive.
      // We acknowledge them with 200 OK but do nothing.
      if (code === "KEEPALIVE") {
        console.log("[ifood webhook] keepalive received, ok")
        continue
      }

      if (["PLACED", "CFM", "CONFIRMED"].includes(code)) {
        const existing = await prisma.order.findFirst({
          where: { establishmentId: est.id, externalId: orderId },
        })

        if (!existing && event.fullOrder) {
          try {
            const mapped = mapIfoodOrderToFlow(event.fullOrder, est.id, code)
            await prisma.order.create({ data: { ...mapped, externalId: orderId } })
            created++
            results.push({ orderId, action: 'created' })
          } catch (e: any) {
            results.push({ orderId, action: 'create_error', error: e.message })
          }
        } else if (!existing) {
          try {
            const token = await getIfoodAuth(
              process.env.IFOOD_CLIENT_ID!,
              process.env.IFOOD_CLIENT_SECRET!
            )
            const order = await getIfoodOrder(token.accessToken, est.ifoodMerchantId!, orderId)
            console.log("[ifood webhook] fetched order", orderId, "items=", order?.items?.length, "hasCustomer=", !!order?.customer, "orderType=", order?.orderType)
            console.log("[ifood webhook] full iFood payload:", JSON.stringify(order).slice(0, 500))
            if (order && order.items && order.items.length > 0) {
              const mapped = mapIfoodOrderToFlow(order, est.id, code)
              try {
                await prisma.order.create({ data: { ...mapped, externalId: orderId } })
                created++
                results.push({ orderId, action: 'created' })
                console.log("[ifood webhook] SAVED order", orderId, "id=", mapped.establishmentId)
              } catch (createErr: any) {
                console.error("[ifood webhook] PRISMA CREATE ERROR", orderId, createErr.message)
                results.push({ orderId, action: 'create_error', error: createErr.message })
              }
            } else {
              // PLC pode vir com items vazios. Salva o pedido com dados básicos
              // e depois atualiza quando chegar CFM com items completos.
              console.log("[ifood webhook] PLC without items, saving with placeholders", orderId)
              try {
                const placeholder = {
                  establishmentId: est.id,
                  customerName: "Aguardando iFood",
                  customerPhone: "",
                  total: 0,
                  items: JSON.stringify([]),
                  method: "ifood",
                  status: "pending",
                  paymentStatus: "pending",
                  orderType: "delivery",
                  paymentMethod: "online",
                }
                await prisma.order.create({ data: { ...placeholder, externalId: orderId } })
                created++
                results.push({ orderId, action: 'created_placeholder' })
                console.log("[ifood webhook] SAVED placeholder order", orderId)
              } catch (createErr: any) {
                console.error("[ifood webhook] PRISMA PLACEHOLDER ERROR", orderId, createErr.message)
                results.push({ orderId, action: 'create_placeholder_error', error: createErr.message })
              }
            }
          } catch (e: any) {
            results.push({ orderId, action: 'fetch_error', error: e.message })
          }
        } else {
          results.push({ orderId, action: 'already_exists' })
        }
      } else if (["DSP", "DISPATCHED", "CON", "CONCLUDED"].includes(code)) {
        const existing = await prisma.order.findFirst({
          where: { establishmentId: est.id, externalId: orderId },
        })
        if (existing) {
          const status = code === 'CON' || code === 'CONCLUDED' ? 'delivered' : 'dispatched'
          await prisma.order.update({
            where: { id: existing.id },
            data: { status },
          })
          updated++
          results.push({ orderId, action: 'updated', status })
        } else {
          results.push({ orderId, action: 'not_found_for_update' })
        }
      }
    }

    return NextResponse.json({ ok: true, created, updated, results })
  } catch (err: any) {
    console.error("[ifood webhook] error:", err.message)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
