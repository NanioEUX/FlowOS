"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { TrendingUp, Clock, Store, DollarSign, CreditCard, Banknote } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/components/toast"
import { formatCurrency } from "@/lib/utils"
import { fetchAuth } from "@/lib/fetch-auth"

const paymentLabels: Record<string, string> = { cash: "Dinheiro", card: "Cartão", pix: "Pix", online: "Online" }

export default function CaixaPage() {
  const searchParams = useSearchParams()
  const hookEstablishmentId = useEstablishmentId()
  const searchParamsEstablishmentId = searchParams.get("establishment")
  const establishmentId = searchParamsEstablishmentId || hookEstablishmentId
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [cashRegister, setCashRegister] = useState<any>(null)
  // F8B-022: falha HTTP (500/403) mostrava "R$ 0,00" como se não houvesse venda
  const [loadError, setLoadError] = useState(false)
  const { toast } = useToast()

  // F8B-001: falha de rede não pode deixar o spinner eterno.
  async function loadAll() {
    if (!establishmentId) return
    try {
      await loadAllInner()
    } catch (err) {
      console.error("[Caixa] Falha ao carregar dados:", err)
      toast("Não foi possível carregar o caixa. Verifique sua conexão.", "error")
    } finally {
      setLoading(false)
    }
  }

  async function loadAllInner() {
    const [orderRes, regRes] = await Promise.all([
      fetchAuth(`/api/orders?establishmentId=${establishmentId}`),
      fetchAuth(`/api/cash-register?establishmentId=${establishmentId}`),
    ])
    if (!orderRes.ok || !regRes.ok) {
      setLoadError(true)
      return
    }
    const data = await orderRes.json()
    setOrders(Array.isArray(data) ? data : [])
    setCashRegister(await regRes.json())
    setLoadError(false)
  }

  useEffect(() => { loadAll() }, [establishmentId]) // eslint-disable-line react-hooks/exhaustive-deps

  const todayOrders = orders.filter((o) => {
    const d = new Date(o.createdAt)
    const now = new Date()
    return d.toDateString() === now.toDateString() && o.status !== "cancelled" && o.orderType === "presencial"
  })

  const todayCash = todayOrders.filter((o) => o.paymentMethod === "cash").reduce((s, o) => s + o.total, 0)
  const todayCard = todayOrders.filter((o) => o.paymentMethod === "card").reduce((s, o) => s + o.total, 0)
  const todayPix = todayOrders.filter((o) => o.paymentMethod === "pix").reduce((s, o) => s + o.total, 0)
  const todayTotal = todayCash + todayCard + todayPix

  // Active presencial orders (for table management overview)
  const activePresencial = orders.filter((o) => o.orderType === "presencial" && !["delivered", "cancelled"].includes(o.status))
  const mesaGroups: Record<number, any[]> = {}
  for (const o of activePresencial) {
    if (o.tableNumber) {
      if (!mesaGroups[o.tableNumber]) mesaGroups[o.tableNumber] = []
      mesaGroups[o.tableNumber].push(o)
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Caixa - Gerenciamento</h1>
        <p className="text-sm text-zinc-500">Vendas são feitas na Frente de Caixa</p>
      </div>

      {/* Resumo do dia */}
      <Card className="border-green-600/20 bg-green-600/10">
        <CardContent className="p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-green-600 mb-3">
            <TrendingUp className="h-4 w-4" />
            Resumo do Dia
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-lg font-bold text-green-600">{formatCurrency(todayTotal)}</p>
              <p className="text-xs text-green-600">Total</p>
            </div>
            <div>
              <p className="text-lg font-bold text-green-600">{formatCurrency(todayCash)}</p>
              <p className="text-xs text-green-600">Dinheiro</p>
            </div>
            <div>
              <p className="text-lg font-bold text-green-600">{formatCurrency(todayCard)}</p>
              <p className="text-xs text-blue-500">Cartão</p>
            </div>
            <div>
              <p className="text-lg font-bold text-purple-600">{formatCurrency(todayPix)}</p>
              <p className="text-xs text-purple-500">Pix</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-green-600 text-center">{todayOrders.length} vendas hoje</p>
        </CardContent>
      </Card>

      {/* F8B-022: não mostrar "R$ 0,00" quando a carga falhou */}
      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>Não foi possível carregar o caixa. Os valores abaixo podem estar incompletos.</span>
          <button onClick={() => loadAll()} className="shrink-0 rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold hover:bg-red-100">
            Tentar novamente
          </button>
        </div>
      )}

      {/* Caixa status */}
      {cashRegister ? (
        <Card className="border-green-600/20">
          <CardContent className="p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-green-600 mb-2">
              <DollarSign className="h-4 w-4" />
              Caixa Aberto
            </h2>
            <p className="text-xs text-zinc-500">Valor em caixa: <span className="font-bold text-zinc-900">{formatCurrency(cashRegister.openingAmount)}</span></p>
            <p className="text-xs text-zinc-500">Movimentações: <span className="font-bold text-zinc-900">{cashRegister.movements?.length || 0}</span></p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <p className="text-sm text-yellow-700">Caixa fechado. Abra o caixa na Frente de Caixa para iniciar as vendas.</p>
          </CardContent>
        </Card>
      )}

      {/* Mesas ativas */}
      {Object.keys(mesaGroups).length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 mb-3">
              <Store className="h-4 w-4" />
              Mesas Ativas ({Object.keys(mesaGroups).length})
            </h2>
            <div className="space-y-2">
              {Object.entries(mesaGroups).sort(([a], [b]) => Number(a) - Number(b)).map(([num, mesaOrders]) => {
                const total = mesaOrders.reduce((s: number, o: any) => s + o.total, 0)
                return (
                  <div key={num} className="flex items-center justify-between rounded-lg border border-white/[.04] bg-zinc-50 p-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">Mesa {num}</p>
                      <p className="text-xs text-zinc-500">{mesaOrders.length} pedido(s)</p>
                    </div>
                    <p className="text-sm font-bold text-green-600">{formatCurrency(total)}</p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Últimas vendas do dia */}
      {todayOrders.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="font-semibold text-zinc-900 mb-3">Vendas de Hoje ({todayOrders.length})</h2>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {todayOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded-lg border border-white/[.04] bg-zinc-50 p-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{o.customerName}</p>
                    <p className="text-xs text-zinc-500">{new Date(o.createdAt).toLocaleTimeString("pt-BR")} • {paymentLabels[o.paymentMethod] || o.paymentMethod || "Pendente"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">{formatCurrency(o.total)}</p>
                    <p className={`text-[10px] font-medium ${
                      o.status === "delivered" ? "text-green-600" :
                      o.status === "new" ? "text-zinc-500" :
                      o.status === "preparing" ? "text-amber-400" :
                      o.status === "ready" ? "text-green-600" : "text-zinc-500"
                    }`}>
                      {o.status === "new" ? "Aguardando" : o.status === "preparing" ? "Preparando" : o.status === "ready" ? "Pronto" : o.status === "delivered" ? "Finalizado" : o.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
