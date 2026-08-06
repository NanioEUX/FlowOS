import { NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { compressAndUploadImage } from "@/lib/image-upload"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 })
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Formato não suportado. Use JPG, PNG ou WebP" }, { status: 400 })
    }

    const result = await compressAndUploadImage(file)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ url: result.url })
  } catch (error) {
    console.error("[UPLOAD]", error)
    return NextResponse.json({ error: "Erro no upload" }, { status: 500 })
  }
}
