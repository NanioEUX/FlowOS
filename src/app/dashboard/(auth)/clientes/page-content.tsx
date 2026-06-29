"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Users, Search, Phone, MapPin, ShoppingBag, DollarSign, Calendar, Loader2, X } from "lucide-react"
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
        <Loader2 className="h-6 w-6 animate-spin text-flow-blue" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-flow-white">Clientes</h1>
        <p className="text-sm text-zinc-500">Gerencie e acompanhe seus clientes</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-flow-blue/15 p-2">
                <Users className="h-5 w-5 text-flow-blue" />
              </div>
              <div>
                <p className="text-2xl font-bold text-flow-white">{totalCustomers}</p>
                <p className="text-xs text-zinc-500">Clientes cadastrados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-flow-blue/10 p-2">
                <ShoppingBag className="h-5 w-5 text-flow-blue" />
              </div>
              <div>
                <p className="text-2xl font-bold text-flow-white">{totalOrders}</p>
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
                <p className="text-2xl font-bold text-flow-white">{formatCurrency(totalSpent)}</p>
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
            <h2 className="text-sm font-semibold text-zinc-300 mb-3">Top 5 Clientes</h2>
            <div className="space-y-2">
              {topCustomers.map((c, i) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-400 w-5">{i + 1}.</span>
                    <span className="font-medium text-zinc-200">{c.name || formatPhone(c.phone)}</span>
                  </div>
                  <div className="flex items-center gap-4 text-zinc-500">
                    <span>{c.totalOrders} pedidos</span>
                    <span className="font-semibold text-flow-blue">{formatCurrency(c.totalSpent)}</span>
                  </div>
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
          className="w-full rounded-lg border border-white/[.06] pl-10 pr-4 py-2.5 text-sm focus:border-flow-blue focus:outline-none"
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
        <div className="space-y-2">
          {filtered.map((customer) => (
            <button
              key={customer.id}
              onClick={() => setSelectedCustomer(selectedCustomer?.id === customer.id ? null : customer)}
              className="w-full text-left rounded-lg border border-white/[.06] p-4 hover:border-flow-green/30 hover:bg-flow-blue/10/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-flow-blue/10 text-sm font-bold text-flow-blue">
                    {customer.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="font-medium text-flow-white">{customer.name || "Sem nome"}</p>
                    <p className="text-xs text-zinc-500">{formatPhone(customer.phone)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-flow-blue">{formatCurrency(customer.totalSpent)}</p>
                  <p className="text-xs text-zinc-400">{customer.totalOrders} pedidos</p>
                </div>
              </div>

              {/* Expanded details */}
              {selectedCustomer?.id === customer.id && (
                <div className="mt-3 pt-3 border-t border-white/[.04] space-y-2 text-sm">
                  {customer.address && (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <MapPin className="h-4 w-4" />
                      <span>{customer.address}{customer.cep ? ` - CEP: ${customer.cep}` : ""}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Calendar className="h-4 w-4" />
                    <span>Cliente desde {formatDate(customer.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Phone className="h-4 w-4" />
                    <a
                      href={`https://wa.me/55${customer.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-flow-blue hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Abrir WhatsApp
                    </a>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
