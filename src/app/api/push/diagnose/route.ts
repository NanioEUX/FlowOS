import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import webpush from "web-push"

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@flowos.fs.app"

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const establishmentId = url.searchParams.get("establishmentId")
    const orderId = url.searchParams.get("orderId")
    const orderNumber = url.searchParams.get("orderNumber")

    let orderInfo: any = null
    let recentOrders: any[] = []
    let pushLogs: any[] = []
    if (establishmentId) {
      recentOrders = await prisma.order.findMany({
        where: { establishmentId },
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          customerPhone: true,
          customerName: true,
          updatedAt: true,
          trackingToken: true,
        },
      })
      pushLogs = await prisma.pushLog.findMany({
        where: { establishmentId },
        orderBy: { createdAt: "desc" },
        take: 15,
      })
    }
    if (orderId || orderNumber) {
      const order = orderId
        ? await prisma.order.findUnique({ where: { id: orderId } })
        : await prisma.order.findFirst({ where: { orderNumber: Number(orderNumber) } })
      if (order) {
        const rawPhone = order.customerPhone || ""
        const keys = [rawPhone, rawPhone.replace(/\D/g, "")].filter(
          (k, i, arr) => k && arr.indexOf(k) === i
        )
        keys.push("anonymous")
        const matchingSubs = await prisma.pushSubscription.findMany({
          where: { establishmentId: order.establishmentId, customerKey: { in: keys } },
          select: { id: true, customerKey: true, endpoint: true, lastUsedAt: true },
          orderBy: { lastUsedAt: "desc" },
          take: 10,
        })
        orderInfo = {
          orderId: order.id,
          orderNumber: (order as any).orderNumber || null,
          status: order.status,
          customerPhoneRaw: rawPhone,
          customerPhoneDigits: rawPhone.replace(/\D/g, ""),
          customerName: order.customerName,
          trackingToken: order.trackingToken,
          lookupKeys: keys,
          matchingSubscriptions: matchingSubs.length,
          subscriptions: matchingSubs.map((s) => ({
            customerKey: s.customerKey,
            endpoint: s.endpoint.slice(0, 60) + "...",
            lastUsedAt: s.lastUsedAt,
          })),
        }
      }
    }

    if (!establishmentId) {
      const establishments = await prisma.establishment.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
        },
        orderBy: { name: "asc" },
      })

      const summaries = await Promise.all(
        establishments.map(async (est) => {
          const [subCount, logCount, latestLogs, latestSub] = await Promise.all([
            prisma.pushSubscription.count({ where: { establishmentId: est.id } }),
            prisma.pushLog.count({ where: { establishmentId: est.id } }),
            prisma.pushLog.findMany({
              where: { establishmentId: est.id },
              orderBy: { createdAt: "desc" },
              take: 3,
              select: { status: true, sent: true, failed: true, detail: true, createdAt: true },
            }),
            prisma.pushSubscription.findFirst({
              where: { establishmentId: est.id },
              orderBy: { lastUsedAt: "desc" },
              select: { customerKey: true, userAgent: true, lastUsedAt: true },
            }),
          ])
          return {
            id: est.id,
            name: est.name,
            slug: est.slug,
            totalSubscriptions: subCount,
            totalPushLogs: logCount,
            latestSubscription: latestSub,
            recentPushLogs: latestLogs,
          }
        })
      )

      return NextResponse.json({ establishments: summaries })
    }

    const subs = await prisma.pushSubscription.findMany({
      where: { establishmentId },
      select: { id: true, customerKey: true, endpoint: true, p256dh: true, auth: true, userAgent: true, lastUsedAt: true },
      orderBy: { lastUsedAt: "desc" },
      take: 20,
    })

    const vapidOk = !!(VAPID_PUBLIC && VAPID_PRIVATE)
    let testResults: any[] = []
    let configured = false

    if (vapidOk) {
      try {
        webpush.setVapidDetails(VAPID_SUBJECT!, VAPID_PUBLIC!, VAPID_PRIVATE!)
        configured = true
      } catch (e: any) {
        testResults.push({ configError: e.message })
      }
    }

    if (configured) {
      for (const s of subs.slice(0, 3)) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: "Diagnóstico", body: "Teste de notificação", url: "/" })
          )
          testResults.push({ customerKey: s.customerKey, status: "OK" })
        } catch (e: any) {
          testResults.push({
            customerKey: s.customerKey,
            status: "FAIL",
            statusCode: e?.statusCode ?? null,
            body: e?.body ? String(e.body).slice(0, 200) : e?.message || null,
          })
        }
      }
    }

    return NextResponse.json({
      establishmentId,
      orderInfo,
      recentOrders,
      pushLogs,
      totalSubscriptions: subs.length,
      vapidOk,
      configured,
      subscriptions: subs.map((s) => ({
        customerKey: s.customerKey,
        endpoint: s.endpoint.slice(0, 60) + "...",
        userAgent: (s.userAgent || "").slice(0, 40),
        lastUsedAt: s.lastUsedAt,
      })),
      testResults,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
