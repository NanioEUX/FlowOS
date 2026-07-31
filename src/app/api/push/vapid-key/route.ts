import { NextResponse } from "next/server"
import { getVapidPublicKey } from "@/lib/push"

export async function GET() {
  const key = getVapidPublicKey()
  if (!key) {
    return NextResponse.json({ error: "VAPID não configurado" }, { status: 500 })
  }
  return NextResponse.json({ publicKey: key })
}
