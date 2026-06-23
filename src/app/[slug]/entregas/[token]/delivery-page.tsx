"use client"

import { useEffect, useState } from "react"
import { Bike, Phone, MapPin, CheckCircle, Clock, Package, X, DollarSign, TrendingUp, Calendar, Loader2, Eye, EyeOff } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"

interface OrderItem {
  id: string
  name: string
  price: number
  quantity: number
}

interface Order {
  id: string
  orderNumber: number | null
  customerName: string
  customerPhone: string | null
  customerAddress: string | null
  items: string
  total: number
  status: string
  notes: string | null
  createdAt: string
  paymentMethod: string
  deliveryFee: number
  assignedAt: string | null
  deliveredAt: string | null
}

interface PersonData {
  id: string
  name: string
  phone: string
  userId: string | null
  mustChangePassword: boolean
  establishment: { name: string; phone: string; slug: string; logo: string | null }
}

type Period = "today" | "month" | "all"

export function DeliveryPage({ token }: { token: string }) {
  const [authenticated, setAuthenticated] = useState(false)
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState("")
  const [loginLoading, setLoginLoading] = useState(false)

  const [person, setPerson] = useState<PersonData | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [updating, setUpdating] = useState<string | null>(null)
  const [active, setActive] = useState(true)
  const [period, setPeriod] = useState<Period>("today")

  useEffect(() => {
    // Check main login (from /login page) - prefer this
    const userStored = localStorage.getItem("pedefacil-user")
    if (userStored) {
      try {
        const userData = JSON.parse(userStored)
        if (userData.role === "motoboy" && userData.deliveryPerson?.token === token) {
          setAuthenticated(true)
          return
        }
      } catch {}
    }
    // Check delivery page direct login
    const stored = localStorage.getItem(`pedefacil-motoboy-${token}`)
    if (stored) {
      try {
        const data = JSON.parse(stored)
        if (data.token === token) {
          setAuthenticated(true)
        }
      } catch {}
    }
  }, [token])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError("")
    setLoginLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setLoginError(data.error || "Email ou senha inválidos")
        return
      }
      if (data.user.role !== "motoboy" || !data.user.deliveryPerson) {
        setLoginError("Esta conta não é de um entregador")
        return
      }
      if (data.user.deliveryPerson.token !== token) {
        setLoginError("Este login não corresponde a este link de entrega")
        return
      }
      localStorage.setItem(`pedefacil-motoboy-${token}`, JSON.stringify({ token, name: data.user.name }))
      setAuthenticated(true)
    } catch {
      setLoginError("Erro de conexão")
    } finally {
      setLoginLoading(false)
    }
  }

  async function handleLogout() {
    localStorage.removeItem(`pedefacil-motoboy-${token}`)
    localStorage.removeItem("pedefacil-user")
    setAuthenticated(false)
    setPerson(null)
    setOrders([])
    setLoading(true)
  }
  async function loadDeliveries() {
    try {
      const res = await fetch(`/api/delivery-persons/deliveries?token=${token}&all=true`)
      if (!res.ok) {
        if (res.status === 404) setError("Link inválido")
        else setError("Erro ao carregar")
        return
      }
      const data = await res.json()
      setPerson(data.person)
      setOrders(data.orders)
      setActive(data.person.isActive)
    } catch {
      setError("Erro ao carregar")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (authenticated) loadDeliveries() }, [token, authenticated])
  useEffect(() => { if (!authenticated) return; const i = setInterval(loadDeliveries, 10000); return () => clearInterval(i) }, [token, authenticated])

  // Subscribe to push notifications
  useEffect(() => {
    if (!person?.id || !("serviceWorker" in navigator) || !("PushManager" in window)) return

    async function subscribe() {
      try {
        const permission = await Notification.requestPermission()
        if (permission !== "granted") return

        const reg = await navigator.serviceWorker.ready
        const res = await fetch("/api/push")
        const { publicKey } = await res.json()
        if (!publicKey) return

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicKey,
        })

        await fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription: sub.toJSON(),
            deliveryPersonId: person!.id,
            establishmentId: "", // will be resolved server-side if needed
          }),
        })
      } catch {}
    }
    subscribe()
  }, [person?.id])

  async function updateStatus(orderId: string, status: string) {
    setUpdating(orderId)
    try {
      await fetch(`/api/delivery-persons/deliveries`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status, token }),
      })
      loadDeliveries()
    } catch {} finally {
      setUpdating(null)
    }
  }

  async function toggleActive() {
    await fetch(`/api/delivery-persons/deliveries`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toggleActive: true, token }),
    })
    loadDeliveries()
  }

  function filterByPeriod(list: Order[]) {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    return list.filter((o) => {
      const d = new Date(o.createdAt)
      if (period === "today") return d >= startOfDay
      if (period === "month") return d >= startOfMonth
      return true
    })
  }

  const activeOrders = orders.filter((o) => ["ready", "out_for_delivery"].includes(o.status))
  const deliveredOrders = filterByPeriod(orders.filter((o) => o.status === "delivered"))
  const totalDeliveries = deliveredOrders.length
  const totalFees = deliveredOrders.reduce((s, o) => s + (o.deliveryFee || 0), 0)

  // Calculate average delivery time
  const deliveryTimes = deliveredOrders
    .filter((o) => o.assignedAt && o.deliveredAt)
    .map((o) => new Date(o.deliveredAt!).getTime() - new Date(o.assignedAt!).getTime())
  const avgDeliveryMs = deliveryTimes.length > 0 ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length : 0
  const avgDeliveryMin = Math.round(avgDeliveryMs / 60000)

  const readyOrders = activeOrders.filter((o) => o.status === "ready")
  const outOrders = activeOrders.filter((o) => o.status === "out_for_delivery")

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100">
              <Bike className="h-7 w-7 text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-zinc-900">Área do Entregador</h1>
            <p className="text-sm text-zinc-500">Faça login para ver suas entregas</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 pr-10 text-sm focus:border-green-500 focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {loginError && <p className="text-sm text-red-500">{loginError}</p>}
              <Button type="submit" className="w-full" disabled={loginLoading}>
                {loginLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {loginLoading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    )
  }

  if (error || !person) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 p-4">
        <X className="h-12 w-12 text-red-400" />
        <p className="text-lg font-medium text-zinc-600">{error || "Link inválido"}</p>
        <p className="text-sm text-zinc-400">Verifique o link com o estabelecimento</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-12">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            {person.establishment.logo ? (
              <img src={person.establishment.logo} alt={person.establishment.name} className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <img src="/icons/pedefacil-icon.svg" alt="PedeFácil" className="h-10 w-10" />
            )}
            <div>
              <h1 className="text-lg font-bold text-zinc-900">Olá, {person.name}!</h1>
              <p className="text-sm text-zinc-500">{person.establishment.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleActive}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${active ? "bg-green-500" : "bg-zinc-300"}`} />
              {active ? "Online" : "Offline"}
            </button>
            <button
              onClick={handleLogout}
              className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              title="Sair"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-6 space-y-6">
        {/* Change password (if mustChangePassword) */}
        <ChangePasswordWidget userId={person.userId} mustChangePassword={person.mustChangePassword} />

        {/* Earnings */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
                <TrendingUp className="h-4 w-4" />
                Meus ganhos
              </h2>
              <div className="flex gap-1">
                {(["today", "month", "all"] as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      period === p ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                    }`}
                  >
                    {p === "today" ? "Hoje" : p === "month" ? "Mês" : "Total"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-green-50 p-3">
                <p className="text-lg font-bold text-green-600">{totalDeliveries}</p>
                <p className="text-xs text-green-500">Entregas</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="text-lg font-bold text-amber-600">{formatCurrency(totalFees)}</p>
                <p className="text-xs text-amber-500">A receber</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-lg font-bold text-blue-600">{avgDeliveryMin > 0 ? `${avgDeliveryMin}min` : "-"}</p>
                <p className="text-xs text-blue-500">Média entrega</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Prontos */}
        {readyOrders.length > 0 && (
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-500 uppercase tracking-wider">
              <Package className="h-4 w-4" />
              Prontos pra sair ({readyOrders.length})
            </h2>
            <div className="space-y-3">
              {readyOrders.map(order => (
                <OrderCard key={order.id} order={order} statusLabel="Saiu pra entrega" statusAction="out_for_delivery" onUpdate={updateStatus} updating={updating === order.id} />
              ))}
            </div>
          </div>
        )}

        {/* Em rota */}
        {outOrders.length > 0 && (
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-500 uppercase tracking-wider">
              <Clock className="h-4 w-4" />
              Em rota ({outOrders.length})
            </h2>
            <div className="space-y-3">
              {outOrders.map(order => (
                <OrderCard key={order.id} order={order} statusLabel="Entregue" statusAction="delivered" onUpdate={updateStatus} updating={updating === order.id} />
              ))}
            </div>
          </div>
        )}

        {readyOrders.length === 0 && outOrders.length === 0 && deliveredOrders.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center">
            <Bike className="mx-auto h-8 w-8 text-zinc-300" />
            <p className="mt-2 text-lg font-medium text-zinc-500">Nenhuma entrega no momento</p>
            <p className="text-sm text-zinc-400">Seus pedidos aparecerão aqui</p>
          </div>
        )}

        {/* Histórico de entregues */}
        {deliveredOrders.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-400 hover:text-zinc-600">
              Entregues recentes ({deliveredOrders.length})
            </summary>
            <div className="mt-3 space-y-2">
              {deliveredOrders.slice(0, 20).map(order => {
                const deliveryTime = order.assignedAt && order.deliveredAt
                  ? Math.round((new Date(order.deliveredAt).getTime() - new Date(order.assignedAt).getTime()) / 60000)
                  : null
                return (
                  <div key={order.id} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-white p-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {order.orderNumber && (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                            #{order.orderNumber}
                          </span>
                        )}
                        <p className="text-sm font-medium text-zinc-900">{order.customerName}</p>
                      </div>
                      <p className="text-xs text-zinc-400">
                        {new Date(order.deliveredAt || order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        {deliveryTime !== null && ` • ${deliveryTime}min`}
                      </p>
                    </div>
                    <p className="text-xs font-medium text-amber-600">{formatCurrency(order.deliveryFee)}</p>
                  </div>
                )
              })}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

function OrderCard({ order, statusLabel, statusAction, onUpdate, updating }: {
  order: Order
  statusLabel: string
  statusAction: string
  onUpdate: (id: string, status: string) => void
  updating: boolean
}) {
  const items: OrderItem[] = JSON.parse(order.items)

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {order.orderNumber && (
                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                  #{order.orderNumber}
                </span>
              )}
              <p className="font-semibold text-zinc-900">{order.customerName}</p>
            </div>
            <p className="text-xs text-zinc-400">{new Date(order.createdAt).toLocaleString("pt-BR")}</p>

            {order.customerPhone && (
              <a href={`https://wa.me/55${order.customerPhone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1 text-sm text-green-600 hover:underline">
                <Phone className="h-3 w-3" />
                {order.customerPhone}
              </a>
            )}
            {order.customerAddress && (
              <div className="mt-1">
                <p className="flex items-start gap-1 text-sm text-zinc-600">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                  {order.customerAddress}
                </p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customerAddress)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-4 text-xs text-blue-500 hover:underline"
                >
                  Abrir no Google Maps
                </a>
              </div>
            )}

            <div className="mt-2 space-y-0.5 text-sm text-zinc-600">
              {items.map((item, i) => (
                <p key={i}>{item.quantity}x {item.name}</p>
              ))}
            </div>

            {order.notes && <p className="mt-1 text-sm text-zinc-400 italic">Obs: {order.notes}</p>}
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <p className="text-sm font-bold text-amber-600">{formatCurrency(order.deliveryFee)}</p>
            <Badge variant={statusAction === "out_for_delivery" ? "warning" : "success"}>
              {order.status === "ready" ? "Pronto" : "Em rota"}
            </Badge>
            <Button size="sm" onClick={() => onUpdate(order.id, statusAction)} disabled={updating} className="gap-1">
              {updating ? "..." : <><CheckCircle className="h-4 w-4" />{statusLabel}</>}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ChangePasswordWidget({ userId, mustChangePassword }: { userId: string | null; mustChangePassword: boolean }) {
  const [show, setShow] = useState(mustChangePassword)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!userId) return null

  async function handleChange() {
    setError("")
    if (!currentPassword || !newPassword) {
      setError("Preencha todos os campos")
      return
    }
    if (newPassword.length < 4) {
      setError("Nova senha deve ter pelo menos 4 caracteres")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("As senhas não conferem")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Erro ao alterar senha")
        return
      }
      setSuccess(true)
      setShow(false)
    } catch {
      setError("Erro de conexão")
    } finally {
      setSaving(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
        Senha alterada com sucesso!
      </div>
    )
  }

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="text-xs text-zinc-400 hover:text-zinc-600"
      >
        Alterar senha
      </button>
    )
  }

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardContent className="p-4">
        <p className="text-sm font-semibold text-amber-700 mb-3">
          {mustChangePassword ? "Alterar sua senha padrão" : "Alterar senha"}
        </p>
        <div className="space-y-2">
          <input
            type="password"
            placeholder="Senha atual"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <input
            type="password"
            placeholder="Nova senha"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <input
            type="password"
            placeholder="Confirmar nova senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleChange} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShow(false); setError("") }}>
              Cancelar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
