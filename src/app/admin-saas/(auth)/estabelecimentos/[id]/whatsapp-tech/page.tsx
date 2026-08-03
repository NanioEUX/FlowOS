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
    },
  })

  if (!e) notFound()

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <a href={`/admin-saas/estabelecimentos/${e.id}`} className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Voltar para {e.name}
        </a>
        <h1 className="text-3xl font-bold text-zinc-900 mt-2">WhatsApp técnico</h1>
        <p className="text-zinc-500 mt-1">
          {e.name} • {e.slug} • IA no mês: {e.aiMessagesUsed} / {e.aiMessagesLimit}
        </p>
        <p className="text-xs text-zinc-500 mt-2">
          Apenas configurações de integração técnica. Mensagens e comportamento do bot são editados
          pelo próprio estabelecimento em /dashboard/config.
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
        }}
      />
    </div>
  )
}
