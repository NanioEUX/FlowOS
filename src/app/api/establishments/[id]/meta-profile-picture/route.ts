import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { compressAndUploadImage } from "@/lib/image-upload"

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

    const allowedTypes = ["image/jpeg", "image/png"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ success: false, error: "Formato invalido. Use JPG ou PNG." }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "Arquivo muito grande. Maximo 5MB." }, { status: 400 })
    }

    const establishment = await prisma.establishment.findUnique({
      where: { id },
      select: {
        metaAccessToken: true,
        metaPhoneNumberId: true,
      },
    })

    if (!establishment?.metaAccessToken || !establishment?.metaPhoneNumberId) {
      return NextResponse.json({ success: false, error: "WhatsApp Meta nao conectado" }, { status: 400 })
    }

    const { url, error: uploadError } = await compressAndUploadImage(file)
    if (uploadError || !url) {
      return NextResponse.json({ success: false, error: uploadError || "Erro ao enviar imagem" }, { status: 500 })
    }

    const metaRes = await fetch(
      `https://graph.facebook.com/v21.0/${establishment.metaPhoneNumberId}/whatsapp_business_profile`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${establishment.metaAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          profile_picture_url: url,
        }),
      }
    )

    const metaData = await metaRes.json()
    console.log("[Meta Profile Picture] Meta response:", JSON.stringify(metaData))

    if (metaRes.ok && metaData.success) {
      await prisma.establishment.update({
        where: { id },
        data: { metaProfilePictureUrl: url },
      })
      return NextResponse.json({ success: true, url })
    }

    return NextResponse.json({
      success: false,
      error: metaData?.error?.message || "Erro ao atualizar foto na Meta",
      details: metaData,
    })
  } catch (error: any) {
    console.error("[Meta Profile Picture] ERROR:", error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
