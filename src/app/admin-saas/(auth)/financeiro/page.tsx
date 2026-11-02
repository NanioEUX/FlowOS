import { prisma } from "@/lib/prisma"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

export const dynamic = "force-dynamic"

export default async function FinanceiroPage({ searchParams }: { searchParams: { establishment?: string } }) {
  const where = searchParams.establishment ? { establishmentId: searchParams.establishment } : {}
  
  const transactions = await prisma.financialTransaction.findMany({
    where,
    include: { establishment: { select: { name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  const totals = transactions.reduce((acc, t) => ({
    gross: acc.gross + t.grossAmount,
    fees: acc.fees + t.fee,
    saas: acc.saas + t.splitSaas,
  }), { gross: 0, fees: 0, saas: 0 })

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">Financeiro</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Stat label="Total Bruto" value={`R$ ${(totals.gross / 100).toFixed(2)}`} />
        <Stat label="Total Taxas" value={`R$ ${(totals.fees / 100).toFixed(2)}`} />
        <Stat label="Total SaaS" value={`R$ ${(totals.saas / 100).toFixed(2)}`} />
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-zinc-100">
              <th scope="col" className="text-left p-3 text-zinc-500 font-medium">Data</th>
              <th scope="col" className="text-left p-3 text-zinc-500 font-medium">Estabelecimento</th>
              <th scope="col" className="text-left p-3 text-zinc-500 font-medium">Tipo</th>
              <th scope="col" className="text-right p-3 text-zinc-500 font-medium">Bruto</th>
              <th scope="col" className="text-right p-3 text-zinc-500 font-medium">Taxa</th>
              <th scope="col" className="text-right p-3 text-zinc-500 font-medium">SaaS</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                <td className="p-3 text-zinc-600">{format(t.createdAt, "dd/MM/yy HH:mm", { locale: ptBR })}</td>
                <td className="p-3 text-zinc-900 font-medium">{t.establishment.name}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    t.type === "payment" ? "bg-green-100 text-green-700" :
                    t.type === "refund" ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-700"
                  }`}>
                    {t.type === "payment" ? "Pagamento" : t.type === "refund" ? "Reembolso" : "Chargeback"}
                  </span>
                </td>
                <td className="p-3 text-right text-zinc-900">R$ {(t.grossAmount / 100).toFixed(2)}</td>
                <td className="p-3 text-right text-red-600">-R$ {(t.fee / 100).toFixed(2)}</td>
                <td className="p-3 text-right text-green-600">R$ {(t.splitSaas / 100).toFixed(2)}</td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-500">Nenhuma transação encontrada</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-4">
      <p className="text-zinc-500 text-xs">{label}</p>
      <p className="text-2xl font-bold text-zinc-900">{value}</p>
    </div>
  )
}
