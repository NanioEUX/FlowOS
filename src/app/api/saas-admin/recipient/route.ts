import { NextRequest, NextResponse } from "next/server"
import { getSaasAdmin } from "@/lib/saas-admin-auth"
import { prisma } from "@/lib/prisma"
import { getPagarmeConfig } from "@/lib/pagarme-config"

export async function GET() {
  const admin = await getSaasAdmin()
  if (!admin) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const config = await getPagarmeConfig()
    const recipientId = config.saasRecipientId
    if (!recipientId) {
      return NextResponse.json({ error: "Recipient SaaS não configurado" }, { status: 404 })
    }

    const res = await fetch(`https://api.pagar.me/core/v5/recipients/${recipientId}`, {
      headers: { Authorization: `Basic ${Buffer.from(config.apiKey + ":").toString("base64")}` },
    })
    const data = await res.json()

    return NextResponse.json({
      ok: true,
      recipientId: data.id,
      name: data.name,
      document: data.document,
      status: data.status,
      bankAccount: data.default_bank_account || null,
      transferSettings: data.transfer_settings || null,
    })
  } catch (error: any) {
    console.error("[SaasAdmin Recipient GET]", error)
    return NextResponse.json({ error: "Erro ao buscar recipient" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await getSaasAdmin()
  if (!admin) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const config = await getPagarmeConfig()
    const recipientId = config.saasRecipientId
    if (!recipientId) {
      return NextResponse.json({ error: "Recipient SaaS não configurado" }, { status: 404 })
    }

    const body = await req.json()
    const { bankAccount } = body

    const updateData: any = {}

    if (bankAccount) {
      updateData.default_bank_account = {
        holder_name: bankAccount.holderName,
        holder_type: bankAccount.holderType || "company",
        holder_document: bankAccount.holderDocument,
        bank: bankAccount.bank,
        branch_number: bankAccount.branchNumber,
        account_number: bankAccount.accountNumber,
        account_check_digit: bankAccount.accountCheckDigit,
        type: bankAccount.type || "checking",
      }
    }

    if (body.transferSettings) {
      updateData.transfer_settings = {
        transfer_enabled: body.transferSettings.transferEnabled,
        transfer_interval: body.transferSettings.transferInterval || "daily",
        transfer_day: body.transferSettings.transferDay || 0,
      }
    }

    const res = await fetch(`https://api.pagar.me/core/v5/recipients/${recipientId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Basic ${Buffer.from(config.apiKey + ":").toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateData),
    })

    const text = await res.text()
    let data: any
    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: `Pagar.me retornou: ${text.substring(0, 200)}` }, { status: 500 })
    }

    if (!res.ok) {
      return NextResponse.json({ error: data.message || data.errors?.[0]?.message || "Erro ao atualizar recipient" }, { status: 400 })
    }

    return NextResponse.json({ ok: true, recipientId: data.id, status: data.status })
  } catch (error: any) {
    console.error("[SaasAdmin Recipient PATCH]", error)
    return NextResponse.json({ error: "Erro ao atualizar recipient" }, { status: 500 })
  }
}
