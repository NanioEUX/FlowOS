"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Users, Search, Phone, MapPin, ShoppingBag, DollarSign, Calendar, Loader2, X, TrendingUp, MessageSquare, ChevronRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { fetchAuth } from "@/lib/fetch-auth"
import { formatCurrency } from "@/lib/utils"

interface Customer {
  id: string
  name: string | null
  phone: string
  address: string | null
  cep: string | null
  totalOrders: number
  totalSpent: number
  createdAt: string
}

export default function ClientesPage() {
  const searchParams = useSearchParams()
  const hookEstablishmentId = useEstablishmentId()
  const establishmentId = searchParams.get("establishment") || hookEstablishmentId

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  useEffect(() => {
    if (!establishmentId) return
    fetchAuth(`/api/customers?establishmentId=${establishmentId}`)
      .then((r) => r.json())
      .then((data) => setCustomers(Array.isArray(data) ? data : []))
      .catch(() => setCustomers([]))
      .finally(() => setLoading(false))
  }, [establishmentId])

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase()
    return (
      c.name?.toLowerCase().includes(q) ||
      c.phone.includes(q)
    )
  })

  const totalCustomers = customers.length
  const totalSpent = customers.reduce((sum, c) => sum + c.totalSpent, 0)
  const totalOrders = customers.reduce((sum, c) => sum + c.totalOrders, 0)
  const topCustomers = [...customers].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5)

  function formatPhone(phone: string) {
    const digits = phone.replace(/\D/g, "")
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
    }
    return phone
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("pt-BR")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-green-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Clientes</h1>
        <p className="text-sm text-zinc-500">Gerencie e acompanhe seus clientes</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-600/15 p-2">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-900">{totalCustomers}</p>
                <p className="text-xs text-zinc-500">Clientes cadastrados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-600/10 p-2">
                <ShoppingBag className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-900">{totalOrders}</p>
                <p className="text-xs text-zinc-500">Total de pedidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/15 p-2">
                <DollarSign className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-900">{formatCurrency(totalSpent)}</p>
                <p className="text-xs text-zinc-500">Receita total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 5 Clients */}
      {topCustomers.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-3 mb-4">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <h2 className="text-sm font-bold text-zinc-800">Top 5 Clientes Fiéis</h2>
            </div>
            <div className="divide-y divide-zinc-100">
              {topCustomers.map((c, i) => (
                <div key={c.id} className="grid grid-cols-12 py-2.5 items-center text-sm">
                  <div className="col-span-1 text-zinc-400 font-bold">{i + 1}.</div>
                  <div className="col-span-5 font-semibold text-zinc-800">{c.name || formatPhone(c.phone)}</div>
                  <div className="col-span-3 text-right text-zinc-500 text-xs">{c.totalOrders} pedidos</div>
                  <div className="col-span-3 text-right font-bold text-green-600">{formatCurrency(c.totalSpent)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <input
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-zinc-50 pl-10 pr-4 py-2.5 text-sm focus:border-green-600 focus:outline-none"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="h-4 w-4 text-zinc-400 hover:text-zinc-400" />
          </button>
        )}
      </div>

      {/* Customer List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>{search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado ainda"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((customer, idx) => {
            const colors = [
              "bg-green-50 text-green-700 border-green-100",
              "bg-blue-50 text-blue-700 border-blue-100",
              "bg-amber-50 text-amber-700 border-amber-100",
              "bg-purple-50 text-purple-700 border-purple-100",
              "bg-rose-50 text-rose-700 border-rose-100",
            ]
            const colorClass = colors[idx % colors.length]
            return (
              <div
                key={customer.id}
                className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold border ${colorClass}`}>
                      {customer.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-900">{customer.name || "Sem nome"}</p>
                      <p className="text-xs font-medium text-zinc-500">{formatPhone(customer.phone)}</p>
                      <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3 w-3" /> Cliente desde {formatDate(customer.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-6 border-t border-zinc-50 pt-2 sm:border-t-0 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <span className="text-sm font-bold text-green-600 block">{formatCurrency(customer.totalSpent)}</span>
                      <span className="text-[11px] font-medium text-zinc-400 block">{customer.totalOrders} pedidos</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`https://wa.me/55${customer.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-lg border border-zinc-200 p-2 text-zinc-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                        title="Chamar no WhatsApp"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </a>
                      <button
                        onClick={() => setSelectedCustomer(selectedCustomer?.id === customer.id ? null : customer)}
                        className="rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-50 transition-colors"
                        title="Ver detalhes"
                      >
                        <ChevronRight className={`h-4 w-4 transition-transform ${selectedCustomer?.id === customer.id ? "rotate-90" : ""}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {selectedCustomer?.id === customer.id && (
                  <div className="mt-3 pt-3 border-t border-zinc-100 space-y-2 text-sm">
                    {customer.address && (
                      <div className="flex items-center gap-2 text-zinc-500">
                        <MapPin className="h-4 w-4" />
                        <span>{customer.address}{customer.cep ? ` - CEP: ${customer.cep}` : ""}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-zinc-500">
                      <Phone className="h-4 w-4" />
                      <span>{formatPhone(customer.phone)}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
