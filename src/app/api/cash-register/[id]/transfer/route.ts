import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Autenticação necessária" }, { status: 401 })
    }

    const { toUserId, amount, notes } = await req.json()

    if (!toUserId || amount === undefined || amount === null) {
      return NextResponse.json({ error: "Usuário de destino e valor são obrigatórios" }, { status: 400 })
    }

    // Get current cash register
    const cashRegister = await prisma.cashRegister.findUnique({
      where: { id: params.id },
      include: { transfers: { orderBy: { createdAt: "desc" }, take: 1 } },
    })

    if (!cashRegister) {
      return NextResponse.json({ error: "Caixa não encontrado" }, { status: 404 })
    }

    if (cashRegister.status !== "open") {
      return NextResponse.json({ error: "Caixa não está aberto" }, { status: 400 })
    }

    // Verify the user is the current cashier or has admin permission
    if (cashRegister.currentUserId && cashRegister.currentUserId !== authUser.userId) {
      // Check if user has admin permission
      const user = await prisma.user.findUnique({
        where: { id: authUser.userId },
        select: { permissions: true },
      })
      const permissions = JSON.parse(user?.permissions || "[]")
      if (!permissions.includes("admin") && !permissions.includes("config")) {
        return NextResponse.json({ error: "Apenas o caixa atual ou administrador pode transferir" }, { status: 403 })
      }
    }

    // Verify destination user exists and belongs to same establishment
    const toUser = await prisma.user.findUnique({
      where: { id: toUserId },
      select: { id: true, name: true, establishmentId: true },
    })

    if (!toUser || toUser.establishmentId !== authUser.establishmentId) {
      return NextResponse.json({ error: "Usuário de destino inválido" }, { status: 400 })
    }

    // Create transfer record
    const transfer = await prisma.cashTransfer.create({
      data: {
        cashRegisterId: cashRegister.id,
        fromUserId: authUser.userId,
        toUserId,
        amount: parseFloat(amount.toString()),
        notes: notes || null,
      },
    })

    // Update current user of cash register
    await prisma.cashRegister.update({
      where: { id: cashRegister.id },
      data: { currentUserId: toUserId },
    })

    return NextResponse.json({
      message: "Transferência realizada com sucesso",
      transfer,
      newCashier: toUser.name,
    })
  } catch (error) {
    console.error("[CASH REGISTER TRANSFER]", error)
    return NextResponse.json({ error: "Erro ao transferir caixa" }, { status: 500 })
  }
}
