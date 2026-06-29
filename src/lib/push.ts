import webPush from "web-push"

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@flowos.fs.app"

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
}

export async function sendPushToDeliveryPerson(
  deliveryPersonId: string,
  title: string,
  body: string,
  url?: string
) {
  if (!vapidPublicKey || !vapidPrivateKey) return

  try {
    // Dynamic import to avoid issues if table doesn't exist
    const { prisma } = await import("@/lib/prisma")

    const subscriptions = await prisma.$queryRaw`
      SELECT endpoint, p256dh, auth
      FROM PushSubscription
      WHERE deliveryPersonId = ${deliveryPersonId}
    ` as any[]

    for (const sub of subscriptions) {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            title,
            body,
            url: url || "/",
            icon: "/icon-192.png",
          })
        )
      } catch (e: any) {
        // Subscription expired or invalid, remove it
        if (e.statusCode === 404 || e.statusCode === 410) {
          await prisma.$executeRaw`
            DELETE FROM PushSubscription WHERE endpoint = ${sub.endpoint}
          `.catch(() => {})
        }
      }
    }
  } catch {
    // Table might not exist yet, ignore
  }
}
