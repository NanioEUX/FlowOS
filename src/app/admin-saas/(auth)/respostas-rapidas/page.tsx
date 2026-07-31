import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function RespostasRapidasPage() {
  const rules = await prisma.globalQuickReply.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  })

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Respostas Rápidas Globais</h1>
          <p className="text-zinc-500 mt-1">Regras que TODOS os estabelecimentos herdam</p>
        </div>
        <a
          href="/admin-saas/respostas-rapidas/novo"
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm"
        >
          + Nova regra
        </a>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr className="text-left text-zinc-500 uppercase text-xs">
              <th className="py-3 px-4">Categoria</th>
              <th className="py-3 px-4">Rótulo</th>
              <th className="py-3 px-4">Palavras-chave</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Ordem</th>
              <th className="py-3 px-4">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                <td className="py-3 px-4"><span className="bg-zinc-100 text-zinc-700 px-2 py-1 rounded text-xs">{r.category}</span></td>
                <td className="py-3 px-4 font-medium text-zinc-900">{r.label}</td>
                <td className="py-3 px-4 text-zinc-600 max-w-xs truncate">{r.triggers}</td>
                <td className="py-3 px-4">
                  {r.enabled ? (
                    <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                      <span className="w-2 h-2 rounded-full bg-green-500" /> Ativa
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-zinc-400 text-xs">
                      <span className="w-2 h-2 rounded-full bg-zinc-300" /> Inativa
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-zinc-500">{r.order}</td>
                <td className="py-3 px-4">
                  <a href={`/admin-saas/respostas-rapidas/${r.id}`} className="text-green-600 hover:underline text-xs">Editar</a>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-zinc-500">
                  Nenhuma regra cadastrada. <a href="/admin-saas/respostas-rapidas/novo" className="text-green-600 hover:underline">Criar primeira</a>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <p className="font-medium mb-1">💡 Como funciona</p>
        <ul className="space-y-1 text-blue-800 text-xs">
          <li>• Antes de chamar a IA, o bot testa essas regras na mensagem do cliente</li>
          <li>• Se casar (qualquer / todas / exato), responde direto sem gastar OpenAI</li>
          <li>• Placeholders disponíveis: <code className="bg-blue-100 px-1 rounded">{'{{CARDAPIO}}'}</code>, <code className="bg-blue-100 px-1 rounded">{'{{HORARIO}}'}</code>, <code className="bg-blue-100 px-1 rounded">{'{{ENTREGA_INFO}}'}</code>, <code className="bg-blue-100 px-1 rounded">{'{{PAGAMENTO_INFO}}'}</code></li>
        </ul>
      </div>
    </div>
  )
}
