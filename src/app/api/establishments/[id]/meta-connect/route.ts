import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { MetaCloudProvider } from "@/lib/whatsapp/meta"
import { requireEstablishment } from "@/lib/require-auth"
import { getRequestId, logger } from "@/lib/logger"

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const auth = requireEstablishment(req, id)
    if (auth.error) return auth.error

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
        logger.warn("meta-connect", "META_APP_ID ou META_APP_SECRET não configurados — register ignorado", { requestId: getRequestId(req) })
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
          logger.info("meta-connect", "resposta do registro do app", { requestId: getRequestId(req), establishmentId: id, success: regData?.success, error: regData?.error?.message })
        } catch (regErr: any) {
          logger.error("meta-connect", "falha ao registrar o app na Meta", { requestId: getRequestId(req), error: regErr?.message })
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
    logger.error("meta-connect", "falha em Meta Connect", { requestId: getRequestId(req), error: (error as any)?.message })
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
    logger.error("meta-disconnect", "falha em Meta Disconnect", { requestId: getRequestId(req), error: (error as any)?.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
