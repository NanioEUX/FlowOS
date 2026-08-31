import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const META_APP_ID = process.env.META_APP_ID
const META_APP_SECRET = process.env.META_APP_SECRET

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await req.json()
    const { code, phoneNumberId, wabaId, redirectUri, accessToken: existingToken } = body

    console.log("[Meta Embedded Signup] ========== START ==========")
    console.log("[Meta Embedded Signup] Establishment ID:", id)
    console.log("[Meta Embedded Signup] Code received:", !!code, "length:", code?.length)
    console.log("[Meta Embedded Signup] phoneNumberId:", phoneNumberId)
    console.log("[Meta Embedded Signup] wabaId:", wabaId)
    console.log("[Meta Embedded Signup] redirectUri:", redirectUri)
    console.log("[Meta Embedded Signup] existingToken:", !!existingToken)

    if (!code && !existingToken) {
      return NextResponse.json({ success: false, error: "Código ou token não fornecido" }, { status: 400 })
    }

    if (!META_APP_ID || !META_APP_SECRET) {
      console.log("[Meta Embedded Signup] ERROR - META_APP_ID or META_APP_SECRET not configured")
      return NextResponse.json({ success: false, error: "META_APP_ID e META_APP_SECRET não configurados no servidor" }, { status: 500 })
    }

    // Use existing token if provided (from meta-discover), otherwise exchange code
    let accessToken: string
    if (existingToken) {
      console.log("[Meta Embedded Signup] Using existing token from meta-discover, length:", existingToken.length)
      accessToken = existingToken
    } else {
      // Step 1: Exchange code for short-lived token
      console.log("[Meta Embedded Signup] Exchanging code for token...")
      const origin = redirectUri ? new URL(redirectUri).origin : "https://flowoshub.com"
      const redirectUris = [
        origin,
        origin + "/",
        "https://www.facebook.com/connect/login/success.html",
        "",
      ]

      console.log("[Meta Embedded Signup] Trying redirect URIs:", redirectUris)

      let tokenData: any = null
      let tokenOk = false
      for (const uri of redirectUris) {
        console.log("[Meta Embedded Signup] Trying URI:", uri)
        const tokenRes = await fetch(
          `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&redirect_uri=${encodeURIComponent(uri)}&code=${code}`,
          { method: "GET" }
        )
        tokenData = await tokenRes.json()
        console.log("[Meta Embedded Signup] Token response:", JSON.stringify(tokenData))
        if (tokenRes.ok && tokenData.access_token) {
          tokenOk = true
          console.log("[Meta Embedded Signup] Token exchange OK with redirect_uri:", uri)
          break
        } else {
          console.log("[Meta Embedded Signup] Failed with redirect_uri:", uri, "-", tokenData.error?.message)
        }
      }

      if (!tokenOk || !tokenData?.access_token) {
        console.error("[Meta Embedded Signup] ERROR - All token exchange attempts failed:", JSON.stringify(tokenData))
        return NextResponse.json({ success: false, error: tokenData?.error?.message || "Falha ao trocar código por token" }, { status: 400 })
      }

      const shortToken = tokenData.access_token
      console.log("[Meta Embedded Signup] Short token length:", shortToken.length)

      // Step 2: Exchange short-lived for long-lived token
      console.log("[Meta Embedded Signup] Exchanging for long token...")
      const longTokenRes = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${shortToken}`,
        { method: "GET" }
      )
      const longTokenData = await longTokenRes.json()
      console.log("[Meta Embedded Signup] Long token response:", JSON.stringify(longTokenData))
      if (longTokenData.access_token) {
        accessToken = longTokenData.access_token
        console.log("[Meta Embedded Signup] Long token obtained, length:", accessToken.length)
      } else {
        console.log("[Meta Embedded Signup] Long token exchange failed, using short token")
        accessToken = shortToken
      }
      console.log("[Meta Embedded Signup] Final token length:", accessToken.length)
    }

    // Step 3: Get WABA details
    let wabaInfo: any = null
    if (wabaId) {
      console.log("[Meta Embedded Signup] Fetching WABA details:", wabaId)
      const wabaRes = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}?fields=display_name,account_review_status,business`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      wabaInfo = await wabaRes.json()
      console.log("[Meta Embedded Signup] WABA info:", JSON.stringify(wabaInfo))
    } else {
      console.log("[Meta Embedded Signup] No wabaId provided")
    }

    // Step 4: Get phone number details
    let phoneInfo: any = null
    let displayPhone = ""
    if (phoneNumberId) {
      console.log("[Meta Embedded Signup] Fetching phone details:", phoneNumberId)
      const phoneRes = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      phoneInfo = await phoneRes.json()
      console.log("[Meta Embedded Signup] Phone info:", JSON.stringify(phoneInfo))
      displayPhone = phoneInfo?.display_phone_number || ""

      // Fallback: try via WABA phone_numbers list
      if (!displayPhone && wabaId) {
        console.log("[Meta Embedded Signup] Fallback: listing phones from WABA:", wabaId)
        const listRes = await fetch(
          `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?fields=display_phone_number,verified_name,id`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        const listData = await listRes.json()
        console.log("[Meta Embedded Signup] WABA phones:", JSON.stringify(listData))
        const match = listData?.data?.find((p: any) => p.id === phoneNumberId)
        if (match?.display_phone_number) {
          displayPhone = match.display_phone_number
        } else if (listData?.data?.length > 0) {
          displayPhone = listData.data[0].display_phone_number || ""
        }
      }
    } else {
      console.log("[Meta Embedded Signup] No phoneNumberId provided")
    }

    // Step 5: Save to establishment
    console.log("[Meta Embedded Signup] Saving to database...")
    console.log("[Meta Embedded Signup] displayPhone:", displayPhone, "phoneNumberId:", phoneNumberId)
    await prisma.establishment.update({
      where: { id },
      data: {
        whatsappProvider: "meta",
        metaAccessToken: accessToken,
        metaPhoneNumberId: phoneNumberId || null,
        metaBusinessAccountId: wabaId || wabaInfo?.id || null,
        whatsappNumber: displayPhone || null,
      },
    })

    // Step 6: Register phone number with WhatsApp Cloud API using App Access Token
    if (phoneNumberId) {
      const appAccessToken = `${META_APP_ID}|${META_APP_SECRET}`
      console.log("[Meta Embedded Signup] Registering phone number:", phoneNumberId, "with App Token")
      try {
        const regRes = await fetch(
          `https://graph.facebook.com/v21.0/${phoneNumberId}/register`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${appAccessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              pin: "123456",
            }),
          }
        )
        const regData = await regRes.json()
        console.log("[Meta Embedded Signup] Register response:", JSON.stringify(regData))
        if (!regRes.ok) {
          console.error("[Meta Embedded Signup] Register failed:", regData.error?.message)
        }
      } catch (regErr: any) {
        console.error("[Meta Embedded Signup] Register error:", regErr.message)
      }
    }

    console.log(`[Meta Embedded Signup] SUCCESS - Connected establishment ${id.slice(0, 8)} — phone: ${displayPhone} — phoneNumberId: ${phoneNumberId}`)

    return NextResponse.json({
      success: true,
      phoneNumber: displayPhone || phoneInfo?.display_phone_number,
      verifiedName: phoneInfo?.verified_name,
      wabaId: wabaId || wabaInfo?.id,
    })
  } catch (error: any) {
    console.error("[Meta Embedded Signup] ERROR:", error.message, error.stack)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
