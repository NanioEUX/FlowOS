import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text()
    console.log("[99food webhook] HIT", new Date().toISOString(), "body-len=", raw.length)

    const payload = JSON.parse(raw)
    console.log("[99food webhook] payload:", JSON.stringify(payload).slice(0, 500))

    return NextResponse.json({ ok: true, received: true })
  } catch (err: any) {
    console.error("[99food webhook] error:", err.message)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
