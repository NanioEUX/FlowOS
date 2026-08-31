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

      // Register phone number with WhatsApp Cloud API using App Access Token
      if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
        console.error("[Meta Connect] META_APP_ID or META_APP_SECRET not configured - skipping register")
      } else {
        const appAccessToken = `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`
        try {
          const regRes = await fetch(
            `https://graph.facebook.com/v21.0/${metaPhoneNumberId}/register`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${appAccessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                pin: "123456",
              }),
            }
          )
          const regData = await regRes.json()
          console.log("[Meta Connect] Register response:", JSON.stringify(regData))
        } catch (regErr: any) {
          console.error("[Meta Connect] Register error:", regErr.message)
        }
      }

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
