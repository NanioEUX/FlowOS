import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createDefaultVerificationTemplate, getTemplateStatus } from "@/lib/whatsapp/meta"

/**
 * POST /api/establishments/[id]/meta-create-template
 * Manually trigger creation of the default verification template.
 * Use when the template wasn't created during Embedded Signup.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    const establishment = await prisma.establishment.findUnique({
      where: { id },
      select: {
        metaBusinessAccountId: true,
        metaAccessToken: true,
      },
    })

    if (!establishment) {
      return NextResponse.json({ error: "Establishment not found" }, { status: 404 })
    }

    if (!establishment.metaBusinessAccountId || !establishment.metaAccessToken) {
      return NextResponse.json({ error: "Meta not connected" }, { status: 400 })
    }

    // Check if template already exists
    const existing = await getTemplateStatus(
      establishment.metaBusinessAccountId,
      establishment.metaAccessToken,
      "otp_codigo_acesso"
    )
    console.log(`[META TEMPLATE] Existing template status:`, existing)

    if (existing.found) {
      return NextResponse.json({
        success: true,
        alreadyExists: true,
        status: existing.status,
        message: `Template already exists with status: ${existing.status}`,
      })
    }

    // Create template
    const result = await createDefaultVerificationTemplate(
      establishment.metaBusinessAccountId,
      establishment.metaAccessToken
    )
    console.log(`[META TEMPLATE] Creation result:`, result)

    return NextResponse.json({
      success: result.success,
      templateId: result.templateId,
      status: result.status,
      error: result.error,
    })
  } catch (error: any) {
    console.error("[META TEMPLATE] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
