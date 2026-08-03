import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { EditWhatsappTech } from "./edit-whatsapp-tech"

export const dynamic = "force-dynamic"

export default async function WhatsappTechPage({ params }: { params: { id: string } }) {
  const e = await prisma.establishment.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      slug: true,
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

  if (!e) notFound()

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <a href={`/admin-saas/estabelecimentos/${e.id}`} className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Voltar para {e.name}
        </a>
        <h1 className="text-3xl font-bold text-zinc-900 mt-2">WhatsApp técnico</h1>
        <p className="text-zinc-500 mt-1">
          {e.name} • {e.slug} • IA no mês: {e.aiMessagesUsed} / {e.aiMessagesLimit}
        </p>
      </div>

      <EditWhatsappTech
        id={e.id}
        initial={{
          whatsappProvider: e.whatsappProvider || "",
          whatsappNumber: e.whatsappNumber || "",
          evolutionBaseUrl: e.evolutionBaseUrl || "",
          evolutionApiKey: e.evolutionApiKey || "",
          evolutionInstanceName: e.evolutionInstanceName || "",
          metaPhoneNumberId: e.metaPhoneNumberId || "",
          metaAccessToken: e.metaAccessToken || "",
          metaWebhookVerifyToken: e.metaWebhookVerifyToken || "",
          whatsappAutomationEnabled: e.whatsappAutomationEnabled,
          aiMessagesLimit: e.aiMessagesLimit,
          botEnabled: e.botEnabled,
          botUseAI: e.botUseAI,
          botMenuOptions: e.botMenuOptions ? JSON.stringify(e.botMenuOptions, null, 2) : "",
          botTypingDelayMinMs: e.botTypingDelayMinMs,
          botTypingDelayMaxMs: e.botTypingDelayMaxMs,
          botInactivityEnabled: e.botInactivityEnabled,
          botInactivityMinutes: e.botInactivityMinutes,
          botInactivityMessage: e.botInactivityMessage || "",
          botTransferEnabled: e.botTransferEnabled,
          botTransferKeywords: e.botTransferKeywords ? JSON.stringify(e.botTransferKeywords, null, 2) : "",
          botTransferMessage: e.botTransferMessage || "",
          botRespectBusinessHours: e.botRespectBusinessHours,
          botOutsideHoursMode: e.botOutsideHoursMode || "closed",
          botOutsideHoursMessage: e.botOutsideHoursMessage || "",
          botAcceptsScheduledOrders: e.botAcceptsScheduledOrders,
          botScheduledOrderMessage: e.botScheduledOrderMessage || "",
          botFallbackMessage: e.botFallbackMessage || "",
          botTemplateOrderConfirmed: e.botTemplateOrderConfirmed || "",
          botTemplateOrderPreparing: e.botTemplateOrderPreparing || "",
          botTemplateOrderReady: e.botTemplateOrderReady || "",
          botTemplateOrderDelivering: e.botTemplateOrderDelivering || "",
          botTemplateOrderDelivered: e.botTemplateOrderDelivered || "",
          botTemplateOrderCancelled: e.botTemplateOrderCancelled || "",
          botTemplateOrderScheduled: e.botTemplateOrderScheduled || "",
        }}
      />
    </div>
  )
}
