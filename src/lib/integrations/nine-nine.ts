import https from "https"
import { logger } from "@/lib/logger"

const NINE_NINE_API_BASE = "https://api.99app.com"

interface Estimativa99Response {
  success: boolean
  rideId?: string
  estimatedValue?: number
  estimatedTime?: number
  error?: string
}

interface Ping99Response {
  success: boolean
  message?: string
  error?: string
}

export async function validarCredenciais99(
  apiKey: string,
  employeeId: string
): Promise<Ping99Response> {
  return new Promise((resolve) => {
    const path = `/v1/employees/${employeeId}/ping`
    const options = {
      hostname: NINE_NINE_API_BASE.replace("https://", ""),
      path,
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept-Encoding": "identity",
      },
    }

    const req = https.request(options, (res) => {
      let body = ""
      res.on("data", (c) => (body += c))
      res.on("end", () => {
        try {
          if (res.statusCode && res.statusCode >= 400) {
            logger.error("99-ping", "resposta HTTP inesperada", { statusCode: res.statusCode, body: body?.slice(0, 300) })
            resolve({
              success: false,
              error: `HTTP ${res.statusCode}: ${body.slice(0, 200)}`,
            })
            return
          }
          const parsed = JSON.parse(body)
          resolve({ success: true, message: parsed.message || "Credenciais válidas" })
        } catch {
          logger.error("99-ping", "resposta não-JSON", { statusCode: res.statusCode, body: body?.slice(0, 200) })
          resolve({ success: false, error: "Erro ao processar resposta da 99" })
        }
      })
    })

    req.on("error", (err) => {
      logger.error("99-ping", "erro na requisição", { error: err?.message })
      resolve({ success: false, error: `Erro de conexão: ${err.message}` })
    })

    req.setTimeout(15000, () => req.destroy(new Error("99food timeout")))

    req.end()
  })
}

export async function buscarEstimativa99(
  apiKey: string,
  employeeId: string,
  origemLat: number,
  origemLng: number,
  destinoLat: number,
  destinoLng: number
): Promise<Estimativa99Response> {
  return new Promise((resolve) => {
    const path = `/v1/employees/${employeeId}/rides/estimate`
    const payload = JSON.stringify({
      origin: { latitude: origemLat, longitude: origemLng },
      destination: { latitude: destinoLat, longitude: destinoLng },
    })

    const options = {
      hostname: NINE_NINE_API_BASE.replace("https://", ""),
      path,
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "Accept-Encoding": "identity",
      },
    }

    const req = https.request(options, (res) => {
      let body = ""
      res.on("data", (c) => (body += c))
      res.on("end", () => {
        try {
          if (res.statusCode && res.statusCode >= 400) {
            logger.error("99-estimate", "resposta HTTP inesperada", { statusCode: res.statusCode, body: body?.slice(0, 300) })
            resolve({
              success: false,
              error: `HTTP ${res.statusCode}: ${body.slice(0, 200)}`,
            })
            return
          }
          const parsed = JSON.parse(body)
          resolve({
            success: true,
            rideId: parsed.rideId || parsed.id || null,
            estimatedValue: parsed.estimatedValue || parsed.price || parsed.fare || 0,
            estimatedTime: parsed.estimatedTime || parsed.duration || 0,
          })
        } catch {
          logger.error("99-estimate", "resposta não-JSON", { statusCode: res.statusCode, body: body?.slice(0, 200) })
          resolve({ success: false, error: "Erro ao processar estimativa da 99" })
        }
      })
    })

    req.on("error", (err) => {
      logger.error("99-estimate", "erro na requisição", { error: err?.message })
      resolve({ success: false, error: `Erro de conexão: ${err.message}` })
    })

    req.write(payload)
    req.setTimeout(15000, () => req.destroy(new Error("99food timeout")))
    req.end()
  })
}

export async function despacharCorrida99(
  apiKey: string,
  employeeId: string,
  origemLat: number,
  origemLng: number,
  destinoLat: number,
  destinoLng: number,
  pedidoId: string,
  pinCode: string
): Promise<Estimativa99Response> {
  return new Promise((resolve) => {
    const path = `/v1/employees/${employeeId}/rides`
    const payload = JSON.stringify({
      origin: { latitude: origemLat, longitude: origemLng },
      destination: { latitude: destinoLat, longitude: destinoLng },
      externalId: pedidoId,
      pinCode,
    })

    const options = {
      hostname: NINE_NINE_API_BASE.replace("https://", ""),
      path,
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "Accept-Encoding": "identity",
      },
    }

    const req = https.request(options, (res) => {
      let body = ""
      res.on("data", (c) => (body += c))
      res.on("end", () => {
        try {
          if (res.statusCode && res.statusCode >= 400) {
            logger.error("99-dispatch", "resposta HTTP inesperada", { statusCode: res.statusCode, body: body?.slice(0, 300) })
            resolve({
              success: false,
              error: `HTTP ${res.statusCode}: ${body.slice(0, 200)}`,
            })
            return
          }
          const parsed = JSON.parse(body)
          resolve({
            success: true,
            rideId: parsed.rideId || parsed.id || null,
            estimatedValue: parsed.estimatedValue || parsed.price || parsed.fare || 0,
            estimatedTime: parsed.estimatedTime || parsed.duration || 0,
          })
        } catch {
          logger.error("99-dispatch", "resposta não-JSON", { statusCode: res.statusCode, body: body?.slice(0, 200) })
          resolve({ success: false, error: "Erro ao despachar corrida na 99" })
        }
      })
    })

    req.on("error", (err) => {
      logger.error("99-dispatch", "erro na requisição", { error: err?.message })
      resolve({ success: false, error: `Erro de conexão: ${err.message}` })
    })

    req.write(payload)
    req.setTimeout(15000, () => req.destroy(new Error("99food timeout")))
    req.end()
  })
}

export async function buscarStatusCorrida99(
  apiKey: string,
  employeeId: string,
  rideId: string
): Promise<{ success: boolean; status?: string; link?: string; error?: string }> {
  return new Promise((resolve) => {
    const path = `/v1/employees/${employeeId}/rides/${rideId}`
    const options = {
      hostname: NINE_NINE_API_BASE.replace("https://", ""),
      path,
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept-Encoding": "identity",
      },
    }

    const req = https.request(options, (res) => {
      let body = ""
      res.on("data", (c) => (body += c))
      res.on("end", () => {
        try {
          if (res.statusCode && res.statusCode >= 400) {
            logger.error("99-status", "resposta HTTP inesperada", { statusCode: res.statusCode, body: body?.slice(0, 300) })
            resolve({ success: false, error: `HTTP ${res.statusCode}` })
            return
          }
          const parsed = JSON.parse(body)
          resolve({
            success: true,
            status: parsed.status || parsed.rideStatus || null,
            link: parsed.trackingUrl || parsed.trackingLink || null,
          })
        } catch {
          resolve({ success: false, error: "Erro ao consultar status da 99" })
        }
      })
    })

    req.on("error", (err) => {
      logger.error("99-status", "erro na requisição", { error: err?.message })
      resolve({ success: false, error: `Erro de conexão: ${err.message}` })
    })

    req.setTimeout(15000, () => req.destroy(new Error("99food timeout")))

    req.end()
  })
}
