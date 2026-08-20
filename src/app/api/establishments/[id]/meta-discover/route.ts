import { NextRequest, NextResponse } from "next/server"

const META_APP_ID = process.env.META_APP_ID
const META_APP_SECRET = process.env.META_APP_SECRET

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await req.json()
    const { code, redirectUri } = body

    console.log("[Meta Discover] ========== START ==========")
    console.log("[Meta Discover] Establishment ID:", id)
    console.log("[Meta Discover] Code received:", !!code, "length:", code?.length)
    console.log("[Meta Discover] Redirect URI:", redirectUri)

    if (!code) {
      return NextResponse.json({ success: false, error: "Codigo nao fornecido" }, { status: 400 })
    }

    if (!META_APP_ID || !META_APP_SECRET) {
      console.log("[Meta Discover] ERROR - META_APP_ID or META_APP_SECRET not configured")
      return NextResponse.json({ success: false, error: "META_APP_ID e META_APP_SECRET nao configurados" }, { status: 500 })
    }

    console.log("[Meta Discover] META_APP_ID:", META_APP_ID)

    const origin = redirectUri ? new URL(redirectUri).origin : "https://flowoshub.com"
    const redirectUris = [
      origin,
      origin + "/",
      "https://www.facebook.com/connect/login/success.html",
      "",
    ]

    console.log("[Meta Discover] Trying redirect URIs:", redirectUris)

    let shortToken: string | null = null
    for (const uri of redirectUris) {
      console.log("[Meta Discover] Trying URI:", uri)
      const tokenRes = await fetch(
        "https://graph.facebook.com/v21.0/oauth/access_token?client_id=" + META_APP_ID + "&client_secret=" + META_APP_SECRET + "&redirect_uri=" + encodeURIComponent(uri) + "&code=" + code,
        { method: "GET" }
      )
      const tokenData = await tokenRes.json()
      console.log("[Meta Discover] Token response:", JSON.stringify(tokenData))
      if (tokenRes.ok && tokenData.access_token) {
        shortToken = tokenData.access_token
        console.log("[Meta Discover] Token OK with redirect_uri:", uri, "token length:", shortToken.length)
        break
      } else {
        console.log("[Meta Discover] Failed:", uri, "-", tokenData.error?.message)
      }
    }

    if (!shortToken) {
      console.log("[Meta Discover] ERROR - All token exchange attempts failed")
      return NextResponse.json({ success: false, error: "Falha ao trocar codigo por token" }, { status: 400 })
    }

    console.log("[Meta Discover] Exchanging short token for long token...")
    const longTokenRes = await fetch(
      "https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=" + META_APP_ID + "&client_secret=" + META_APP_SECRET + "&fb_exchange_token=" + shortToken,
      { method: "GET" }
    )
    const longTokenData = await longTokenRes.json()
    console.log("[Meta Discover] Long token response:", JSON.stringify(longTokenData))
    const accessToken = longTokenData.access_token || shortToken
    console.log("[Meta Discover] Final token length:", accessToken.length)

    const phones: Array<{ id: string; display_phone_number: string; verified_name: string; waba_id: string }> = []

    const headers = { Authorization: "Bearer " + accessToken }

    // Method 1: Direct WABAs
    console.log("[Meta Discover] ===== METHOD 1: Direct WABAs =====")
    const wabaRes = await fetch(
      "https://graph.facebook.com/v21.0/me/whatsapp_business_accounts?fields=id,name,account_review_status",
      { headers }
    )
    const wabaData = await wabaRes.json()
    console.log("[Meta Discover] Direct WABAs response:", JSON.stringify(wabaData))

    if (wabaData.data && wabaData.data.length > 0) {
      console.log("[Meta Discover] Found", wabaData.data.length, "direct WABAs")
      for (const waba of wabaData.data) {
        console.log("[Meta Discover] Fetching phones for WABA:", waba.id, waba.name)
        const phoneRes = await fetch(
          "https://graph.facebook.com/v21.0/" + waba.id + "/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating&limit=100",
          { headers }
        )
        const phoneData = await phoneRes.json()
        console.log("[Meta Discover] Phones for WABA", waba.id, ":", JSON.stringify(phoneData))
        if (phoneData.data) {
          for (const phone of phoneData.data) {
            console.log("[Meta Discover] Adding phone:", phone.display_phone_number, phone.verified_name)
            phones.push({
              id: phone.id,
              display_phone_number: phone.display_phone_number,
              verified_name: phone.verified_name || waba.name,
              waba_id: waba.id,
            })
          }
        } else {
          console.log("[Meta Discover] No phones data for WABA", waba.id)
        }
      }
    } else {
      console.log("[Meta Discover] No direct WABAs found")
      if (wabaData.error) {
        console.log("[Meta Discover] WABA error:", JSON.stringify(wabaData.error))
      }
    }

    // Method 2: Via business accounts (if no phones found yet)
    if (phones.length === 0) {
      console.log("[Meta Discover] ===== METHOD 2: Via business accounts =====")
      const bizRes = await fetch(
        "https://graph.facebook.com/v21.0/me?fields=businesses{id,name}",
        { headers }
      )
      const bizData = await bizRes.json()
      console.log("[Meta Discover] Businesses response:", JSON.stringify(bizData))

      const businesses = bizData.businesses?.data || []
      console.log("[Meta Discover] Found", businesses.length, "businesses")
      for (const biz of businesses) {
        console.log("[Meta Discover] Fetching WABAs for business:", biz.id, biz.name)
        const bizWabaRes = await fetch(
          "https://graph.facebook.com/v21.0/" + biz.id + "/owned_whatsapp_business_accounts?fields=id,name,account_review_status&limit=100",
          { headers }
        )
        const bizWabaData = await bizWabaRes.json()
        console.log("[Meta Discover] WABAs for biz", biz.id, ":", JSON.stringify(bizWabaData))

        if (bizWabaData.data) {
          for (const waba of bizWabaData.data) {
            console.log("[Meta Discover] Fetching phones for biz WABA:", waba.id, waba.name)
            const phoneRes = await fetch(
              "https://graph.facebook.com/v21.0/" + waba.id + "/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating&limit=100",
              { headers }
            )
            const phoneData = await phoneRes.json()
            console.log("[Meta Discover] Phones for biz WABA", waba.id, ":", JSON.stringify(phoneData))
            if (phoneData.data) {
              for (const phone of phoneData.data) {
                console.log("[Meta Discover] Adding phone:", phone.display_phone_number, phone.verified_name)
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
      console.log("[Meta Discover] ===== METHOD 3: Shared WABAs via debug_token =====")
      const debugRes = await fetch(
        "https://graph.facebook.com/v21.0/debug_token?input_token=" + accessToken + "&access_token=" + META_APP_ID + "|" + META_APP_SECRET,
        { method: "GET" }
      )
      const debugData = await debugRes.json()
      console.log("[Meta Discover] Token debug response:", JSON.stringify(debugData, null, 2))

      if (debugData.data?.grant_info?.scopes) {
        console.log("[Meta Discover] Token scopes:", debugData.data.grant_info.scopes)
      }
    }

    console.log("[Meta Discover] ===== RESULT =====")
    console.log("[Meta Discover] Total phones found:", phones.length)
    console.log("[Meta Discover] Phones:", JSON.stringify(phones))

    return NextResponse.json({
      success: true,
      accessToken,
      phones,
    })
  } catch (error: any) {
    console.error("[Meta Discover] ERROR:", error.message, error.stack)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
