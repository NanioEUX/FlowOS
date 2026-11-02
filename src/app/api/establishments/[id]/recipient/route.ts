import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"
import { getPagarmeConfig } from "@/lib/pagarme-config"
import { getRequestId, logger } from "@/lib/logger"

export async function GET(
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

    const establishment = await prisma.establishment.findUnique({
      where: { id: params.id },
      select: { pagarmeSplitReceiverId: true },
    })

    if (!establishment?.pagarmeSplitReceiverId) {
      return NextResponse.json({ configured: false })
    }

    const config = await getPagarmeConfig()
    if (!config.apiKey) {
      return NextResponse.json({ error: "Pagar.me não configurado" }, { status: 500 })
    }

    const authHeader = `Basic ${Buffer.from(config.apiKey + ":").toString("base64")}`

    const res = await fetch(`https://api.pagar.me/core/v5/recipients/${establishment.pagarmeSplitReceiverId}`, {
      headers: { "Authorization": authHeader },
    })

    if (!res.ok) {
      return NextResponse.json({ configured: true, recipientId: establishment.pagarmeSplitReceiverId })
    }

    const data = await res.json()
    const bankAccount = data.default_bank_account || {}

    return NextResponse.json({
      configured: true,
      recipientId: data.id,
      name: data.name,
      email: data.email,
      document: data.document,
      bank: bankAccount.bank,
      branchNumber: bankAccount.branch_number,
      accountNumber: bankAccount.account_number,
      accountCheckDigit: bankAccount.account_check_digit,
      accountType: bankAccount.type,
      holderName: bankAccount.holder_name,
      status: data.status,
    })
  } catch (error: any) {
    logger.error("recipient-get", "falha em Recipient GET", { requestId: getRequestId(req), error: (error as any)?.message })
    return NextResponse.json({ error: "Erro ao buscar dados" }, { status: 500 })
  }
}

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
      // F4A-014: a resposta de erro do Pagar.me pode conter dados do titular — loga só o status.
      logger.error("pagarme-recipient", "erro do Pagar.me ao criar o recipient", { requestId: getRequestId(req), status: res?.status })
      return NextResponse.json({ error: data.message || data.errors?.[0]?.message || "Erro ao criar recipient" }, { status: 400 })
    }

    await prisma.establishment.update({
      where: { id: params.id },
      data: { pagarmeSplitReceiverId: data.id },
    })

    return NextResponse.json({ recipientId: data.id, status: data.status })
  } catch (error: any) {
    logger.error("recipient", "falha em Recipient", { requestId: getRequestId(req), error: (error as any)?.message })
    return NextResponse.json({ error: "Erro ao criar recipient" }, { status: 500 })
  }
}
