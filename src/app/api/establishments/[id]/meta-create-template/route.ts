import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createDefaultVerificationTemplate, getTemplateStatus } from "@/lib/whatsapp/meta"
import { requireEstablishment } from "@/lib/require-auth"
import { getRequestId, logger } from "@/lib/logger"

/**
 * POST /api/establishments/[id]/meta-create-template
 * Manually trigger creation of the default verification template.
 * Use when the template wasn't created during Embedded Signup.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    const auth = requireEstablishment(req, id)
    if (auth.error) return auth.error

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
      "atualizacao_suporte_v1"
    )
    logger.info("meta-create-template", "status do template existente", { requestId: getRequestId(req), establishmentId: id, found: existing?.found, status: existing?.status })

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
    logger.info("meta-create-template", "resultado da criação do template", { requestId: getRequestId(req), establishmentId: id, success: result?.success })

    return NextResponse.json({
      success: result.success,
      templateId: result.templateId,
      status: result.status,
      error: result.error,
    })
  } catch (error: any) {
    logger.error("establishments/meta-create-template", "[META TEMPLATE] Error", { requestId: getRequestId(req), error: (error as any)?.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
