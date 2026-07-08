import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json()
    if (!key) {
      return NextResponse.json({ ok: false, error: "API Key não fornecida" }, { status: 400 })
    }

    const envVar = process.env.ASAAS_ENVIRONMENT
    const urls = envVar === "production"
      ? ["https://api.asaas.com/v3"]
      : envVar === "sandbox"
        ? ["https://sandbox.asaas.com/api/v3"]
        : ["https://api.asaas.com/v3", "https://sandbox.asaas.com/api/v3"]

    for (const baseUrl of urls) {
      try {
        const res = await fetch(`${baseUrl}/myAccount`, {
          headers: { access_token: key },
        })

        const data = await res.json()

        if (res.ok && data.name) {
          const envName = baseUrl.includes("sandbox") ? "sandbox" : "produção"
          return NextResponse.json({ ok: true, message: `Conexão OK — ${data.name} (${envName})` })
        }
      } catch {
        continue
      }
    }

    return NextResponse.json({ ok: false, error: "API Key inválida em ambos os ambientes" })
  } catch {
    return NextResponse.json({ ok: false, error: "Erro ao processar requisição" })
  }
}
