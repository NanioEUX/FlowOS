"use client"

import { useState, useEffect, useCallback } from "react"
import { CheckCircle, Clock, Banknote, CreditCard, QrCode, Loader2, ArrowLeft, Bell } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface TableRequest {
  tableNumber: number
  orders: any[]
  total: number
  requestedAt: string
}

interface Establishment {
  id: string
  name: string
  slug: string
}

export function StaffPage({ establishment }: { establishment: Establishment }) {
  const [tables, setTables] = useState<TableRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTable, setSelectedTable] = useState<TableRequest | null>(null)
  const [processing, setProcessing] = useState(false)
  const [successMsg, setSuccessMsg] = useState("")

  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch(`/api/payment-request?establishmentId=${establishment.id}`)
      if (res.ok) {
        const data = await res.json()
        setTables(data)
      }
    } catch {}
    setLoading(false)
  }, [establishment.id])

  useEffect(() => {
    fetchTables()
    const interval = setInterval(fetchTables, 10000)
    return () => clearInterval(interval)
  }, [fetchTables])

  async function confirmPayment(method: string) {
    if (!selectedTable) return
    setProcessing(true)
    try {
      const res = await fetch("/api/payment-request", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber: selectedTable.tableNumber,
          establishmentId: establishment.id,
          paymentMethod: method,
        }),
      })
      if (res.ok) {
        setSuccessMsg(`Mesa ${selectedTable.tableNumber} — Pagamento confirmado!`)
        setSelectedTable(null)
        fetchTables()
        setTimeout(() => setSuccessMsg(""), 3000)
      }
    } catch {}
    setProcessing(false)
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 px-4 py-3 bg-zinc-900">
        <div className="flex items-center gap-3">
          {selectedTable ? (
            <button onClick={() => setSelectedTable(null)} className="rounded-lg p-2 hover:bg-zinc-800">
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <Bell className="h-5 w-5 text-green-500" />
          )}
          <div>
            <h1 className="text-sm font-bold">{selectedTable ? `Mesa ${selectedTable.tableNumber}` : "Garcom"}</h1>
            <p className="text-[10px] text-zinc-500">{establishment.name}</p>
          </div>
        </div>
        {!selectedTable && tables.length > 0 && (
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold">
            {tables.length}
          </span>
        )}
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="mx-4 mt-4 rounded-xl bg-green-600/20 border border-green-600/30 p-3 text-center text-sm font-medium text-green-400">
          {successMsg}
        </div>
      )}

      {/* Table list */}
      {!selectedTable && (
        <div className="p-4 space-y-3">
          {loading && tables.length === 0 && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
            </div>
          )}

          {!loading && tables.length === 0 && (
            <div className="flex flex-col items-center py-16 text-center">
              <Bell className="mb-3 h-10 w-10 text-zinc-700" />
              <p className="text-sm text-zinc-500">Nenhuma mesa aguardando</p>
              <p className="text-xs text-zinc-600">As solicitacoes aparecerao aqui</p>
            </div>
          )}

          {tables.map((t) => (
            <button
              key={t.tableNumber}
              onClick={() => setSelectedTable(t)}
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-800/50 p-4 text-left transition-colors hover:border-green-600/50 active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-600/20 text-lg font-extrabold text-green-400">
                    {t.tableNumber}
                  </div>
                  <div>
                    <p className="text-sm font-bold">Mesa {t.tableNumber}</p>
                    <p className="text-[10px] text-zinc-500">
                      {t.orders.length} pedido(s) • {formatTime(t.requestedAt)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-extrabold text-green-400">{formatCurrency(t.total)}</p>
                  <p className="text-[10px] text-zinc-500">aguardando</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Table detail */}
      {selectedTable && (
        <div className="p-4 space-y-4">
          {/* Items summary */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-800/50 p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Resumo do pedido</p>
            <div className="space-y-2">
              {selectedTable.orders.map((order: any) => {
                const items = (() => {
                  try { return typeof order.items === "string" ? JSON.parse(order.items) : order.items } catch { return [] }
                })()
                return items.map((item: any, idx: number) => (
                  <div key={`${order.id}-${idx}`} className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">{item.quantity}x {item.name}</span>
                    <span className="text-xs font-bold text-zinc-200">{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))
              })}
            </div>
            <div className="mt-3 border-t border-zinc-700 pt-3 flex justify-between">
              <span className="text-sm font-bold text-zinc-300">Total</span>
              <span className="text-xl font-extrabold text-green-400">{formatCurrency(selectedTable.total)}</span>
            </div>
          </div>

          {/* Payment methods */}
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Forma de pagamento</p>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => confirmPayment("cash")}
                disabled={processing}
                className="flex flex-col items-center gap-2 rounded-2xl border-2 border-zinc-700 bg-zinc-800/50 p-5 transition-colors hover:border-green-500 hover:bg-green-600/10 active:scale-95 disabled:opacity-50"
              >
                <Banknote className="h-6 w-6 text-green-400" />
                <span className="text-xs font-bold">Dinheiro</span>
              </button>
              <button
                onClick={() => confirmPayment("card")}
                disabled={processing}
                className="flex flex-col items-center gap-2 rounded-2xl border-2 border-zinc-700 bg-zinc-800/50 p-5 transition-colors hover:border-green-500 hover:bg-green-600/10 active:scale-95 disabled:opacity-50"
              >
                <CreditCard className="h-6 w-6 text-green-400" />
                <span className="text-xs font-bold">Cartao</span>
              </button>
              <button
                onClick={() => confirmPayment("pix")}
                disabled={processing}
                className="flex flex-col items-center gap-2 rounded-2xl border-2 border-zinc-700 bg-zinc-800/50 p-5 transition-colors hover:border-green-500 hover:bg-green-600/10 active:scale-95 disabled:opacity-50"
              >
                <QrCode className="h-6 w-6 text-green-400" />
                <span className="text-xs font-bold">Pix</span>
              </button>
            </div>
          </div>

          {processing && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-green-500" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
