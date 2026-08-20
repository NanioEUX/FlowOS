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
        console.log("[Meta Discover] Token OK with redirect_uri:", uri)
        break
      } else {
        console.log("[Meta Discover] Failed:", uri, "-", tokenData.error?.message)
      }
    }

    if (!shortToken) {
      return NextResponse.json({ success: false, error: "Falha ao trocar codigo por token" }, { status: 400 })
    }

    const longTokenRes = await fetch(
      "https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=" + META_APP_ID + "&client_secret=" + META_APP_SECRET + "&fb_exchange_token=" + shortToken,
      { method: "GET" }
    )
    const longTokenData = await longTokenRes.json()
    const accessToken = longTokenData.access_token || shortToken

    const phones: Array<{ id: string; display_phone_number: string; verified_name: string; waba_id: string }> = []

    const headers = { Authorization: "Bearer " + accessToken }

    // Method 1: Direct WABAs
    const wabaRes = await fetch(
      "https://graph.facebook.com/v21.0/me/whatsapp_business_accounts?fields=id,name,account_review_status",
      { headers }
    )
    const wabaData = await wabaRes.json()
    console.log("[Meta Discover] Direct WABAs:", JSON.stringify(wabaData))

    if (wabaData.data && wabaData.data.length > 0) {
      for (const waba of wabaData.data) {
        const phoneRes = await fetch(
          "https://graph.facebook.com/v21.0/" + waba.id + "/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating&limit=100",
          { headers }
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
    }

    // Method 2: Via business accounts (if no phones found yet)
    if (phones.length === 0) {
      console.log("[Meta Discover] No direct WABAs, trying via business accounts...")
      const bizRes = await fetch(
        "https://graph.facebook.com/v21.0/me?fields=businesses{id,name}",
        { headers }
      )
      const bizData = await bizRes.json()
      console.log("[Meta Discover] Businesses:", JSON.stringify(bizData))

      const businesses = bizData.businesses?.data || []
      for (const biz of businesses) {
        const bizWabaRes = await fetch(
          "https://graph.facebook.com/v21.0/" + biz.id + "/owned_whatsapp_business_accounts?fields=id,name,account_review_status&limit=100",
          { headers }
        )
        const bizWabaData = await bizWabaRes.json()
        console.log("[Meta Discover] WABAs for biz", biz.id, ":", JSON.stringify(bizWabaData))

        if (bizWabaData.data) {
          for (const waba of bizWabaData.data) {
            const phoneRes = await fetch(
              "https://graph.facebook.com/v21.0/" + waba.id + "/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating&limit=100",
              { headers }
            )
            const phoneData = await phoneRes.json()
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
        }
      }
    }

    // Method 3: Shared WABAs via app (if still nothing)
    if (phones.length === 0) {
      console.log("[Meta Discover] Trying shared WABAs via debug_token...")
      const debugRes = await fetch(
        "https://graph.facebook.com/v21.0/debug_token?input_token=" + accessToken + "&access_token=" + META_APP_ID + "|" + META_APP_SECRET,
        { method: "GET" }
      )
      const debugData = await debugRes.json()
      console.log("[Meta Discover] Token debug:", JSON.stringify(debugData))
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
