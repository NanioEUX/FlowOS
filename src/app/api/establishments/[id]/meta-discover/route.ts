import { NextRequest, NextResponse } from "next/server"
import { requireEstablishment } from "@/lib/require-auth"
import { redactObject } from "@/lib/redact"
import { getRequestId, logger } from "@/lib/logger"

const META_APP_ID = process.env.META_APP_ID
const META_APP_SECRET = process.env.META_APP_SECRET

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const requestId = getRequestId(req)

    const auth = requireEstablishment(req, id)
    if (auth.error) return auth.error

    const body = await req.json()
    const { code, redirectUri } = body

    logger.info("meta-discover", "início do fluxo de descoberta", { requestId, establishmentId: id, hasCode: !!code, codeLength: code?.length || 0, redirectUri })

    if (!code) {
      return NextResponse.json({ success: false, error: "Codigo nao fornecido" }, { status: 400 })
    }

    if (!META_APP_ID || !META_APP_SECRET) {
      logger.error("meta-discover", "META_APP_ID ou META_APP_SECRET não configurados", { requestId, establishmentId: id })
      return NextResponse.json({ success: false, error: "META_APP_ID e META_APP_SECRET nao configurados" }, { status: 500 })
    }

    logger.info("meta-discover", "META_APP_ID carregado", { requestId, establishmentId: id, appId: META_APP_ID })

    // Detect if the input is already a token (not a code)
    const isToken = code.length > 80 || code.startsWith("EAA")
    let accessToken: string

    if (isToken) {
      logger.info("meta-discover", "a entrada já é um access token — troca ignorada", { requestId, establishmentId: id, length: code.length })
      accessToken = code
    } else {
      const origin = redirectUri ? new URL(redirectUri).origin : "https://flowoshub.com"
      const redirectUris = [
        origin,
        origin + "/",
        "https://www.facebook.com/connect/login/success.html",
        "",
      ]

      logger.info("meta-discover", "tentando redirect URIs", { requestId, establishmentId: id, redirectUris })

      let shortToken: string | null = null
      for (const uri of redirectUris) {
        logger.info("meta-discover", "tentando URI", { requestId, establishmentId: id, uri })
        const tokenRes = await fetch(
          "https://graph.facebook.com/v21.0/oauth/access_token?client_id=" + META_APP_ID + "&client_secret=" + META_APP_SECRET + "&redirect_uri=" + encodeURIComponent(uri) + "&code=" + code,
          { method: "GET" }
        )
        const tokenData = await tokenRes.json()
        // F4A-014: o access_token da Meta (longo, de todos os tenants) não pode
      // aparecer no log — só as chaves e o status da resposta.
      logger.info("meta-discover", "resposta da troca de token", { requestId, establishmentId: id, response: redactObject(tokenData) })
        if (tokenRes.ok && tokenData.access_token && tokenData.access_token.length < 300) {
          shortToken = tokenData.access_token as string
          logger.info("meta-discover", "token curto obtido", { requestId, establishmentId: id, uri, tokenLength: shortToken.length })
          break
        } else {
          logger.warn("meta-discover", "troca de token falhou para a URI", { requestId, establishmentId: id, uri, error: tokenData?.error?.message })
        }
      }

      if (!shortToken) {
        logger.error("meta-discover", "todas as tentativas de troca de token falharam", { requestId, establishmentId: id })
        return NextResponse.json({ success: false, error: "Falha ao trocar codigo por token" }, { status: 400 })
      }

      logger.info("meta-discover", "trocando token curto por token longo", { requestId, establishmentId: id, tokenLength: shortToken.length })
      const longTokenRes = await fetch(
        "https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=" + META_APP_ID + "&client_secret=" + META_APP_SECRET + "&fb_exchange_token=" + shortToken,
        { method: "GET" }
      )
      const longTokenData = await longTokenRes.json()
      logger.info("meta-discover", "resposta da troca pelo token longo", { requestId, establishmentId: id, response: redactObject(longTokenData) })

      if (longTokenData.access_token && longTokenData.access_token.length < 300) {
        accessToken = longTokenData.access_token
        logger.info("meta-discover", "usando token de longa duração", { requestId, establishmentId: id, tokenLength: accessToken.length })
      } else {
        accessToken = shortToken
        logger.warn("meta-discover", "troca pelo token longo retornou token inválido — usando o curto", { requestId, establishmentId: id, tokenLength: accessToken.length })
      }
    }

    logger.info("meta-discover", "token final obtained", { requestId, establishmentId: id, tokenLength: accessToken.length })

    const phones: Array<{ id: string; display_phone_number: string; verified_name: string; waba_id: string }> = []

    const headers = { Authorization: "Bearer " + accessToken }

    // Method 1: Direct WABAs
    logger.info("meta-discover", "método 1: WABAs diretas", { requestId, establishmentId: id })
    const wabaRes = await fetch(
      "https://graph.facebook.com/v21.0/me/whatsapp_business_accounts?fields=id,name,account_review_status",
      { headers }
    )
    const wabaData = await wabaRes.json()
    logger.info("meta-discover", "resposta da busca de WABAs diretas", { requestId, establishmentId: id, count: wabaData?.data?.length || 0, error: wabaData?.error?.message })

    if (wabaData.data && wabaData.data.length > 0) {
      logger.info("meta-discover", "WABAs diretas encontradas", { requestId, establishmentId: id, count: wabaData.data.length })
      for (const waba of wabaData.data) {
        logger.info("meta-discover", "buscando telefones da WABA", { requestId, establishmentId: id, wabaId: waba.id })
        const phoneRes = await fetch(
          "https://graph.facebook.com/v21.0/" + waba.id + "/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating&limit=100",
          { headers }
        )
        const phoneData = await phoneRes.json()
        logger.info("meta-discover", "telefones da WABA", { requestId, establishmentId: id, wabaId: waba.id, count: phoneData?.data?.length || 0, error: phoneData?.error?.message })
        if (phoneData.data) {
          for (const phone of phoneData.data) {
            logger.info("meta-discover", "telefone adicionado à lista", { requestId, establishmentId: id, phoneId: phone.id })
            phones.push({
              id: phone.id,
              display_phone_number: phone.display_phone_number,
              verified_name: phone.verified_name || waba.name,
              waba_id: waba.id,
            })
          }
        } else {
          logger.info("meta-discover", "WABA sem telefones", { requestId, establishmentId: id, wabaId: waba.id })
        }
      }
    } else {
      logger.info("meta-discover", "nenhuma WABA direta encontrada", { requestId, establishmentId: id })
      if (wabaData.error) {
        logger.warn("meta-discover", "erro na busca de WABAs", { requestId, establishmentId: id, error: wabaData?.error?.message })
      }
    }

    // Method 2: Via business accounts (if no phones found yet)
    if (phones.length === 0) {
      logger.info("meta-discover", "método 2: via business accounts", { requestId, establishmentId: id })
      const bizRes = await fetch(
        "https://graph.facebook.com/v21.0/me?fields=businesses{id,name}",
        { headers }
      )
      const bizData = await bizRes.json()
      logger.info("meta-discover", "resposta da busca de business accounts", { requestId, establishmentId: id, count: bizData?.businesses?.data?.length || 0 })

      const businesses = bizData.businesses?.data || []
      logger.info("meta-discover", "business accounts encontrados", { requestId, establishmentId: id, count: businesses.length })
      for (const biz of businesses) {
        logger.info("meta-discover", "buscando WABAs do business account", { requestId, establishmentId: id, businessId: biz.id })
        const bizWabaRes = await fetch(
          "https://graph.facebook.com/v21.0/" + biz.id + "/owned_whatsapp_business_accounts?fields=id,name,account_review_status&limit=100",
          { headers }
        )
        const bizWabaData = await bizWabaRes.json()
        logger.info("meta-discover", "WABAs do business account", { requestId, establishmentId: id, businessId: biz.id, count: bizWabaData?.data?.length || 0, error: bizWabaData?.error?.message })

        if (bizWabaData.data) {
          for (const waba of bizWabaData.data) {
            logger.info("meta-discover", "buscando telefones da WABA do business", { requestId, establishmentId: id, wabaId: waba.id })
            const phoneRes = await fetch(
              "https://graph.facebook.com/v21.0/" + waba.id + "/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating&limit=100",
              { headers }
            )
            const phoneData = await phoneRes.json()
            logger.info("meta-discover", "telefones da WABA do business", { requestId, establishmentId: id, wabaId: waba.id, count: phoneData?.data?.length || 0, error: phoneData?.error?.message })
            if (phoneData.data) {
              for (const phone of phoneData.data) {
                logger.info("meta-discover", "telefone adicionado à lista", { requestId, establishmentId: id, phoneId: phone.id })
                phones.push({
                  id: phone.id,
                  display_phone_number: phone.display_phone_number,
                  verified_name: phone.verified_name || waba.name,
                  waba_id: waba.id,
                })
              }
            }
          }
        }
      }
    }

    // Method 3: Shared WABAs via app (if still nothing)
    if (phones.length === 0) {
      logger.info("meta-discover", "método 3: WABAs compartilhadas via debug_token", { requestId, establishmentId: id })
      const debugRes = await fetch(
        "https://graph.facebook.com/v21.0/debug_token?input_token=" + accessToken + "&access_token=" + META_APP_ID + "|" + META_APP_SECRET,
        { method: "GET" }
      )
      const debugData = await debugRes.json()
      logger.info("meta-discover", "resposta do debug_token", { requestId, establishmentId: id, response: redactObject(debugData) })

      if (debugData.data?.grant_info?.scopes) {
        logger.info("meta-discover", "scopes do token", { requestId, establishmentId: id, scopes: debugData.data.grant_info.scopes })
      }
    }

    logger.info("meta-discover", "resultado da descoberta", { requestId, establishmentId: id, totalPhones: phones.length })

    return NextResponse.json({
      success: true,
      accessToken,
      phones,
    })
  } catch (error: any) {
    logger.error("meta-discover", "erro no fluxo de descoberta da Meta", { requestId: getRequestId(req), error: error?.message, stack: error?.stack })
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
