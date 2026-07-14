import https from "https"
import http from "http"
import tls from "tls"
import crypto from "crypto"

const INTER_AUTH_URL = "https://cdpj.partners.bancointer.com.br/oauth/v1/token"
const INTER_API_BASE = "https://cdpj.partners.bancointer.com.br"

// Token cache per establishment
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

interface InterConfig {
  clientId: string
  clientSecret: string
  certificate: string // base64 .p12
}

function createAgent(config: InterConfig): https.Agent {
  const pfxBuffer = Buffer.from(config.certificate, "base64")
  return new https.Agent({
    pfx: pfxBuffer,
    passphrase: "",
    rejectUnauthorized: true,
  })
}

export async function getInterToken(config: InterConfig): Promise<string> {
  const cacheKey = config.clientId
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now() + 60000) {
    return cached.token
  }

  const agent = createAgent(config)
  const body = new URLSearchParams({
    grant_type: "client_credentials",
  }).toString()

  return new Promise((resolve, reject) => {
    const req = https.request(INTER_AUTH_URL, {
      method: "POST",
      agent,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      },
    }, (res) => {
      let data = ""
      res.on("data", (chunk) => { data += chunk })
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data)
          if (parsed.access_token) {
            const expiresIn = (parsed.expires_in || 3600) * 1000
            tokenCache.set(cacheKey, {
              token: parsed.access_token,
              expiresAt: Date.now() + expiresIn,
            })
            resolve(parsed.access_token)
          } else {
            reject(new Error(`Inter auth failed: ${data}`))
          }
        } catch (e) {
          reject(new Error(`Inter auth parse error: ${data}`))
        }
      })
    })
    req.on("error", reject)
    req.write(body)
    req.end()
  })
}

function generateTxId(orderId: string, orderNumber: number): string {
  const raw = `flo${orderId.substring(0, 12)}${orderNumber}`
  return raw.replace(/[^a-zA-Z0-9]/g, "").substring(0, 35)
}

export async function createInterPixCharge(
  config: InterConfig,
  {
    value,
    txid,
    description,
    pixKey,
  }: {
    value: number
    txid: string
    description: string
    pixKey: string
  }
): Promise<{ txid: string; status: string }> {
  const token = await getInterToken(config)
  const agent = createAgent(config)

  const body = JSON.stringify({
    calendario: { expiracao: 3600 },
    valor: { original: value.toFixed(2) },
    chave: pixKey,
    solicitacaoPagador: description.substring(0, 140),
  })

  const url = `${INTER_API_BASE}/pix/v2/cobrancas/${txid}`

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: "PUT",
      agent,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }, (res) => {
      let data = ""
      res.on("data", (chunk) => { data += chunk })
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data)
          if (parsed.txid) {
            resolve({ txid: parsed.txid, status: parsed.status || "ATIVA" })
          } else {
            reject(new Error(`Inter PIX charge failed: ${data}`))
          }
        } catch (e) {
          reject(new Error(`Inter PIX parse error: ${data}`))
        }
      })
    })
    req.on("error", reject)
    req.write(body)
    req.end()
  })
}

export async function getInterPixQrCode(
  config: InterConfig,
  txid: string
): Promise<{ image: string; payload: string }> {
  const token = await getInterToken(config)
  const agent = createAgent(config)
  const url = `${INTER_API_BASE}/pix/v2/cobrancas/${txid}/qrcode`

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: "GET",
      agent,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }, (res) => {
      let data = ""
      res.on("data", (chunk) => { data += chunk })
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data)
          if (parsed.imagemBase64 || parsed.payload) {
            resolve({
              image: parsed.imagemBase64 || "",
              payload: parsed.payload || "",
            })
          } else {
            reject(new Error(`Inter QR Code failed: ${data}`))
          }
        } catch (e) {
          reject(new Error(`Inter QR Code parse error: ${data}`))
        }
      })
    })
    req.on("error", reject)
    req.end()
  })
}

export async function getInterPixStatus(
  config: InterConfig,
  txid: string
): Promise<{ status: string; pagador?: any }> {
  const token = await getInterToken(config)
  const agent = createAgent(config)
  const url = `${INTER_API_BASE}/pix/v2/cobrancas/${txid}`

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: "GET",
      agent,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }, (res) => {
      let data = ""
      res.on("data", (chunk) => { data += chunk })
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data)
          resolve({
            status: parsed.status || "UNKNOWN",
            pagador: parsed.pagador,
          })
        } catch (e) {
          reject(new Error(`Inter PIX status error: ${data}`))
        }
      })
    })
    req.on("error", reject)
    req.end()
  })
}

export function generateInterTxId(orderId: string, orderNumber: number): string {
  return generateTxId(orderId, orderNumber)
}
