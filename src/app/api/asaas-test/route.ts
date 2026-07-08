import { NextRequest, NextResponse } from "next/server"

const ASAAS_API_URL =
  process.env.ASAAS_ENVIRONMENT === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3"

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key")
  if (!key) {
    return NextResponse.json({ ok: false, error: "API Key não fornecida" }, { status: 400 })
  }

  try {
    const res = await fetch(`${ASAAS_API_URL}/customers?limit=1`, {
      headers: { access_token: key },
    })

    if (res.ok) {
      return NextResponse.json({ ok: true, message: "Conexão com Asaas OK" })
    }

    if (res.status === 401) {
      return NextResponse.json({ ok: false, error: "API Key inválida" })
    }

    return NextResponse.json({ ok: false, error: `Erro HTTP ${res.status}` })
  } catch {
    return NextResponse.json({ ok: false, error: "Falha ao conectar com Asaas" })
  }
}
