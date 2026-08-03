import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { EditBotConfig } from "./edit-bot-config"

export const dynamic = "force-dynamic"

export default async function EstabelecimentoDetalhePage({ params }: { params: { id: string } }) {
  const e = await prisma.establishment.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
      category: true,
      subscriptionStatus: true,
      subscriptionPlan: true,
      evolutionInstanceName: true,
      whatsappNumber: true,
      botEnabled: true,
      botUseAI: true,
      botAgentName: true,
      botTone: true,
      botFAQ: true,
      botSystemPrompt: true,
      botGreeting: true,
      aiMessagesUsed: true,
      aiMessagesLimit: true,
      createdAt: true,
    },
  })

  if (!e) notFound()

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <a href="/admin-saas/estabelecimentos" className="text-sm text-zinc-500 hover:text-zinc-900">← Voltar</a>
        <h1 className="text-3xl font-bold text-zinc-900 mt-2">{e.name}</h1>
        <p className="text-zinc-500 mt-1">{e.slug} • {e.category || "sem categoria"}</p>
      </div>

      {/* Info geral */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6 mb-6">
        <h2 className="text-lg font-bold text-zinc-900 mb-4">Informações</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Info label="Email" value={e.email} />
          <Info label="WhatsApp" value={e.whatsappNumber || "—"} />
          <Info label="Instância Evolution" value={e.evolutionInstanceName || "não conectada"} />
          <Info label="Plano" value={e.subscriptionPlan || "trial"} />
          <Info label="Status" value={e.subscriptionStatus || "—"} />
          <Info label="IA ativa" value={e.botUseAI ? "Sim" : "Não"} />
          <Info label="Bot ativo" value={e.botEnabled ? "Sim" : "Não"} />
          <Info label="IA (mês)" value={`${e.aiMessagesUsed} / ${e.aiMessagesLimit}`} />
        </div>
      </div>

      {/* Editor de IA */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6 mb-6">
        <h2 className="text-lg font-bold text-zinc-900 mb-1">Configuração de IA</h2>
        <p className="text-sm text-zinc-500 mb-4">Sobrescreve o prompt da categoria do template</p>
        <EditBotConfig
          id={e.id}
          initial={{
            botAgentName: e.botAgentName || "",
            botTone: e.botTone || "casual",
            botFAQ: e.botFAQ || "",
            botSystemPrompt: e.botSystemPrompt || "",
            botGreeting: e.botGreeting || "",
          }}
        />
      </div>

      {/* Link para painel técnico */}
      <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-6">
        <h2 className="text-lg font-bold text-zinc-900 mb-1">Configurações técnicas</h2>
        <p className="text-sm text-zinc-500 mb-4">
          Provedor de WhatsApp, credenciais, templates de bot e demais opções avançadas.
        </p>
        <a
          href={`/admin-saas/estabelecimentos/${e.id}/whatsapp-tech`}
          className="inline-flex items-center gap-2 bg-white border border-zinc-300 hover:border-green-600 hover:text-green-700 text-zinc-900 px-4 py-2 rounded-lg text-sm font-medium"
        >
          Abrir painel técnico de WhatsApp →
        </a>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-zinc-500 text-xs">{label}</p>
      <p className="text-zinc-900 font-medium">{value}</p>
    </div>
  )
}
