import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { MetaCloudProvider } from "@/lib/whatsapp/meta"

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await req.json()
    const { metaPhoneNumberId, metaAccessToken } = body

    if (!metaPhoneNumberId || !metaAccessToken) {
      return NextResponse.json(
        { error: "Phone Number ID e Access Token são obrigatórios" },
        { status: 400 }
      )
    }

    const provider = new MetaCloudProvider({
      phoneNumberId: metaPhoneNumberId,
      accessToken: metaAccessToken,
    })

    const validation = provider.validateConfig()
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const result = await provider.testConnection()

    if (result.connected) {
      // Save credentials
      await prisma.establishment.update({
        where: { id },
        data: {
          metaPhoneNumberId,
          metaAccessToken,
          whatsappProvider: "meta",
        },
      })

      return NextResponse.json({
        connected: true,
        phoneInfo: result.phoneInfo,
      })
    }

    return NextResponse.json(
      { connected: false, error: result.error },
      { status: 400 }
    )
  } catch (error: any) {
    console.error("[Meta Connect] Error:", error.message)
    return NextResponse.json(
      { connected: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    await prisma.establishment.update({
      where: { id },
      data: {
        metaPhoneNumberId: null,
        metaAccessToken: null,
        metaBusinessAccountId: null,
        whatsappProvider: null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[Meta Disconnect] Error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
