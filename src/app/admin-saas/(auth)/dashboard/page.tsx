import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

async function loadData() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    totalEstabelecimentos,
    estabelecimentosAtivos,
    totalPedidosMes,
    faturamentoMes,
    aiUsageMonth,
    aiCostMonth,
    recentOrders,
    instanciasConectadas,
    instanciasTotal,
  ] = await Promise.all([
    prisma.establishment.count(),
    prisma.establishment.count({
      where: { OR: [{ subscriptionStatus: "active" }, { subscriptionStatus: "trial" }] },
    }),
    prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.order.aggregate({
      where: { createdAt: { gte: startOfMonth }, status: { not: "cancelled" } },
      _sum: { total: true },
    }),
    prisma.aIUsageLog.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.aIUsageLog.aggregate({
      where: { createdAt: { gte: startOfMonth } },
      _sum: { costCents: true },
    }),
    prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { establishment: { select: { name: true } } },
    }),
    prisma.establishment.count({
      where: { evolutionInstanceName: { not: null }, whatsappProvider: "evolution" },
    }),
    prisma.establishment.count({ where: { evolutionInstanceName: { not: null } } }),
  ])

  return {
    totalEstabelecimentos,
    estabelecimentosAtivos,
    totalPedidosMes,
    faturamentoMes: faturamentoMes._sum.total || 0,
    aiUsageMonth,
    aiCostMonth: (aiCostMonth._sum.costCents || 0) / 100,
    recentOrders,
    instanciasConectadas,
    instanciasTotal,
  }
}

async function checkMonitors() {
  const checks = {
    supabase: { ok: true, label: "Supabase" },
    vercel: { ok: true, label: "Vercel" },
    openai: { ok: true, label: "OpenAI" },
    evolution: { ok: true, label: "Evolution" },
  }
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    checks.supabase = { ok: false, label: "Supabase" }
  }
  return checks
}

export default async function DashboardPage() {
  const data = await loadData()
  const monitors = await checkMonitors()

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900">Visão Geral</h1>
        <p className="text-zinc-500 mt-1">Painel de controle do SaaS</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPI label="Estabelecimentos Ativos" value={data.estabelecimentosAtivos} sub={`${data.totalEstabelecimentos} total`} icon="🏪" />
        <KPI label="Pedidos no Mês" value={data.totalPedidosMes} sub="Total geral" icon="📦" />
        <KPI label="Faturamento Mês" value={`R$ ${data.faturamentoMes.toFixed(2)}`} sub="Soma de pedidos" icon="💰" color="green" />
        <KPI label="Custo IA Mês" value={`R$ ${data.aiCostMonth.toFixed(2)}`} sub={`${data.aiUsageMonth} chamadas`} icon="🤖" color={data.aiCostMonth > 100 ? "red" : "blue"} />
      </div>

      {/* Monitores */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6 mb-8">
        <h2 className="text-lg font-bold text-zinc-900 mb-4">Monitores de Serviço</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.values(monitors).map((m) => (
            <Monitor key={m.label} ok={m.ok} label={m.label} />
          ))}
        </div>
      </div>

      {/* Status rápido */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="text-lg font-bold text-zinc-900 mb-4">WhatsApp</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-zinc-900">{data.instanciasConectadas}</p>
              <p className="text-sm text-zinc-500">de {data.instanciasTotal} instâncias</p>
            </div>
            <div className="text-4xl">📱</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="text-lg font-bold text-zinc-900 mb-4">Próximos Passos</h2>
          <ul className="space-y-2 text-sm text-zinc-600">
            <li>✅ Templates por categoria configurados</li>
            <li>✅ Respostas rápidas globais ativas</li>
            <li>📝 Painel de estabelecimento em uso</li>
            <li>🚀 Monitore custo de IA regularmente</li>
          </ul>
        </div>
      </div>

      {/* Pedidos recentes */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <h2 className="text-lg font-bold text-zinc-900 mb-4">Pedidos Recentes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200">
              <tr className="text-left text-zinc-500">
                <th className="py-2 px-3">Pedido</th>
                <th className="py-2 px-3">Estabelecimento</th>
                <th className="py-2 px-3">Total</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Quando</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((o) => (
                <tr key={o.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="py-2 px-3 font-medium">#{o.orderNumber || o.id.slice(-6)}</td>
                  <td className="py-2 px-3">{o.establishment.name}</td>
                  <td className="py-2 px-3 font-medium text-green-600">R$ {o.total.toFixed(2)}</td>
                  <td className="py-2 px-3"><StatusBadge status={o.status} /></td>
                  <td className="py-2 px-3 text-zinc-500">{new Date(o.createdAt).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function KPI({ label, value, sub, icon, color = "zinc" }: any) {
  const colors: any = {
    green: "text-green-600",
    red: "text-red-600",
    blue: "text-blue-600",
    zinc: "text-zinc-900",
  }
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-zinc-500">{label}</p>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${colors[color]}`}>{value}</p>
      <p className="text-xs text-zinc-400 mt-1">{sub}</p>
    </div>
  )
}

function Monitor({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${ok ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
      <div className={`w-2.5 h-2.5 rounded-full ${ok ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
      <div>
        <p className="font-medium text-sm text-zinc-900">{label}</p>
        <p className={`text-xs ${ok ? "text-green-600" : "text-red-600"}`}>{ok ? "Operacional" : "Com problema"}</p>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: any = {
    pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-700" },
    preparing: { label: "Preparando", color: "bg-blue-100 text-blue-700" },
    ready: { label: "Pronto", color: "bg-green-100 text-green-700" },
    delivering: { label: "Entregando", color: "bg-purple-100 text-purple-700" },
    delivered: { label: "Entregue", color: "bg-green-100 text-green-700" },
    cancelled: { label: "Cancelado", color: "bg-red-100 text-red-700" },
  }
  const s = map[status] || { label: status, color: "bg-zinc-100 text-zinc-700" }
  return <span className={`inline-block px-2 py-1 text-xs rounded-full ${s.color}`}>{s.label}</span>
}
