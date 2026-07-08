import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createPaymentLink } from "@/lib/integrations/asaas"

export async function POST(req: NextRequest) {
  try {
    const { establishmentId, amount, description } = await req.json()

    if (!establishmentId || !amount) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

    const establishment = await prisma.establishment.findUnique({
      where: { id: establishmentId },
      select: { id: true, name: true, asaasApiKey: true, asaasWalletId: true },
    })

    if (!establishment) {
      return NextResponse.json({ error: "Estabelecimento não encontrado" }, { status: 404 })
    }

    // If Asaas is configured, create a payment link with Pix
    if (establishment.asaasApiKey) {
      const payment = await createPaymentLink({
        apiKey: establishment.asaasApiKey,
        customerName: description || `${establishment.name} - Mesa`,
        customerPhone: "00000000000",
        customerCpf: "",
        value: amount,
        description: description || `${establishment.name} - Pagamento`,
      })

      return NextResponse.json({
        success: true,
        invoiceUrl: payment.invoiceUrl,
        paymentId: payment.id,
      })
    }

    // Fallback: generate a simple Pix payload (static QR)
    // In production, this should use a proper Pix API
    return NextResponse.json({
      success: true,
      message: "Configure o Asaas para gerar link de pagamento",
      amount,
    })
  } catch (error) {
    console.error("Erro ao gerar Pix:", error)
    return NextResponse.json({ error: "Erro ao gerar pagamento" }, { status: 500 })
  }
}
