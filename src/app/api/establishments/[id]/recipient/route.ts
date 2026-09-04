import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"
import { getPagarmeConfig } from "@/lib/pagarme-config"

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    if (authUser.establishmentId !== params.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
    }

    const body = await req.json()
    const {
      name, email, document, type,
      bank, branchNumber, accountNumber, accountCheckDigit, accountType,
      holderName, holderDocument, holderType,
    } = body

    if (!name || !email || !document || !bank || !branchNumber || !accountNumber || !accountCheckDigit) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

    const config = await getPagarmeConfig()
    if (!config.apiKey) {
      return NextResponse.json({ error: "Pagar.me não configurado" }, { status: 500 })
    }

    const authHeader = `Basic ${Buffer.from(config.apiKey + ":").toString("base64")}`

    const recipientData = {
      name,
      email,
      description: `Subconta - ${name}`,
      document: document.replace(/\D/g, ""),
      type: type || (document.replace(/\D/g, "").length === 11 ? "individual" : "company"),
      default_bank_account: {
        holder_name: holderName || name,
        holder_type: holderType || (document.replace(/\D/g, "").length === 11 ? "individual" : "company"),
        holder_document: (holderDocument || document).replace(/\D/g, ""),
        bank: bank.replace(/\D/g, ""),
        branch_number: branchNumber.replace(/\D/g, ""),
        account_number: accountNumber.replace(/\D/g, ""),
        account_check_digit: accountCheckDigit.replace(/\D/g, ""),
        type: accountType || "checking",
      },
      transfer_settings: {
        transfer_enabled: true,
        transfer_interval: "Daily",
        transfer_day: 0,
      },
      automatic_anticipation_settings: {
        enabled: false,
      },
    }

    const res = await fetch("https://api.pagar.me/core/v5/recipients", {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(recipientData),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error("[Recipient] Erro Pagar.me:", JSON.stringify(data))
      return NextResponse.json({ error: data.message || data.errors?.[0]?.message || "Erro ao criar recipient" }, { status: 400 })
    }

    await prisma.establishment.update({
      where: { id: params.id },
      data: { pagarmeSplitReceiverId: data.id },
    })

    return NextResponse.json({ recipientId: data.id, status: data.status })
  } catch (error: any) {
    console.error("[Recipient] Error:", error.message)
    return NextResponse.json({ error: "Erro ao criar recipient" }, { status: 500 })
  }
}
