import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

// Restricted endpoint: only deletes orders for the authenticated user's
// establishment. Used to wipe test data; production-safe.
export async function DELETE(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  try {
    const result = await prisma.order.deleteMany({
      where: { establishmentId: auth.establishmentId },
    })
    return NextResponse.json({ success: true, deleted: result.count })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}