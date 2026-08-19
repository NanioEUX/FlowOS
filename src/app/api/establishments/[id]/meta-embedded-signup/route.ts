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
    const { code, phoneNumberId, wabaId } = body

    if (!code) {
      return NextResponse.json({ success: false, error: "Código não fornecido" }, { status: 400 })
    }

    if (!META_APP_ID || !META_APP_SECRET) {
      return NextResponse.json({ success: false, error: "META_APP_ID e META_APP_SECRET não configurados no servidor" }, { status: 500 })
    }

    // Step 1: Exchange code for short-lived token
    const redirectUri = `https://flowoshub.com/`
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: META_APP_ID,
          client_secret: META_APP_SECRET,
          redirect_uri: redirectUri,
          code: code,
        }),
      }
    )
    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("[Meta Embedded Signup] Token exchange failed:", tokenData)
      return NextResponse.json({ success: false, error: tokenData.error?.message || "Falha ao trocar código por token" }, { status: 400 })
    }

    const shortToken = tokenData.access_token

    // Step 2: Exchange short-lived for long-lived token
    const longTokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${shortToken}`,
      { method: "GET" }
    )
    const longTokenData = await longTokenRes.json()
    const accessToken = longTokenData.access_token || shortToken

    // Step 3: Get WABA details
    let wabaInfo: any = null
    if (wabaId) {
      const wabaRes = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}?fields=display_name,account_review_status,business`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      wabaInfo = await wabaRes.json()
    }

    // Step 4: Get phone number details
    let phoneInfo: any = null
    if (phoneNumberId) {
      const phoneRes = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      phoneInfo = await phoneRes.json()
    }

    // Step 5: Save to establishment
    await prisma.establishment.update({
      where: { id },
      data: {
        whatsappProvider: "meta",
        metaAccessToken: accessToken,
        metaPhoneNumberId: phoneNumberId || null,
        metaBusinessAccountId: wabaId || wabaInfo?.id || null,
        whatsappNumber: phoneInfo?.display_phone_number || null,
      },
    })

    console.log(`[Meta Embedded Signup] Connected establishment ${id.slice(0, 8)} — phone: ${phoneInfo?.display_phone_number}`)

    return NextResponse.json({
      success: true,
      phoneNumber: phoneInfo?.display_phone_number,
      verifiedName: phoneInfo?.verified_name,
      wabaId: wabaId || wabaInfo?.id,
    })
  } catch (error: any) {
    console.error("[Meta Embedded Signup] Error:", error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
