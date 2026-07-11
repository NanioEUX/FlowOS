import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function DELETE() {
  try {
    await prisma.orderItem.deleteMany({})
    await prisma.order.deleteMany({})
    return NextResponse.json({ success: true, message: "Todos os pedidos foram apagados" })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}