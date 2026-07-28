import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getIfoodAuth } from "@/lib/integrations/ifood"
import { updateIfoodStatus } from "@/lib/integrations/ifood-status"

export async function POST(req: NextRequest) {
  try {
    const { status, externalId } = await req.json()
    if (!externalId || !status) {
      return NextResponse.json({ error: "need status and externalId" })
    }

    const auth = await getIfoodAuth(
      process.env.IFOOD_CLIENT_ID!,
      process.env.IFOOD_CLIENT_SECRET!
    )
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "ifood auth failed" }, { status: 502 })
    }
    const accessToken = auth.accessToken

    const actionMap: Record<string, string> = {
      confirmed: "confirm",
      preparing: "confirm",
      dispatched: "dispatch",
      out_to_delivery: "dispatch",
      out_for_delivery: "dispatch",
      outfordelivery: "dispatch",
      delivered: "deliver",
      cancelled: "cancel",
    }
    const action = actionMap[status]
    if (!action) return NextResponse.json({ error: "no action for " + status })

    const result = await updateIfoodStatus(accessToken, "bd63685a-7c57-41c0-a52f-e6332cafcbd4", externalId, action)
    return NextResponse.json({ action, ...result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}
