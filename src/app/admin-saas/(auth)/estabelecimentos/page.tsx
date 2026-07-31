import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function EstabelecimentosPage() {
  const establishments = await prisma.establishment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { orders: true, customers: true } },
      categories: { select: { id: true } },
    },
  })

  const aiUsage = await prisma.aIUsageLog.groupBy({
    by: ["establishmentId"],
    _sum: { costCents: true, totalTokens: true },
    _count: true,
    where: { createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
  })
  const aiMap = new Map(aiUsage.map((a) => [a.establishmentId, a]))

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Estabelecimentos</h1>
          <p className="text-zinc-500 mt-1">{establishments.length} cadastrados</p>
        </div>
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="Buscar..."
            className="bg-white border border-zinc-200 rounded-lg px-4 py-2 text-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr className="text-left text-zinc-500 uppercase text-xs">
              <th className="py-3 px-4">Nome</th>
              <th className="py-3 px-4">Categoria</th>
              <th className="py-3 px-4">Plano</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">WhatsApp</th>
              <th className="py-3 px-4">IA (mês)</th>
              <th className="py-3 px-4">Pedidos</th>
              <th className="py-3 px-4">Cadastro</th>
            </tr>
          </thead>
          <tbody>
            {establishments.map((e) => {
              const usage = aiMap.get(e.id)
              return (
                <tr key={e.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="py-3 px-4">
                    <div className="font-medium text-zinc-900">{e.name}</div>
                    <div className="text-xs text-zinc-500">{e.slug}</div>
                  </td>
                  <td className="py-3 px-4">
                    {e.category ? (
                      <span className="bg-zinc-100 text-zinc-700 px-2 py-1 rounded text-xs">{e.category}</span>
                    ) : (
                      <span className="text-zinc-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                      {e.subscriptionPlan || "trial"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={e.subscriptionStatus} />
                  </td>
                  <td className="py-3 px-4 text-xs">
                    {e.evolutionInstanceName ? (
                      <span className="text-green-600">● {e.evolutionInstanceName}</span>
                    ) : (
                      <span className="text-zinc-400">desconectado</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <div>{usage?._count || 0} msgs</div>
                    <div className="text-zinc-500">R$ {((usage?._sum.costCents || 0) / 100).toFixed(2)}</div>
                  </td>
                  <td className="py-3 px-4 text-zinc-600">{e._count.orders}</td>
                  <td className="py-3 px-4 text-xs text-zinc-500">
                    {new Date(e.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              )
            })}
            {establishments.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-zinc-500">Nenhum estabelecimento</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  const map: any = {
    active: { label: "Ativo", color: "bg-green-100 text-green-700" },
    trial: { label: "Trial", color: "bg-blue-100 text-blue-700" },
    past_due: { label: "Vencido", color: "bg-yellow-100 text-yellow-700" },
    cancelled: { label: "Cancelado", color: "bg-red-100 text-red-700" },
  }
  const s = map[status || ""] || { label: status || "—", color: "bg-zinc-100 text-zinc-700" }
  return <span className={`inline-block px-2 py-1 text-xs rounded-full ${s.color}`}>{s.label}</span>
}
