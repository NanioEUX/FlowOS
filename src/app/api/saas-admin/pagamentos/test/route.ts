import { NextResponse } from "next/server"
import { getSaasAdmin } from "@/lib/saas-admin-auth"
import { getPagarmeConfig } from "@/lib/pagarme-config"

export async function GET() {
  const admin = await getSaasAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, message: "Não autorizado" }, { status: 401 })
  }

  try {
    const config = await getPagarmeConfig()
    if (!config.apiKey) {
      return NextResponse.json({ ok: false, message: "API Key não configurada" })
    }

    // Test by fetching a non-existent order (just to validate the key)
    const authHeader = `Basic ${Buffer.from(config.apiKey + ":").toString("base64")}`
    const res = await fetch("https://api.pagar.me/core/v5/orders?limit=1", {
      headers: { "Authorization": authHeader },
    })

    if (res.ok) {
      return NextResponse.json({ ok: true, message: "Conexão com Pagar.me OK! API Key válida." })
    } else if (res.status === 401) {
      return NextResponse.json({ ok: false, message: "API Key inválida ou expirada" })
    } else {
      const error = await res.text()
      return NextResponse.json({ ok: false, message: `Erro ${res.status}: ${error}` })
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: `Erro de conexão: ${e.message}` })
  }
}
