"use client"

import { useState, useEffect, useRef } from "react"
import { Store, Phone, MapPin, CreditCard, Bike, Banknote, Send, MessageCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"

const statusLabels: Record<string, string> = {
  pending: "Pedido Recebido",
  payment_pending: "Aguardando Pagamento",
  confirmed: "Confirmado",
  preparing: "Preparando",
  ready: "Pronto",
  out_for_delivery: "Saiu para Entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
}

const statusIcons: Record<string, string> = {
  pending: "📥",
  payment_pending: "⏳",
  confirmed: "✅",
  preparing: "👨‍🍳",
  ready: "📦",
  out_for_delivery: "🛵",
  delivered: "🎉",
  cancelled: "❌",
}

interface OrderMessage {
  id: string
  sender: string
  message: string
  read: boolean
  createdAt: string
}

interface OrderData {
  id: string
  orderNumber: number | null
  trackingToken: string | null
  customerName: string
  customerAddress: string | null
  orderType: string
  paymentMethod: string
  items: string
  total: number
  status: string
  paymentStatus: string
  paymentLink: string | null
  notes: string | null
  deliveryPerson: string | null
  createdAt: string | Date
  establishment: {
    name: string
    phone: string
    logo: string | null
  }
}

interface StatusStep {
  key: string
  label: string
  icon: string
}

interface Props {
  order: OrderData
  statusSteps: StatusStep[]
}

export function TrackingPage({ order, statusSteps }: Props) {
  const items = JSON.parse(order.items)
  const flowOrder = statusSteps.map(s => s.key)
  const currentIndex = flowOrder.indexOf(order.status)
  const cancelled = order.status === "cancelled"

  const [messages, setMessages] = useState<OrderMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [hasNewMsg, setHasNewMsg] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<string>("default")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevMsgCountRef = useRef(0)

  const token = order.trackingToken || order.id

  async function fetchMessages() {
    try {
      const res = await fetch(`/api/orders/${order.id}/messages?token=${token}`)
      if (res.ok) {
        const data = await res.json()
        const prevCount = prevMsgCountRef.current
        setMessages(data)

        if (prevCount > 0 && data.length > prevCount) {
          const newMsgs = data.slice(prevCount)
          const hasEstablishmentMsg = newMsgs.some((m: OrderMessage) => m.sender === "establishment")

          if (hasEstablishmentMsg) {
            setHasNewMsg(true)
            try {
              const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVggoKIeGBGPmmNk4+FYkA3a46UjH5hQz5ujpSPgGFDPnCOlY+AYkU/cY6WkH9hREBxjpaRf2JEQXKOmJF+YkVCco6Yk39iRUJyjpmUf2JGRHOQm5Z/Y0ZFc5Ccl39kR0Z0kZ2Yf2RHSHeTn5p/ZUhId5Ofmn9lSEh4lJ+cf2ZKSnqYk59/aE1MfJyWoX9rUU5/n5ijf25STn+gmKR/cFJOf6GZpH9wUk5/oZmkf3BSTn+hmaR/cVJOf6GZpH9yVE9/opqkf3JUT3+imqR/clRPf6KapH9zVE9/opqkf3RUT3+imqR/dVRPf6KapH92VE9/opqkf3dUT3+imqR/eVRPf6OapH96VE9/pJqkf3tUT3+kmqR/e1RPf6SapH98VE9/pZqkf31UT3+mmqR/fVRPf6aapH9+VE9/p5qkf39UT3+nmqR/gFRPf6iapH+BVE9/qpqkf4JUT3+rmqR/g1RPf6uapH+EVU9/rJqkf4VVT3+tmqR/hlVPf62apH+HWU9/rpqkf4dZT3+vmqR/iFlPf7GapH+IWU9/sZqkf4lZT3+xmqR/illPf7KapH+KWU9/s5qkf4tZT3+0mqR/jFlPf7SapH+NWU9/tZqkf45ZT3+2mqR/j1lPf7eapH+QWU9/t5qkf5FZT3+4mqR/klm2tbe0uLy6u7u5trKvrLW3ubu9vr68ubSzsrO2ubu9vr69vLm0srKztrm7vb6+vr28ubSxsbK1ubu9vr69vbm0sbGytbm7vb6+vb25tLGxsrW5u72+vr29ubSxsbK1ubu9vr69vbm0sbGytbm7vb6+vb25tLGxsrW5u72+vr29ubSxsbK1ubu9vr69vbm0sQ==") 
              await audio.play()
            } catch {}

            if ("vibrate" in navigator) {
              navigator.vibrate([200, 100, 200])
            }

            if ("Notification" in window && Notification.permission === "granted") {
              const lastEstablishmentMsg = newMsgs.filter((m: OrderMessage) => m.sender === "establishment").pop()
              new Notification("Resposta do estabelecimento", {
                body: lastEstablishmentMsg?.message || "Nova mensagem",
                icon: order.establishment.logo || undefined,
              })
            }

            setTimeout(() => setHasNewMsg(false), 10000)
          }
        }
        prevMsgCountRef.current = data.length
      }
    } catch {}
  }

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 10000)
    return () => clearInterval(interval)
  }, [order.id])

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission)
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, showChat])

  function dismissNotification() {
    setHasNewMsg(false)
  }

  async function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
      const result = await Notification.requestPermission()
      setNotificationPermission(result)
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch(`/api/orders/${order.id}/messages?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newMessage.trim() }),
      })
      if (res.ok) {
        const msg = await res.json()
        setMessages((prev) => [...prev, msg])
        setNewMessage("")
      }
    } catch {} finally {
      setSending(false)
    }
  }

  const unreadCount = messages.filter((m) => m.sender === "establishment" && !m.read).length

  return (
    <div className="min-h-screen bg-zinc-50 py-8">
      <div className="mx-auto max-w-lg px-4">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mb-2 text-4xl">
            {cancelled ? "😢" : statusIcons[order.status] || "📋"}
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">
            {cancelled ? "Pedido Cancelado" : statusLabels[order.status] || order.status}
          </h1>
          <p className="text-3xl font-bold text-green-600 mt-2">
            Pedido #{(order as any).orderNumber || order.id.substring(0, 8).toUpperCase()}
          </p>
        </div>

        {/* Order type + payment badge */}
        <div className="mb-4 flex justify-center gap-2">
          {order.orderType && (
            <Badge variant="info" className="gap-1">
              {order.orderType === "delivery" ? <Bike className="h-3 w-3" /> : "🏪"}
              {order.orderType === "delivery" ? "Entrega" : "Retirada"}
            </Badge>
          )}
          {order.paymentMethod && (
            <Badge variant="warning" className="gap-1">
              {order.paymentMethod === "online" ? <CreditCard className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}
              {order.paymentMethod === "online" ? "Pago Online" : order.paymentMethod === "delivery" ? "Pagar na Entrega" : "Pagar na Retirada"}
            </Badge>
          )}
        </div>

        {/* New message alert */}
        {hasNewMsg && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">💬</span>
              <div>
                <p className="text-sm font-medium text-amber-800">Nova resposta do estabelecimento</p>
                <p className="text-xs text-amber-600">Clique em &quot;Enviar mensagem&quot; para ver</p>
              </div>
            </div>
            <button onClick={dismissNotification} className="text-amber-600 hover:text-amber-800 text-xs font-medium px-2 py-1">
              ✕
            </button>
          </div>
        )}

        {/* Notification permission */}
        {"Notification" in window && notificationPermission === "default" && (
          <button
            onClick={requestNotificationPermission}
            className="mb-4 w-full rounded-lg border border-blue-200 bg-blue-50 p-3 text-center text-sm text-blue-700 hover:bg-blue-100 transition-colors"
          >
            🔔 Ativar notificações para receber respostas
          </button>
        )}

        {!cancelled && (
          <div className="mb-8">
            <div className="relative">
              {statusSteps.map((step, i) => {
                const isCompleted = currentIndex >= i
                const isCurrent = currentIndex === i

                return (
                  <div key={step.key} className="flex items-start gap-4 pb-6 last:pb-0">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${
                          isCompleted
                            ? "bg-green-100 text-green-600"
                            : "bg-zinc-100 text-zinc-300"
                        } ${isCurrent ? "ring-2 ring-green-500 ring-offset-2" : ""}`}
                      >
                        {step.icon}
                      </div>
                      {i < statusSteps.length - 1 && (
                        <div
                          className={`mt-1 h-full w-0.5 ${
                            isCompleted ? "bg-green-400" : "bg-zinc-200"
                          }`}
                        />
                      )}
                    </div>
                    <div className="pt-2">
                      <p
                        className={`font-medium ${
                          isCompleted ? "text-zinc-900" : "text-zinc-400"
                        } ${isCurrent ? "text-green-700" : ""}`}
                      >
                        {step.label}
                      </p>
                      {isCurrent && (
                        <p className="text-sm text-green-600">Status atual</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Chat button */}
        <button
          onClick={() => { setShowChat(!showChat); setHasNewMsg(false) }}
          className={`mb-4 flex w-full items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors ${
            unreadCount > 0 && !showChat
              ? "border-green-400 bg-green-100 text-green-800 animate-pulse"
              : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
          }`}
        >
          <MessageCircle className="h-5 w-5" />
          {showChat ? "Fechar chat" : "Enviar mensagem"}
          {unreadCount > 0 && (
            <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Chat panel */}
        {showChat && (
          <Card className="mb-4">
            <CardContent className="p-0">
              <div className="max-h-80 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-center text-sm text-zinc-400 py-4">
                    Envie uma mensagem para o estabelecimento
                  </p>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === "customer" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        msg.sender === "customer"
                          ? "bg-green-600 text-white"
                          : "bg-zinc-100 text-zinc-800"
                      }`}
                    >
                      <p>{msg.message}</p>
                      <p className={`text-[10px] mt-1 ${msg.sender === "customer" ? "text-green-200" : "text-zinc-400"}`}>
                        {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="border-t border-zinc-200 p-3 flex gap-2">
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value.slice(0, 500))}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  size="sm"
                  className="gap-1"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Establishment info */}
        <Card className="mb-4">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
              <Store className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-zinc-900">{order.establishment.name}</p>
              <a
                href={`https://wa.me/55${order.establishment.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green-600 hover:underline flex items-center gap-1"
              >
                <Phone className="h-3 w-3" />
                Falar com o estabelecimento
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Order details */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <h3 className="mb-3 font-semibold text-zinc-900">Itens do Pedido</h3>
            <div className="space-y-2">
              {items.map((item: any) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-zinc-600">
                    {item.quantity}x {item.name}
                  </span>
                  <span className="font-medium">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                </div>
              ))}
              {(order as any).deliveryFee > 0 && (
                <div className="flex justify-between text-sm text-zinc-500">
                  <span>Taxa de entrega</span>
                  <span>{formatCurrency((order as any).deliveryFee)}</span>
                </div>
              )}
            </div>
            <div className="mt-3 flex justify-between border-t border-zinc-200 pt-3 text-lg font-bold">
              <span>Total</span>
              <span className="text-green-600">{formatCurrency(order.total)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Delivery info */}
        {(order.customerAddress || order.deliveryPerson) && (
          <Card className="mb-4">
            <CardContent className="p-4 space-y-2">
              {order.customerAddress && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 text-zinc-400" />
                  <span className="text-zinc-600">{order.customerAddress}</span>
                </div>
              )}
              {order.deliveryPerson && (
                <div className="flex items-start gap-2 text-sm">
                  <span className="text-zinc-400">🛵</span>
                  <span className="text-zinc-600">
                    Entregador: {order.deliveryPerson}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Payment info */}
        {order.paymentLink && order.paymentStatus !== "paid" && order.status !== "cancelled" && (
          <a href={order.paymentLink} target="_blank" rel="noopener noreferrer">
            <Button className="w-full gap-2">
              <CreditCard className="h-4 w-4" />
              Pagar agora (Pix / Cartão)
            </Button>
          </a>
        )}

        {order.notes && (
          <p className="mt-4 text-sm text-zinc-400 italic">Obs: {order.notes}</p>
        )}
      </div>
    </div>
  )
}
