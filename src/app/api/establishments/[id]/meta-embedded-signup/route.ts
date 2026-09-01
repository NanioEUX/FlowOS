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
    console.log("[Meta Embedded Signup] existingToken:", !!existingToken, "length:", existingToken?.length)

    if (!code && !existingToken) {
      console.log("[Meta Embedded Signup] No code or token provided, saving IDs only")
    }

    // Step 1: Get access token
    let accessToken: string | null = null
    const diagnostics: string[] = []

    diagnostics.push("received: code=" + (code || "null") + " existingToken=" + (existingToken ? "len=" + existingToken.length + " starts=" + existingToken.substring(0, 6) : "null"))

    if (existingToken && existingToken.length > 100) {
      if (existingToken.startsWith("EAA")) {
        accessToken = existingToken
        diagnostics.push("existingToken: VALID (EAA)")
      } else {
        diagnostics.push("existingToken: INVALID prefix=" + existingToken.substring(0, 6))
      }
    }

    if (!accessToken && code && code !== "no_code" && code.length > 10) {
      if (!META_APP_ID || !META_APP_SECRET) {
        console.log("[Meta Embedded Signup] ERROR - META_APP_ID or META_APP_SECRET not configured")
      } else {
        console.log("[Meta Embedded Signup] Exchanging code for token...")
        const origin = redirectUri ? new URL(redirectUri).origin : "https://flowoshub.com"
        const redirectUris = [origin, origin + "/", ""]

        for (const uri of redirectUris) {
          console.log("[Meta Embedded Signup] Trying URI:", uri)
          try {
            const tokenRes = await fetch(
              `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&redirect_uri=${encodeURIComponent(uri)}&code=${code}`,
              { method: "GET" }
            )
            const tokenData = await tokenRes.json()
            console.log("[Meta Embedded Signup] Token response:", JSON.stringify(tokenData))
            if (tokenRes.ok && tokenData.access_token && tokenData.access_token.startsWith("EAA")) {
              accessToken = tokenData.access_token
              console.log("[Meta Embedded Signup] Got VALID short token with URI:", uri, "length:", tokenData.access_token.length)
              break
            }
          } catch (e: any) {
            console.log("[Meta Embedded Signup] URI failed:", uri, e.message)
          }
        }

        if (accessToken && META_APP_ID && META_APP_SECRET) {
          console.log("[Meta Embedded Signup] Exchanging for long token...")
          try {
            const longRes = await fetch(
              `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${accessToken}`,
              { method: "GET" }
            )
            const longData = await longRes.json()
            if (longData.access_token && longData.access_token.startsWith("EAA")) {
              accessToken = longData.access_token
              console.log("[Meta Embedded Signup] Long token OK, length:", longData.access_token.length)
            }
          } catch (e: any) {
            console.log("[Meta Embedded Signup] Long token exchange failed:", e.message)
          }
        }
      }
    }

    // Step 2: Try to get display_phone_number via API (best effort, don't block)
    let displayPhone = ""
    if (accessToken && phoneNumberId) {
      try {
        const phoneRes = await fetch(
          `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=display_phone_number,verified_name`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        const phoneInfo = await phoneRes.json()
        console.log("[Meta Embedded Signup] Phone info:", JSON.stringify(phoneInfo))
        displayPhone = phoneInfo?.display_phone_number || ""
      } catch (e: any) {
        console.log("[Meta Embedded Signup] Phone info fetch failed:", e.message)
      }
    }

    // Step 2.5: Get user name and picture from /me
    let metaUserName = ""
    let metaUserPicture = ""
    if (accessToken) {
      try {
        const userRes = await fetch(
          `https://graph.facebook.com/v21.0/me?fields=id,name,picture.type(large)&access_token=${accessToken}`,
          { method: "GET" }
        )
        const userData = await userRes.json()
        console.log("[Meta Embedded Signup] User info:", JSON.stringify(userData))
        metaUserName = userData?.name || ""
        metaUserPicture = userData?.picture?.data?.url || ""
      } catch (e: any) {
        console.log("[Meta Embedded Signup] User info fetch failed:", e.message)
      }
    }

    // Step 2.6: Get business name from WABA
    let metaBusinessName = ""
    if (accessToken && wabaId) {
      try {
        const wabaRes = await fetch(
          `https://graph.facebook.com/v21.0/${wabaId}?fields=id,name,owner_business_info&access_token=${accessToken}`,
          { method: "GET" }
        )
        const wabaData = await wabaRes.json()
        console.log("[Meta Embedded Signup] WABA info:", JSON.stringify(wabaData))
        metaBusinessName = wabaData?.owner_business_info?.name || wabaData?.name || ""
      } catch (e: any) {
        console.log("[Meta Embedded Signup] WABA info fetch failed:", e.message)
      }
    }

    // Step 3: Save to database - IDs come from request, NOT from API
    console.log("[Meta Embedded Signup] Saving to database...")
    console.log("[Meta Embedded Signup] phoneNumberId:", phoneNumberId, "wabaId:", wabaId, "displayPhone:", displayPhone)

    await prisma.establishment.update({
      where: { id },
      data: {
        whatsappProvider: "meta",
        ...(accessToken ? { metaAccessToken: accessToken } : {}),
        metaPhoneNumberId: phoneNumberId || null,
        metaBusinessAccountId: wabaId || null,
        ...(displayPhone ? { whatsappNumber: displayPhone } : {}),
        whatsappAutomationEnabled: true,
        ...(metaUserName ? { metaUserName } : {}),
        ...(metaUserPicture ? { metaUserPicture } : {}),
        ...(metaBusinessName ? { metaBusinessName } : {}),
      },
    })

    // Step 4: Subscribe WABA to app (required for webhook events)
    if (accessToken && wabaId) {
      try {
        const subRes = await fetch(
          `https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        )
        const subData = await subRes.json()
        console.log("[Meta Embedded Signup] Subscribe WABA response:", JSON.stringify(subData))
      } catch (subErr: any) {
        console.error("[Meta Embedded Signup] Subscribe WABA error:", subErr.message)
      }
    }

    // Step 5: Register phone (best effort)
    if (accessToken && phoneNumberId) {
      try {
        const regRes = await fetch(
          `https://graph.facebook.com/v21.0/${phoneNumberId}/register`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
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
      } catch (regErr: any) {
        console.error("[Meta Embedded Signup] Register error:", regErr.message)
      }
    }

    console.log(`[Meta Embedded Signup] SUCCESS - phone: ${displayPhone} phoneNumberId: ${phoneNumberId} wabaId: ${wabaId}`)

    return NextResponse.json({
      success: true,
      phoneNumber: displayPhone,
      wabaId: wabaId,
      _diagnostics: diagnostics,
      _tokenValid: accessToken ? accessToken.startsWith("EAA") : false,
    })
  } catch (error: any) {
    console.error("[Meta Embedded Signup] ERROR:", error.message, error.stack)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
