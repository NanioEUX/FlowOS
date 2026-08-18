import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { MetaCloudProvider } from "@/lib/whatsapp/meta"

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const establishment = await prisma.establishment.findUnique({
      where: { id },
      select: {
        metaPhoneNumberId: true,
        metaAccessToken: true,
        whatsappProvider: true,
      },
    })

    if (!establishment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (establishment.whatsappProvider !== "meta" || !establishment.metaPhoneNumberId || !establishment.metaAccessToken) {
      return NextResponse.json({ connected: false, configured: false })
    }

    const provider = new MetaCloudProvider({
      phoneNumberId: establishment.metaPhoneNumberId,
      accessToken: establishment.metaAccessToken,
    })

    const result = await provider.testConnection()

    return NextResponse.json({
      connected: result.connected,
      configured: true,
      phoneInfo: result.phoneInfo,
      error: result.error,
    })
  } catch (error: any) {
    return NextResponse.json(
      { connected: false, error: error.message },
      { status: 500 }
    )
  }
}
