import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const establishmentId = formData.get("establishmentId") as string
    const interClientId = formData.get("interClientId") as string
    const interClientSecret = formData.get("interClientSecret") as string
    const interPixKey = formData.get("interPixKey") as string
    const certificateFile = formData.get("certificateFile") as File

    if (!establishmentId || !interClientId || !interClientSecret || !interPixKey || !certificateFile) {
      return NextResponse.json({ error: "Todos os campos são obrigatórios" }, { status: 400 })
    }

    const arrayBuffer = await certificateFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString("base64")

    const updated = await prisma.establishment.update({
      where: { id: establishmentId },
      data: { interClientId, interClientSecret, interCertificate: base64, interPixKey },
    })

    return NextResponse.json({ success: true, id: updated.id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}