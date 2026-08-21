"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import {
  MessageCircle,
  Send,
  Search,
  User,
  ArrowLeft,
  Clock,
  AlertCircle,
  Loader2,
  CircleDot,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { fetchAuth } from "@/lib/fetch-auth"
import { useToast } from "@/components/toast"

interface OrderMessage {
  id: string
  orderId: string
  sender: string
  message: string
  read: boolean
  createdAt: string
}

interface Order {
  id: string
  orderNumber?: number
  customerName: string
  customerPhone?: string
  status: string
  createdAt: string
  total: number
  method?: string
  messages?: OrderMessage[]
  customer?: { needsHuman?: boolean; needsHumanAt?: string } | null
}

interface Conversation {
  phone: string
  name: string
  orders: Order[]
  lastMessage: OrderMessage | null
  unreadCount: number
  needsHuman: boolean
}

function timeAgo(date: string): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return "agora"
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

export default function ChatPage() {
  const establishmentId = useEstablishmentId()
  const { toast } = useToast()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [messages, setMessages] = useState<OrderMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  const loadConversations = useCallback(async () => {
    if (!establishmentId) return
    try {
      const res = await fetchAuth(
        `/api/orders?establishmentId=${establishmentId}`
      )
      if (!res.ok) return
      const orders: Order[] = await res.json()

      const ordersWithMessages = orders.filter(
        (o) =>
          o.status !== "cancelled" &&
          o.customerPhone &&
          o.method !== "ifood"
      )

      const convMap: Record<string, Conversation> = {}

      for (const order of ordersWithMessages) {
        const phone = order.customerPhone!
        if (!convMap[phone]) {
          convMap[phone] = {
            phone,
            name: order.customerName,
            orders: [],
            lastMessage: null,
            unreadCount: 0,
            needsHuman: order.customer?.needsHuman || false,
          }
        }
        if (order.customer?.needsHuman) convMap[phone].needsHuman = true
        convMap[phone].orders.push(order)
      }

      const convList = Object.values(convMap)

      for (const conv of convList) {
        let allMessages: OrderMessage[] = []
        for (const order of conv.orders) {
          try {
            const msgRes = await fetchAuth(
              `/api/orders/${order.id}/messages`
            )
            if (msgRes.ok) {
              const msgs: OrderMessage[] = await msgRes.json()
              conv.orders.find((o) => o.id === order.id)!.messages = msgs
              allMessages = [...allMessages, ...msgs]
            }
          } catch {}
        }
        allMessages.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        conv.lastMessage = allMessages[0] || null
        conv.unreadCount = allMessages.filter(
          (m) => m.sender === "customer" && !m.read
        ).length
      }

      convList.sort((a, b) => {
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1
        if (a.unreadCount === 0 && b.unreadCount > 0) return 1
        const aTime = a.lastMessage
          ? new Date(a.lastMessage.createdAt).getTime()
          : 0
        const bTime = b.lastMessage
          ? new Date(b.lastMessage.createdAt).getTime()
          : 0
        return bTime - aTime
      })

      setConversations(convList)
      setLoading(false)

      const totalUnread = convList.reduce((s, c) => s + c.unreadCount, 0)
      window.dispatchEvent(
        new CustomEvent("chat-updated", { detail: { unreadCount: totalUnread } })
      )
    } catch (e) {
      console.error("Erro ao carregar conversas:", e)
      setLoading(false)
    }
  }, [establishmentId])

  const loadMessages = useCallback(
    async (orderId: string) => {
      try {
        const res = await fetchAuth(
          `/api/orders/${orderId}/messages?_t=${Date.now()}`
        )
        if (res.ok) {
          const msgs: OrderMessage[] = await res.json()
          setMessages(msgs)
        }
      } catch {}
    },
    []
  )

  const markAsRead = useCallback(
    async (orderId: string) => {
      try {
        await fetchAuth(`/api/orders/${orderId}/messages`, {
          method: "PATCH",
        })
        setMessages((prev) =>
          prev.map((m) =>
            m.sender === "customer" ? { ...m, read: true } : m
          )
        )
      } catch (e) {
        console.error("Erro ao marcar como lida:", e)
      }
    },
    []
  )

  useEffect(() => {
    loadConversations()
    const i = setInterval(loadConversations, 5000)
    return () => clearInterval(i)
  }, [loadConversations])

  useEffect(() => {
    if (selectedOrderId) {
      loadMessages(selectedOrderId)
      markAsRead(selectedOrderId)

      const i = setInterval(() => {
        loadMessages(selectedOrderId)
      }, 5000)
      return () => clearInterval(i)
    }
  }, [selectedOrderId, loadMessages, markAsRead])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (selectedPhone) {
      const conv = conversations.find((c) => c.phone === selectedPhone)
      if (conv && conv.orders.length > 0 && !selectedOrderId) {
        const orderWithMessages = conv.orders.find(
          (o) => o.messages && o.messages.length > 0
        )
        if (orderWithMessages) {
          setSelectedOrderId(orderWithMessages.id)
        } else {
          setSelectedOrderId(conv.orders[conv.orders.length - 1].id)
        }
      }
    }
  }, [selectedPhone, conversations, selectedOrderId])

  async function sendMessage() {
    if (!newMessage.trim() || sending || !selectedOrderId) return
    setSending(true)
    try {
      const res = await fetchAuth(`/api/orders/${selectedOrderId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newMessage.trim() }),
      })
      if (res.ok) {
        const msg: OrderMessage = await res.json()
        setMessages((prev) => [...prev, msg])
        setNewMessage("")

        // Reset needsHuman when establishment responds
        if (selectedPhone) {
          const conv = conversations.find((c) => c.phone === selectedPhone)
          if (conv?.needsHuman && conv.orders[0]) {
            fetchAuth(`/api/customers/needs-human`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ phone: selectedPhone, establishmentId, needsHuman: false }),
            }).catch(() => {})
          }
        }

        loadConversations()
      } else {
        toast("Erro ao enviar mensagem", "error")
      }
    } catch {
      toast("Erro ao enviar mensagem", "error")
    } finally {
      setSending(false)
    }
  }

  function selectConversation(phone: string) {
    setSelectedPhone(phone)
    const conv = conversations.find((c) => c.phone === phone)
    if (conv && conv.orders.length > 0) {
      const orderWithMessages = conv.orders.find(
        (o) => o.messages && o.messages.length > 0
      )
      if (orderWithMessages) {
        setSelectedOrderId(orderWithMessages.id)
      } else {
        setSelectedOrderId(conv.orders[conv.orders.length - 1].id)
      }
    }
  }

  const selectedConv = conversations.find((c) => c.phone === selectedPhone)

  const filteredConversations = conversations.filter((c) => {
    const q = searchQuery.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.lastMessage?.message || "").toLowerCase().includes(q)
    )
  })

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-zinc-900">Chat</h2>
          {totalUnread > 0 && (
            <Badge variant="danger" className="px-2 py-0.5 text-xs">
              {totalUnread}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden rounded-xl border border-zinc-200 bg-white">
        {/* Left panel - Conversations list */}
        <div
          className={`${
            selectedPhone ? "hidden md:flex" : "flex"
          } flex-col w-full md:w-80 lg:w-96 border-r border-zinc-200`}
        >
          <div className="p-3 border-b border-zinc-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar conversa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageCircle className="h-8 w-8 text-zinc-300" />
                <p className="mt-2 text-sm text-zinc-500">
                  Nenhuma conversa encontrada
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <button
                  key={conv.phone}
                  onClick={() => selectConversation(conv.phone)}
                  className={`w-full flex items-start gap-3 p-3 border-b border-zinc-100 text-left transition-colors hover:bg-zinc-50 ${
                    selectedPhone === conv.phone ? "bg-green-50" : ""
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100">
                      <User className="h-5 w-5 text-zinc-500" />
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm font-semibold truncate ${
                          conv.unreadCount > 0
                            ? "text-zinc-900"
                            : "text-zinc-700"
                        }`}
                      >
                        {conv.name}
                      </span>
                      {conv.lastMessage && (
                        <span className="text-[10px] text-zinc-400 flex-shrink-0">
                          {timeAgo(conv.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs text-zinc-400">
                        {conv.phone}
                      </span>
                    </div>
                    {conv.lastMessage && (
                      <p
                        className={`text-xs mt-1 truncate ${
                          conv.unreadCount > 0
                            ? "text-zinc-700 font-medium"
                            : "text-zinc-400"
                        }`}
                      >
                        {conv.lastMessage.sender === "establishment" && "Você: "}
                        {conv.lastMessage.message}
                      </p>
                    )}
                    {conv.orders.length > 1 && (
                      <span className="text-[10px] text-zinc-400 mt-0.5">
                        {conv.orders.length} pedidos
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right panel - Chat */}
        <div
          className={`${
            selectedPhone ? "flex" : "hidden md:flex"
          } flex-col flex-1`}
        >
          {selectedConv ? (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 p-3 border-b border-zinc-200 bg-white">
                <button
                  onClick={() => {
                    setSelectedPhone(null)
                    setSelectedOrderId(null)
                    setMessages([])
                  }}
                  className="md:hidden p-1 rounded-lg hover:bg-zinc-100"
                >
                  <ArrowLeft className="h-5 w-5 text-zinc-600" />
                </button>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100">
                  <User className="h-5 w-5 text-zinc-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-zinc-900">
                    {selectedConv.name}
                  </p>
                  <p className="text-xs text-zinc-400">{selectedConv.phone}</p>
                </div>
                {selectedConv.orders.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-zinc-400">
                    <CircleDot className="h-3 w-3" />
                    <span>
                      Pedido #{selectedConv.orders[selectedConv.orders.length - 1].orderNumber || selectedConv.orders[selectedConv.orders.length - 1].id.slice(0, 8)}
                    </span>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50"
              >
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageCircle className="h-8 w-8 text-zinc-300" />
                    <p className="mt-2 text-sm text-zinc-500">
                      Nenhuma mensagem ainda
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.sender === "establishment"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm shadow-sm ${
                          msg.sender === "establishment"
                            ? "bg-green-600 text-white rounded-br-sm"
                            : "bg-white text-zinc-800 border border-zinc-200 rounded-bl-sm"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {msg.message}
                        </p>
                        <p
                          className={`text-[10px] mt-1.5 ${
                            msg.sender === "establishment"
                              ? "text-green-200"
                              : "text-zinc-400"
                          }`}
                        >
                          {new Date(msg.createdAt).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message input */}
              <div className="p-3 border-t border-zinc-200 bg-white">
                <div className="flex gap-2">
                  <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value.slice(0, 500))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage()
                      }
                    }}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-500 focus:outline-none"
                    disabled={sending}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending}
                    size="sm"
                    className="rounded-xl h-10 w-10 p-0 flex-shrink-0"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageCircle className="h-12 w-12 text-zinc-300" />
              <p className="mt-3 text-sm font-medium text-zinc-500">
                Selecione uma conversa
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Escolha uma conversa ao lado para iniciar
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
