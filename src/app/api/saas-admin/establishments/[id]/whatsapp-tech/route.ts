import { prisma } from "@/lib/prisma"
import { requireSaasAdmin } from "@/lib/saas-admin-auth"
import { NextResponse } from "next/server"

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSaasAdmin()
    const body = await req.json()

    const establishment = await prisma.establishment.update({
      where: { id: params.id },
      data: {
        whatsappProvider: body.whatsappProvider || null,
        whatsappNumber: body.whatsappNumber || null,
        evolutionBaseUrl: body.evolutionBaseUrl || null,
        evolutionApiKey: body.evolutionApiKey || null,
        evolutionInstanceName: body.evolutionInstanceName || null,
        metaPhoneNumberId: body.metaPhoneNumberId || null,
        metaAccessToken: body.metaAccessToken || null,
        metaWebhookVerifyToken: body.metaWebhookVerifyToken || null,
        whatsappAutomationEnabled: body.whatsappAutomationEnabled ?? false,
        aiMessagesLimit: Number(body.aiMessagesLimit) || 1000,
        botUseAI: body.botUseAI ?? true,
        botEnabled: body.botEnabled ?? false,
        botMenuOptions: body.botMenuOptions || null,
        botTypingDelayMinMs: Number(body.botTypingDelayMinMs) || 1500,
        botTypingDelayMaxMs: Number(body.botTypingDelayMaxMs) || 3500,
        botInactivityEnabled: body.botInactivityEnabled ?? true,
        botInactivityMinutes: Number(body.botInactivityMinutes) || 10,
        botInactivityMessage: body.botInactivityMessage || null,
        botTransferEnabled: body.botTransferEnabled ?? true,
        botTransferKeywords: body.botTransferKeywords || null,
        botTransferMessage: body.botTransferMessage || null,
        botRespectBusinessHours: body.botRespectBusinessHours ?? false,
        botOutsideHoursMode: body.botOutsideHoursMode || "closed",
        botOutsideHoursMessage: body.botOutsideHoursMessage || null,
        botAcceptsScheduledOrders: body.botAcceptsScheduledOrders ?? false,
        botScheduledOrderMessage: body.botScheduledOrderMessage || null,
        botFallbackMessage: body.botFallbackMessage || null,
        botTemplateOrderConfirmed: body.botTemplateOrderConfirmed || null,
        botTemplateOrderPreparing: body.botTemplateOrderPreparing || null,
        botTemplateOrderReady: body.botTemplateOrderReady || null,
        botTemplateOrderDelivering: body.botTemplateOrderDelivering || null,
        botTemplateOrderDelivered: body.botTemplateOrderDelivered || null,
        botTemplateOrderCancelled: body.botTemplateOrderCancelled || null,
        botTemplateOrderScheduled: body.botTemplateOrderScheduled || null,
      },
    })

    return NextResponse.json({ success: true, establishment })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSaasAdmin()
    const e = await prisma.establishment.findUnique({
      where: { id: params.id },
      select: {
        whatsappProvider: true,
        whatsappNumber: true,
        evolutionBaseUrl: true,
        evolutionApiKey: true,
        evolutionInstanceName: true,
        metaPhoneNumberId: true,
        metaAccessToken: true,
        metaWebhookVerifyToken: true,
        whatsappAutomationEnabled: true,
        aiMessagesUsed: true,
        aiMessagesLimit: true,
        botEnabled: true,
        botUseAI: true,
        botMenuOptions: true,
        botTypingDelayMinMs: true,
        botTypingDelayMaxMs: true,
        botInactivityEnabled: true,
        botInactivityMinutes: true,
        botInactivityMessage: true,
        botTransferEnabled: true,
        botTransferKeywords: true,
        botTransferMessage: true,
        botRespectBusinessHours: true,
        botOutsideHoursMode: true,
        botOutsideHoursMessage: true,
        botAcceptsScheduledOrders: true,
        botScheduledOrderMessage: true,
        botFallbackMessage: true,
        botTemplateOrderConfirmed: true,
        botTemplateOrderPreparing: true,
        botTemplateOrderReady: true,
        botTemplateOrderDelivering: true,
        botTemplateOrderDelivered: true,
        botTemplateOrderCancelled: true,
        botTemplateOrderScheduled: true,
      },
    })

    if (!e) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
    return NextResponse.json(e)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
