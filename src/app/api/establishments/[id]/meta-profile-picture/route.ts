import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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

    const buffer = Buffer.from(await file.arrayBuffer())
    const filename = `profile.${file.type === "image/png" ? "png" : "jpg"}`

    const metaFormData = new FormData()
    metaFormData.append("messaging_product", "whatsapp")
    metaFormData.append("file", new Blob([buffer], { type: file.type }), filename)

    const metaRes = await fetch(
      `https://graph.facebook.com/v21.0/${establishment.metaPhoneNumberId}/whatsapp_business_profile`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${establishment.metaAccessToken}`,
        },
        body: metaFormData,
      }
    )

    const metaData = await metaRes.json()
    console.log("[Meta Profile Picture] Response:", JSON.stringify(metaData))

    if (metaRes.ok && metaData.success) {
      return NextResponse.json({ success: true })
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
