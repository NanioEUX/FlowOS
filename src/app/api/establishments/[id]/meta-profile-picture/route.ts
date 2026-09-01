import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: "Nenhum arquivo enviado" }, { status: 400 })
    }

    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      return NextResponse.json({ success: false, error: "Use JPG ou PNG." }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "Maximo 5MB." }, { status: 400 })
    }

    if (!META_APP_ID) {
      return NextResponse.json({ success: false, error: "META_APP_ID nao configurado" }, { status: 500 })
    }

    const establishment = await prisma.establishment.findUnique({
      where: { id },
      select: { metaAccessToken: true, metaPhoneNumberId: true },
    })

    if (!establishment?.metaAccessToken || !establishment?.metaPhoneNumberId) {
      return NextResponse.json({ success: false, error: "WhatsApp nao conectado" }, { status: 400 })
    }

    const { metaAccessToken: accessToken, metaPhoneNumberId: phoneNumberId } = establishment

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileLength = buffer.length
    const fileName = `profile.${file.type === "image/png" ? "png" : "jpg"}`

    console.log("[Meta Profile] Step 1: Creating upload session...")

    const sessionRes = await fetch(
      `https://graph.facebook.com/v21.0/${META_APP_ID}/uploads?file_name=${fileName}&file_length=${fileLength}&file_type=${file.type}&access_token=${accessToken}`,
      { method: "POST" }
    )
    const sessionData = await sessionRes.json()
    console.log("[Meta Profile] Session response:", JSON.stringify(sessionData))

    if (!sessionData.id) {
      return NextResponse.json({
        success: false,
        error: "Erro ao criar sessao de upload: " + (sessionData?.error?.message || JSON.stringify(sessionData)),
      })
    }

    const uploadId = sessionData.id

    console.log("[Meta Profile] Step 2: Uploading image binary...")

    const uploadRes = await fetch(
      `https://graph.facebook.com/v21.0/upload:${uploadId}`,
      {
        method: "POST",
        headers: {
          Authorization: `OAuth ${accessToken}`,
          file_offset: "0",
        },
        body: buffer,
      }
    )
    const uploadData = await uploadRes.json()
    console.log("[Meta Profile] Upload response:", JSON.stringify(uploadData))

    if (!uploadData.h) {
      return NextResponse.json({
        success: false,
        error: "Erro ao enviar imagem: " + (uploadData?.error?.message || JSON.stringify(uploadData)),
      })
    }

    const handle = uploadData.h
    console.log("[Meta Profile] Got handle:", handle)

    console.log("[Meta Profile] Step 3: Updating business profile...")

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
    console.log("[Meta Profile] Profile response:", JSON.stringify(profileData))

    if (profileRes.ok && profileData.success) {
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({
      success: false,
      error: profileData?.error?.message || "Erro ao atualizar perfil",
      details: profileData,
    })
  } catch (error: any) {
    console.error("[Meta Profile] ERROR:", error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
