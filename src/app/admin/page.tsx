import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const establishments = await prisma.establishment.findMany({
    include: { orders: { select: { total: true, status: true } } },
    orderBy: { createdAt: "desc" },
  })

  const totalOrders = establishments.reduce((s, e) => s + e.orders.length, 0)
  const totalRevenue = establishments.reduce((s, e) => s + e.orders.reduce((s2, o) => s2 + o.total, 0), 0)

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-8 text-3xl font-bold text-zinc-900">Admin FlowOS</h1>

        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-sm text-zinc-500">Total Estabelecimentos</p>
            <p className="text-2xl font-bold">{establishments.length}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-sm text-zinc-500">Total Pedidos</p>
            <p className="text-2xl font-bold">{totalOrders}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-sm text-zinc-500">Faturamento Bruto</p>
            <p className="text-2xl font-bold text-green-600">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalRevenue)}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50">
              <tr>
                <th className="text-left p-4 font-medium text-zinc-600">Estabelecimento</th>
                <th className="text-left p-4 font-medium text-zinc-600">Email</th>
                <th className="text-center p-4 font-medium text-zinc-600">Pedidos</th>
                <th className="text-right p-4 font-medium text-zinc-600">Faturamento</th>
                <th className="text-center p-4 font-medium text-zinc-600">Asaas</th>
              </tr>
            </thead>
            <tbody>
              {establishments.map((est) => {
                const totalOrders = est.orders.length
                const revenue = est.orders.reduce((s, o) => s + o.total, 0)
                const hasAsaas = est.asaasApiKey && est.asaasApiKey.length > 0

                return (
                  <tr key={est.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="p-4">
                      <a href={`/${est.slug}`} target="_blank" className="font-medium text-zinc-900 hover:text-[#FF6B35]">
                        {est.name}
                      </a>
                      <p className="text-xs text-zinc-400">/{est.slug}</p>
                    </td>
                    <td className="p-4 text-zinc-600">{est.email}</td>
                    <td className="p-4 text-center font-medium">{totalOrders}</td>
                    <td className="p-4 text-right font-medium text-green-600">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(revenue)}
                    </td>
                    <td className="p-4 text-center">
                      {hasAsaas ? "✅" : "❌"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-zinc-400">
          Acesso restrito. Esta página mostra apenas dados consolidados para administração da plataforma.
        </p>
      </div>
    </div>
  )
}
