import { NextRequest, NextResponse } from "next/server"

const META_APP_ID = process.env.META_APP_ID
const META_APP_SECRET = process.env.META_APP_SECRET

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { code, redirectUri } = body

    if (!code) {
      return NextResponse.json({ success: false, error: "Codigo nao fornecido" }, { status: 400 })
    }

    if (!META_APP_ID || !META_APP_SECRET) {
      return NextResponse.json({ success: false, error: "META_APP_ID e META_APP_SECRET nao configurados" }, { status: 500 })
    }

    // Step 1: Exchange code for short-lived token
    console.log("[Meta Discover] Exchanging code. redirectUri:", redirectUri)
    const origin = redirectUri ? new URL(redirectUri).origin : "https://flowoshub.com"
    const redirectUris = [
      origin,
      origin + "/",
      "https://www.facebook.com/connect/login/success.html",
      "",
    ]

    let shortToken: string | null = null
    for (const uri of redirectUris) {
      const tokenRes = await fetch(
        "https://graph.facebook.com/v21.0/oauth/access_token?client_id=" + META_APP_ID + "&client_secret=" + META_APP_SECRET + "&redirect_uri=" + encodeURIComponent(uri) + "&code=" + code,
        { method: "GET" }
      )
      const tokenData = await tokenRes.json()
      if (tokenRes.ok && tokenData.access_token) {
        shortToken = tokenData.access_token
        console.log("[Meta Discover] Token exchange OK with redirect_uri:", uri)
        break
      } else {
        console.log("[Meta Discover] Failed with redirect_uri:", uri, "-", tokenData.error?.message)
      }
    }

    if (!shortToken) {
      return NextResponse.json({ success: false, error: "Falha ao trocar codigo por token" }, { status: 400 })
    }

    // Step 2: Exchange for long-lived token
    const longTokenRes = await fetch(
      "https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=" + META_APP_ID + "&client_secret=" + META_APP_SECRET + "&fb_exchange_token=" + shortToken,
      { method: "GET" }
    )
    const longTokenData = await longTokenRes.json()
    const accessToken = longTokenData.access_token || shortToken

    // Step 3: Get user's WhatsApp Business Accounts
    const wabaRes = await fetch(
      "https://graph.facebook.com/v21.0/me/whatsapp_business_accounts?fields=id,name,account_review_status",
      { headers: { Authorization: "Bearer " + accessToken } }
    )
    const wabaData = await wabaRes.json()
    console.log("[Meta Discover] WABAs:", JSON.stringify(wabaData))

    if (!wabaData.data || wabaData.data.length === 0) {
      return NextResponse.json({
        success: true,
        accessToken,
        phones: [],
        message: "Nenhuma conta WhatsApp Business encontrada",
      })
    }

    // Step 4: Get phone numbers from each WABA
    const phones: Array<{ id: string; display_phone_number: string; verified_name: string; waba_id: string }> = []

    for (const waba of wabaData.data) {
      const phoneRes = await fetch(
        "https://graph.facebook.com/v21.0/" + waba.id + "/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating&limit=100",
        { headers: { Authorization: "Bearer " + accessToken } }
      )
      const phoneData = await phoneRes.json()
      console.log("[Meta Discover] Phones for WABA", waba.id, ":", JSON.stringify(phoneData))

      if (phoneData.data) {
        for (const phone of phoneData.data) {
          phones.push({
            id: phone.id,
            display_phone_number: phone.display_phone_number,
            verified_name: phone.verified_name || waba.name,
            waba_id: waba.id,
          })
        }
      }
    }

    console.log("[Meta Discover] Total phones found:", phones.length)

    return NextResponse.json({
      success: true,
      accessToken,
      phones,
    })
  } catch (error: any) {
    console.error("[Meta Discover] Error:", error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
