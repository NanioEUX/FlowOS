import https from "https"
import crypto from "crypto"

const EFI_URLS = {
  sandbox: "https://apis-h.efipay.com.br",
  production: "https://api.efipay.com.br",
}

interface EfiConfig {
  clientId: string
  clientSecret: string
  certificate: string // base64 .p12 certificate
  environment: "sandbox" | "production"
}

interface EfiPixCharge {
  txid: string
  status: string
  pixCopiaECola: string
  location: string
  valor: string
  expiracao: number
}

let cachedToken: { token: string; expiresAt: number } | null = null

function getBaseUrl(env: string) {
  return EFI_URLS[env as keyof typeof EFI_URLS] || EFI_URLS.sandbox
}

function createHttpsAgent(certBase64: string) {
  const certBuffer = Buffer.from(certBase64, "base64")
  return new https.Agent({
    pfx: certBuffer,
    passphrase: "",
    rejectUnauthorized: false,
  })
}

export async function getEfiToken(config: EfiConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token
  }

  const baseUrl = getBaseUrl(config.environment)
  const agent = createHttpsAgent(config.certificate)

  const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")

  return new Promise((resolve, reject) => {
    const req = https.request(
      `${baseUrl}/oauth/token`,
      {
        method: "POST",
        agent,
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      },
      (res) => {
        let data = ""
        res.on("data", (chunk) => (data += chunk))
        res.on("end", () => {
          try {
            const json = JSON.parse(data)
            if (json.access_token) {
              cachedToken = {
                token: json.access_token,
                expiresAt: Date.now() + json.expires_in * 1000,
              }
              resolve(json.access_token)
            } else {
              reject(new Error(`Efi auth failed: ${data}`))
            }
          } catch (e) {
            reject(new Error(`Efi auth parse error: ${data}`))
          }
        })
      }
    )
    req.on("error", reject)
    req.write(JSON.stringify({ grant_type: "client_credentials" }))
    req.end()
  })
}

export async function efiRequest(
  config: EfiConfig,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<any> {
  const token = await getEfiToken(config)
  const baseUrl = getBaseUrl(config.environment)
  const agent = createHttpsAgent(config.certificate)

  return new Promise((resolve, reject) => {
    const req = https.request(
      `${baseUrl}${path}`,
      {
        method,
        agent,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
      (res) => {
        let data = ""
        res.on("data", (chunk) => (data += chunk))
        res.on("end", () => {
          try {
            resolve(JSON.parse(data))
          } catch {
            resolve(data)
          }
        })
      }
    )
    req.on("error", reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

export async function createEfiPixCharge(
  config: EfiConfig,
  {
    amount,
    description,
    expiration = 3600,
    txid,
  }: {
    amount: number
    description: string
    expiration?: number
    txid?: string
  }
): Promise<EfiPixCharge> {
  const path = txid ? `/v2/cob/${txid}` : "/v2/cob"
  const method = txid ? "PUT" : "POST"

  const body: Record<string, unknown> = {
    calendario: { expiracao: expiration },
    valor: { original: amount.toFixed(2) },
    chave: "",
    solicitacaoPagador: description.substring(0, 140),
  }

  const response = await efiRequest(config, method, path, body)

  if (response.nome) {
    throw new Error(`Efi error: ${response.nome} - ${response.mensagem}`)
  }

  return {
    txid: response.txid,
    status: response.status,
    pixCopiaECola: response.pixCopiaECola || "",
    location: response.location || "",
    valor: response.valor?.original || amount.toFixed(2),
    expiracao: response.calendario?.expiracao || expiration,
  }
}

export async function getEfiPixCharge(
  config: EfiConfig,
  txid: string
): Promise<EfiPixCharge> {
  const response = await efiRequest(config, "GET", `/v2/cob/${txid}`)

  if (response.nome) {
    throw new Error(`Efi error: ${response.nome} - ${response.mensagem}`)
  }

  return {
    txid: response.txid,
    status: response.status,
    pixCopiaECola: response.pixCopiaECola || "",
    location: response.location || "",
    valor: response.valor?.original || "0",
    expiracao: response.calendario?.expiracao || 0,
  }
}

export function verifyEfiWebhook(
  token: string,
  webhookToken: string
): boolean {
  if (!token || !webhookToken) return false
  const a = Buffer.from(token)
  const b = Buffer.from(webhookToken)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export function parseEfiWebhookStatus(
  pixStatus: string
): { paymentStatus: string; orderStatus: string } {
  const statusMap: Record<string, { paymentStatus: string; orderStatus: string }> = {
    ATIVA: { paymentStatus: "pending", orderStatus: "payment_pending" },
    PAGA: { paymentStatus: "paid", orderStatus: "confirmed" },
    CONCLUIDA: { paymentStatus: "paid", orderStatus: "confirmed" },
    REMOVIDA_PELO_USUARIO_RECEBEDOR: { paymentStatus: "cancelled", orderStatus: "cancelled" },
    REMOVIDA_PELO_PAGADOR: { paymentStatus: "cancelled", orderStatus: "cancelled" },
  }

  return statusMap[pixStatus] || { paymentStatus: "pending", orderStatus: "payment_pending" }
}
