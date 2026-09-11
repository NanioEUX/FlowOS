import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || process.env.META_APP_ID
const META_APP_SECRET = process.env.META_APP_SECRET

async function exchangeCodeForToken(code: string, redirectUri?: string): Promise<{ token: string | null, debug: string[] }> {
  const debug: string[] = []
  if (!META_APP_ID || !META_APP_SECRET) {
    debug.push("META_APP_ID or META_APP_SECRET not set")
    return { token: null, debug }
  }
  const origin = redirectUri ? new URL(redirectUri).origin : "https://flowoshub.com"
  const redirectUris = [
    origin + "/",
    origin,
    "https://www.facebook.com/connect/login/success.html",
    "",
  ]

  for (const uri of redirectUris) {
    try {
      const url = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&redirect_uri=${encodeURIComponent(uri)}&code=${code}`
      const res = await fetch(url, { method: "GET" })
      const data = await res.json()
      const msg = `URI="${uri}" status=${res.status} ok=${res.ok} hasToken=${!!data.access_token} error=${data.error?.message || "none"}`
      debug.push(msg)
      console.log("[Token Exchange]", msg)
      if (res.ok && data.access_token && data.access_token.startsWith("EAA")) {
        return { token: data.access_token, debug }
      }
    } catch (e: any) {
      debug.push(`URI="${uri}" exception=${e.message}`)
    }
  }
  return { token: null, debug }
}

async function exchangeForLongLivedToken(shortToken: string): Promise<{ token: string | null, debug: string }> {
  if (!META_APP_ID || !META_APP_SECRET) return { token: null, debug: "no app credentials" }
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${shortToken}`,
      { method: "GET" }
    )
    const data = await res.json()
    const debug = `status=${res.status} hasToken=${!!data.access_token} error=${data.error?.message || "none"}`
    console.log("[Token Exchange] Long token:", debug)
    if (data.access_token && data.access_token.startsWith("EAA")) {
      return { token: data.access_token, debug }
    }
    return { token: null, debug }
  } catch (e: any) {
    return { token: null, debug: e.message }
  }
}

async function debugToken(token: string): Promise<any> {
  if (!META_APP_ID || !META_APP_SECRET) return null
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(token)}&access_token=${META_APP_ID}|${META_APP_SECRET}`
    )
    const data = await res.json()
    return data.data || null
  } catch {
    return null
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await req.json()
    const { code, phoneNumberId, wabaId, businessId: clientBusinessId, redirectUri, accessToken: existingToken } = body

    console.log("[Meta Embedded Signup] ========== START ==========")
    console.log("[Meta Embedded Signup] Establishment ID:", id)
    console.log("[Meta Embedded Signup] Code:", !!code, "len:", code?.length, "prefix:", code?.substring(0, 10))
    console.log("[Meta Embedded Signup] existingToken:", !!existingToken, "starts:", existingToken?.substring(0, 10))

    let accessToken: string | null = null
    let tokenSource = "none"
    const allDebug: string[] = []

    // PATH 1: Exchange code for fresh USER token (preferred)
    if (code && code !== "no_code" && code.length > 10) {
      allDebug.push("PATH 1: code exchange")
      const { token: shortToken, debug: codeDebug } = await exchangeCodeForToken(code, redirectUri)
      allDebug.push(...codeDebug)

      if (shortToken) {
        const { token: longToken, debug: longDebug } = await exchangeForLongLivedToken(shortToken)
        allDebug.push("long_exchange: " + longDebug)
        if (longToken) {
          accessToken = longToken
          tokenSource = "code_exchange_long"
        } else {
          accessToken = shortToken
          tokenSource = "code_exchange_short"
        }
      } else {
        allDebug.push("code exchange FAILED for all URIs")
      }
    } else {
      allDebug.push("PATH 1 skipped: no valid code (code=" + (code || "null") + " len=" + (code?.length || 0) + ")")
    }

    // PATH 2: If code exchange failed, try existingToken
    if (!accessToken && existingToken && existingToken.startsWith("EAA")) {
      allDebug.push("PATH 2: existingToken exchange")
      const { token: longToken, debug: longDebug } = await exchangeForLongLivedToken(existingToken)
      allDebug.push("existing_exchange: " + longDebug)
      if (longToken) {
        accessToken = longToken
        tokenSource = "existing_exchange_long"
      } else {
        allDebug.push("existing exchange FAILED, using raw token")
        accessToken = existingToken
        tokenSource = "existing_raw"
      }
    }

    // Debug token type
    if (accessToken) {
      const info = await debugToken(accessToken)
      allDebug.push(`final_token: type=${info?.type} expires=${info?.expires_at} issued=${info?.issued_at}`)
      console.log("[Meta Embedded Signup] Final token:", JSON.stringify(info, null, 2))
    } else {
      allDebug.push("NO TOKEN OBTAINED")
    }

    // Get phone display info
    let displayPhone = ""
    if (accessToken && phoneNumberId) {
      try {
        const phoneRes = await fetch(
          `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=display_phone_number,verified_name`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        const phoneInfo = await phoneRes.json()
        displayPhone = phoneInfo?.display_phone_number || ""
      } catch {}
    }

    // Get business name
    let metaBusinessName = ""
    if (accessToken && wabaId) {
      try {
        const wabaRes = await fetch(
          `https://graph.facebook.com/v21.0/${wabaId}?fields=id,name,owner_business_info&access_token=${accessToken}`,
          { method: "GET" }
        )
        const wabaData = await wabaRes.json()
        metaBusinessName = wabaData?.owner_business_info?.name || wabaData?.name || ""
      } catch {}
    }

    // Save to database
    await prisma.establishment.update({
      where: { id },
      data: {
        whatsappProvider: "meta",
        ...(accessToken ? { metaAccessToken: accessToken } : {}),
        metaPhoneNumberId: phoneNumberId || null,
        metaBusinessAccountId: wabaId || null,
        ...(displayPhone ? { whatsappNumber: displayPhone } : {}),
        whatsappAutomationEnabled: true,
        ...(metaBusinessName ? { metaBusinessName } : {}),
      },
    })

    // Subscribe WABA to app
    if (accessToken && wabaId) {
      try {
        await fetch(
          `https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        )
      } catch {}
    }

    // Register phone
    if (accessToken && phoneNumberId) {
      try {
        await fetch(
          `https://graph.facebook.com/v21.0/${phoneNumberId}/register`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ messaging_product: "whatsapp", pin: "123456" }),
          }
        )
      } catch {}
    }

    console.log(`[Meta Embedded Signup] SUCCESS - source: ${tokenSource} phone: ${displayPhone}`)

    return NextResponse.json({
      success: true,
      phoneNumber: displayPhone,
      wabaId: wabaId,
      _tokenSource: tokenSource,
      _debug: allDebug,
    })
  } catch (error: any) {
    console.error("[Meta Embedded Signup] ERROR:", error.message, error.stack)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
