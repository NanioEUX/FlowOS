import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!META_APP_ID) {
      return NextResponse.json({ success: false, error: "META_APP_ID nao configurado" }, { status: 500 })
    }

    const establishment = await prisma.establishment.findUnique({
      where: { id },
      select: {
        metaAccessToken: true,
        metaPhoneNumberId: true,
        logo: true,
      },
    })

    if (!establishment?.metaAccessToken || !establishment?.metaPhoneNumberId) {
      return NextResponse.json({ success: false, error: "WhatsApp nao conectado" }, { status: 400 })
    }

    if (!establishment.logo) {
      return NextResponse.json({ success: false, error: "Nenhuma logo configurada no cardapio" }, { status: 400 })
    }

    const { metaAccessToken: accessToken, metaPhoneNumberId: phoneNumberId, logo } = establishment

    const imageRes = await fetch(logo)
    if (!imageRes.ok) {
      return NextResponse.json({ success: false, error: "Nao foi possivel baixar a logo" }, { status: 500 })
    }

    const imageBuffer = Buffer.from(await imageRes.arrayBuffer())
    const fileLength = imageBuffer.length

    const contentType = imageRes.headers.get("content-type") || "image/jpeg"
    const ext = contentType.includes("png") ? "png" : "jpg"
    const fileName = `logo.${ext}`

    console.log("[Meta Profile Sync] Step 1: Creating upload session...")
    const sessionRes = await fetch(
      `https://graph.facebook.com/v21.0/${META_APP_ID}/uploads?file_name=${fileName}&file_length=${fileLength}&file_type=${contentType}&access_token=${accessToken}`,
      { method: "POST" }
    )
    const sessionData = await sessionRes.json()
    console.log("[Meta Profile Sync] Session:", JSON.stringify(sessionData))

    if (!sessionData.id) {
      return NextResponse.json({
        success: false,
        error: "Erro ao criar sessao: " + (sessionData?.error?.message || JSON.stringify(sessionData)),
      })
    }

    const uploadId = sessionData.id

    console.log("[Meta Profile Sync] Step 2: Uploading image...")
    const uploadRes = await fetch(
      `https://graph.facebook.com/v21.0/${uploadId}`,
      {
        method: "POST",
        headers: {
          Authorization: `OAuth ${accessToken}`,
          file_offset: "0",
        },
        body: imageBuffer,
      }
    )
    const uploadData = await uploadRes.json()
    console.log("[Meta Profile Sync] Upload:", JSON.stringify(uploadData))

    if (!uploadData.h) {
      return NextResponse.json({
        success: false,
        error: "Erro ao enviar: " + (uploadData?.error?.message || JSON.stringify(uploadData)),
      })
    }

    const handle = uploadData.h
    console.log("[Meta Profile Sync] Handle:", handle)

    console.log("[Meta Profile Sync] Step 3: Updating profile...")
    const profileRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/whatsapp_business_profile`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          profile_picture_handle: handle,
        }),
      }
    )
    const profileData = await profileRes.json()
    console.log("[Meta Profile Sync] Profile:", JSON.stringify(profileData))

    if (profileRes.ok && profileData.success) {
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({
      success: false,
      error: profileData?.error?.message || "Erro ao atualizar perfil",
      details: profileData,
    })
  } catch (error: any) {
    console.error("[Meta Profile Sync] ERROR:", error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
