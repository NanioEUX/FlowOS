"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { TrendingUp, Clock, Store, DollarSign, CreditCard, Banknote } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
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

  async function loadAll() {
    if (!establishmentId) return
    const [orderRes, regRes] = await Promise.all([
      fetchAuth(`/api/orders?establishmentId=${establishmentId}`),
      fetchAuth(`/api/cash-register?establishmentId=${establishmentId}`),
    ])
    if (orderRes.ok) {
      const data = await orderRes.json()
      setOrders(data)
    }
    if (regRes.ok) {
      setCashRegister(await regRes.json())
    }
    setLoading(false)
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

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-flow-blue border-t-transparent" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-flow-white">Caixa - Gerenciamento</h2>
        <p className="text-sm text-zinc-500">Vendas são feitas na Frente de Caixa</p>
      </div>

      {/* Resumo do dia */}
      <Card className="border-flow-blue/20 bg-flow-blue/10">
        <CardContent className="p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-flow-blue mb-3">
            <TrendingUp className="h-4 w-4" />
            Resumo do Dia
          </h3>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-lg font-bold text-flow-blue">{formatCurrency(todayTotal)}</p>
              <p className="text-xs text-flow-blue">Total</p>
            </div>
            <div>
              <p className="text-lg font-bold text-flow-blue">{formatCurrency(todayCash)}</p>
              <p className="text-xs text-flow-green">Dinheiro</p>
            </div>
            <div>
              <p className="text-lg font-bold text-flow-blue">{formatCurrency(todayCard)}</p>
              <p className="text-xs text-blue-500">Cartão</p>
            </div>
            <div>
              <p className="text-lg font-bold text-purple-600">{formatCurrency(todayPix)}</p>
              <p className="text-xs text-purple-500">Pix</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-flow-blue text-center">{todayOrders.length} vendas hoje</p>
        </CardContent>
      </Card>

      {/* Caixa status */}
      {cashRegister ? (
        <Card className="border-flow-blue/20">
          <CardContent className="p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-flow-blue mb-2">
              <DollarSign className="h-4 w-4" />
              Caixa Aberto
            </h3>
            <p className="text-xs text-zinc-500">Valor em caixa: <span className="font-bold text-flow-white">{formatCurrency(cashRegister.openingAmount)}</span></p>
            <p className="text-xs text-zinc-500">Movimentações: <span className="font-bold text-flow-white">{cashRegister.movements?.length || 0}</span></p>
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
            <h3 className="flex items-center gap-2 text-sm font-semibold text-flow-white mb-3">
              <Store className="h-4 w-4" />
              Mesas Ativas ({Object.keys(mesaGroups).length})
            </h3>
            <div className="space-y-2">
              {Object.entries(mesaGroups).sort(([a], [b]) => Number(a) - Number(b)).map(([num, mesaOrders]) => {
                const total = mesaOrders.reduce((s: number, o: any) => s + o.total, 0)
                return (
                  <div key={num} className="flex items-center justify-between rounded-lg border border-white/[.04] bg-white/[.03] p-3">
                    <div>
                      <p className="text-sm font-medium text-flow-white">Mesa {num}</p>
                      <p className="text-xs text-zinc-500">{mesaOrders.length} pedido(s)</p>
                    </div>
                    <p className="text-sm font-bold text-flow-blue">{formatCurrency(total)}</p>
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
            <h3 className="font-semibold text-flow-white mb-3">Vendas de Hoje ({todayOrders.length})</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {todayOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded-lg border border-white/[.04] bg-white/[.03] p-3">
                  <div>
                    <p className="text-sm font-medium text-flow-white">{o.customerName}</p>
                    <p className="text-xs text-zinc-400">{new Date(o.createdAt).toLocaleTimeString("pt-BR")} • {paymentLabels[o.paymentMethod] || o.paymentMethod || "Pendente"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-flow-blue">{formatCurrency(o.total)}</p>
                    <p className={`text-[10px] font-medium ${
                      o.status === "delivered" ? "text-flow-blue" :
                      o.status === "new" ? "text-zinc-500" :
                      o.status === "preparing" ? "text-amber-400" :
                      o.status === "ready" ? "text-flow-blue" : "text-zinc-500"
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
