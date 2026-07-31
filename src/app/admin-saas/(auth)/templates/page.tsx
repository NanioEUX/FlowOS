import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function TemplatesPage() {
  const templates = await prisma.categoryTemplate.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { id: true } },
    },
  })

  const establishmentsByCategory = await prisma.establishment.groupBy({
    by: ["category"],
    _count: true,
  })

  const countMap = new Map<string, number>()
  for (const e of establishmentsByCategory) {
    if (e.category) countMap.set(e.category, e._count)
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Templates por Categoria</h1>
          <p className="text-zinc-500 mt-1">Prompt base que cada tipo de estabelecimento recebe</p>
        </div>
        <a
          href="/admin-saas/templates/novo"
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm"
        >
          + Novo template
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((t) => (
          <div key={t.id} className={`bg-white rounded-xl border p-5 ${t.enabled ? "border-zinc-200" : "border-zinc-200 opacity-60"}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{t.icon || "🏪"}</span>
                <div>
                  <h3 className="font-bold text-zinc-900">{t.name}</h3>
                  <p className="text-xs text-zinc-500">{t.slug}</p>
                </div>
              </div>
              {countMap.get(t.slug) ? (
                <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">
                  {countMap.get(t.slug)} ativos
                </span>
              ) : null}
            </div>

            <p className="text-sm text-zinc-600 mb-3">{t.description}</p>

            <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3">
              <span className="bg-zinc-100 px-2 py-0.5 rounded">Tom: {t.tone}</span>
              <span className="bg-zinc-100 px-2 py-0.5 rounded">Agente: {t.defaultAgentName}</span>
            </div>

            <div className="text-xs text-zinc-500 bg-zinc-50 rounded p-2 max-h-20 overflow-hidden mb-3 font-mono">
              {t.promptBase.substring(0, 150)}...
            </div>

            <div className="flex gap-2">
              <a
                href={`/admin-saas/templates/${t.id}`}
                className="flex-1 text-center bg-zinc-900 hover:bg-zinc-800 text-white text-xs py-2 rounded-lg"
              >
                Editar
              </a>
              {!t.enabled && (
                <span className="text-xs text-red-600 flex items-center px-2">Desabilitado</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
