"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Store, Minus, Plus, X, CreditCard, ExternalLink, Loader2, MessageCircle, ShoppingBag, CheckCircle, Banknote, User, Package, Store as StoreIcon, Bike, History, Search, Star, Sparkles, Tag, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import type { CartItem } from "@/types"

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  image: string | null
  badge: string | null
}

interface Category {
  id: string
  name: string
  products: Product[]
}

interface Establishment {
  id: string
  name: string
  slug: string
  phone: string
  logo: string | null
  cover: string | null
  description: string | null
  address: string | null
  deliveryFeeType: string
  deliveryFeeAmount: number | null
  deliveryFreeAbove: number | null
  primaryColor: string
  backgroundColor: string
  textColor: string
  headerColor: string
  colorsPublished: boolean
  instagramUrl: string | null
  businessHours: string | null
  loyaltyConfig: string | null
}

interface CustomerData {
  id: string
  name: string | null
  phone: string
  totalOrders: number
  totalSpent: number
  loyaltyPoints: number
}

interface Props {
  establishment: Establishment & { categories: Category[] }
  paymentConfig: { online: boolean; delivery: boolean; pickup: boolean }
  orderConfig: { delivery: boolean; pickup: boolean }
}

const BADGE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  mais_vendido: { label: "Mais Vendido", icon: Star, color: "bg-amber-100 text-amber-700 border-amber-200" },
  novo: { label: "Novo", icon: Sparkles, color: "bg-blue-100 text-blue-700 border-blue-200" },
  promocao: { label: "Promoção", icon: Tag, color: "bg-red-100 text-red-700 border-red-200" },
}

function ProductBadge({ badge }: { badge: string | null }) {
  if (!badge || !BADGE_CONFIG[badge]) return null
  const config = BADGE_CONFIG[badge]
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${config.color}`}>
      <Icon className="h-2.5 w-2.5" />
      {config.label}
    </span>
  )
}

export function MenuPage({ establishment, paymentConfig, orderConfig }: Props) {
  // Color theme - use published colors or defaults
  const theme = establishment.colorsPublished ? {
    primary: establishment.primaryColor,
    background: establishment.backgroundColor,
    text: establishment.textColor,
    header: establishment.headerColor,
  } : {
    primary: "#16a34a",
    background: "#ffffff",
    text: "#1a1a2e",
    header: "#ffffff",
  }

  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<"online" | "delivery" | "pickup">("online")
  const [orderType, setOrderType] = useState<"delivery" | "pickup">("delivery")
  const [ordering, setOrdering] = useState(false)
  const [orderResult, setOrderResult] = useState<{ success: boolean; trackingUrl?: string; paymentLink?: string; message?: string; orderId?: string } | null>(null)
  const [showTracking, setShowTracking] = useState(false)
  const [trackingOrder, setTrackingOrder] = useState<any>(null)
  const [trackingMessages, setTrackingMessages] = useState<any[]>([])
  const [trackingInput, setTrackingInput] = useState("")
  const [trackingSending, setTrackingSending] = useState(false)
  const [statusAlert, setStatusAlert] = useState<string | null>(null)
  const trackingEndRef = useRef<HTMLDivElement>(null)
  const prevStatusRef = useRef<string | null>(null)
  const [customer, setCustomer] = useState<{ name: string; phone: string; address: string; notes: string; cep?: string }>({ name: "", phone: "", address: "", notes: "" })

  const [lastOrder, setLastOrder] = useState<{ orderId: string; trackingUrl: string } | null>(null)
  const [hasEstablishmentReply, setHasEstablishmentReply] = useState(false)
  const prevMsgCountRef = useRef(0)
  const [showOrdersList, setShowOrdersList] = useState(false)
  const [customerOrders, setCustomerOrders] = useState<any[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(`pedefacil-customer-${establishment.slug}`)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setCustomer(parsed)
        setPhoneInput(parsed.phone || "")
        if (parsed.cep && parsed.address) {
          setAddressSaved(true)
        }
        if (parsed.cep) {
          setCep(parsed.cep)
          fetch(`https://viacep.com.br/ws/${parsed.cep}/json/`)
            .then(r => r.json())
            .then(d => { if (!d.erro) setCepAddress(d) })
            .catch(() => {})
        }
      } catch {}
    }
  }, [establishment.slug])

  useEffect(() => {
    try {
      const savedOrder = localStorage.getItem(`pedefacil-last-order-${establishment.slug}`)
      if (savedOrder) {
        const parsed = JSON.parse(savedOrder)
        if (parsed.orderId && parsed.trackingUrl && parsed.timestamp > Date.now() - 3600000) {
          setLastOrder(parsed)
        } else {
          localStorage.removeItem(`pedefacil-last-order-${establishment.slug}`)
        }
      }
    } catch {}
  }, [establishment.slug])

  const [showIdentifyModal, setShowIdentifyModal] = useState(false)
  const [cep, setCep] = useState("")
  const [cepAddress, setCepAddress] = useState<any>(null)
  const [cepLoading, setCepLoading] = useState(false)
  const [editingAddress, setEditingAddress] = useState(false)
  const [addressSaved, setAddressSaved] = useState(false)
  const [cepError, setCepError] = useState("")
  const [orderError, setOrderError] = useState("")
  const [couponCode, setCouponCode] = useState("")
  const [couponData, setCouponData] = useState<{ id: string; code: string; discountType: string; discountValue: number } | null>(null)
  const [couponError, setCouponError] = useState("")

  // Business hours
  const parsedBusinessHours = useMemo(() => {
    try {
      return establishment.businessHours ? JSON.parse(establishment.businessHours) : null
    } catch { return null }
  }, [establishment.businessHours])

  const isOpen = useMemo(() => {
    if (!parsedBusinessHours) return true
    const now = new Date()
    const dayIndex = now.getDay()
    const dayMap = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]
    const todayName = dayMap[dayIndex]
    const today = parsedBusinessHours.find((h: any) => h.day === todayName)
    if (!today || !today.active) return false
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const [openH, openM] = today.open.split(":").map(Number)
    const [closeH, closeM] = today.close.split(":").map(Number)
    const openMinutes = openH * 60 + openM
    const closeMinutes = closeH * 60 + closeM
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes
  }, [parsedBusinessHours])

  const closedMessage = useMemo(() => {
    if (!parsedBusinessHours || isOpen) return null
    const now = new Date()
    const dayIndex = now.getDay()
    const dayMap = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    // Check if today is still open later today
    const todayName = dayMap[dayIndex]
    const today = parsedBusinessHours.find((h: any) => h.day === todayName)
    if (today && today.active) {
      const [openH, openM] = today.open.split(":").map(Number)
      const openMinutes = openH * 60 + openM
      if (currentMinutes < openMinutes) {
        return `Encerramos por hoje, mas ${todayName.toLowerCase()} às ${today.open} retornamos`
      }
    }

    // Find next open day
    for (let i = 1; i <= 7; i++) {
      const nextIndex = (dayIndex + i) % 7
      const nextName = dayMap[nextIndex]
      const nextDay = parsedBusinessHours.find((h: any) => h.day === nextName)
      if (nextDay && nextDay.active) {
        return `Encerramos por hoje, mas ${nextName.toLowerCase()} às ${nextDay.open} retornamos`
      }
    }
    return "Estabelecimento temporariamente fechado"
  }, [parsedBusinessHours, isOpen])

  // Loyalty
  const parsedLoyalty = useMemo(() => {
    try {
      return establishment.loyaltyConfig ? JSON.parse(establishment.loyaltyConfig) : null
    } catch { return null }
  }, [establishment.loyaltyConfig])

  const [useLoyalty, setUseLoyalty] = useState(false)
  const [customerLoyaltyPoints, setCustomerLoyaltyPoints] = useState(0)

  const loyaltyDiscount = useMemo(() => {
    if (!useLoyalty || !parsedLoyalty?.enabled || !customerLoyaltyPoints) return 0
    const pointsNeeded = parsedLoyalty.redeemPoints || 100
    if (parsedLoyalty.redeemType === "product") {
      // Product redemption: no monetary discount, handled separately
      return customerLoyaltyPoints >= pointsNeeded ? 0 : 0
    }
    const discount = parsedLoyalty.redeemDiscount || 10
    if (customerLoyaltyPoints >= pointsNeeded) return discount
    return 0
  }, [useLoyalty, parsedLoyalty, customerLoyaltyPoints])

  const loyaltyFreeProduct = useMemo(() => {
    if (!useLoyalty || !parsedLoyalty?.enabled || !customerLoyaltyPoints) return null
    if (parsedLoyalty.redeemType !== "product") return null
    const pointsNeeded = parsedLoyalty.redeemPoints || 100
    if (customerLoyaltyPoints >= pointsNeeded) {
      const product = cart.find((item: any) => item.productId === parsedLoyalty.redeemProductId)
      return product || null
    }
    return null
  }, [useLoyalty, parsedLoyalty, customerLoyaltyPoints, cart])

  useEffect(() => {
    if (customer.name || customer.phone) {
      localStorage.setItem(`pedefacil-customer-${establishment.slug}`, JSON.stringify({ ...customer, cep }))
    }
  }, [customer, cep])
  const [couponLoading, setCouponLoading] = useState(false)

  // Tab & search
  const [activeCategory, setActiveCategory] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const tabsRef = useRef<HTMLDivElement>(null)

  const sortedCategories = establishment.categories
    .filter((cat) => cat.products.length > 0 || searchQuery === "")
    .sort((a, b) => {
      if (!searchQuery) return 0
      const aMatch = a.products.some((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      const bMatch = b.products.some((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      return aMatch === bMatch ? 0 : aMatch ? -1 : 1
    })

  const filteredProducts = (cat: Category) => {
    if (!searchQuery) return cat.products
    return cat.products.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }

  useEffect(() => {
    if (!activeCategory && sortedCategories.length > 0) {
      setActiveCategory(sortedCategories[0].id)
    }
  }, [sortedCategories, activeCategory])

  const fullAddress = cepAddress
    ? `${cepAddress.logradouro}, ${customer.address || "s/n"} - ${cepAddress.bairro}, ${cepAddress.localidade} - ${cepAddress.uf}`
    : customer.address

  async function lookupCep() {
    if (cep.length !== 8) return
    setCepLoading(true)
    setCepError("")
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await res.json()
      if (data.erro) {
        setCepError("CEP não encontrado. Preencha o endereço manualmente.")
        setCepAddress(null)
      } else {
        setCepAddress(data)
      }
    } catch {
      setCepError("Erro ao buscar CEP. Preencha manualmente.")
    } finally {
      setCepLoading(false)
    }
  }

  useEffect(() => {
    if (cep.length === 8 && orderType === "delivery") {
      const timer = setTimeout(() => lookupCep(), 600)
      return () => clearTimeout(timer)
    }
    setCepAddress(null)
    setCepError("")
  }, [cep, orderType])

  const [identifying, setIdentifying] = useState(false)
  const [customerData, setCustomerData] = useState<CustomerData | null>(null)
  const [phoneInput, setPhoneInput] = useState("")

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)

  function calcDeliveryFee(): number {
    if (orderType !== "delivery") return 0
    const type = establishment.deliveryFeeType || "free"
    if (type === "free") return 0
    if (type === "free_above" && subtotal >= (establishment.deliveryFreeAbove || 0)) return 0
    return establishment.deliveryFeeAmount || 0
  }

  const deliveryFee = calcDeliveryFee()

  const couponDiscount = couponData
    ? couponData.discountType === "percentage"
      ? subtotal * (couponData.discountValue / 100)
      : couponData.discountValue
    : 0

  const total = subtotal + deliveryFee - couponDiscount - loyaltyDiscount - (loyaltyFreeProduct ? loyaltyFreeProduct.price : 0)

  useEffect(() => {
    const raw = phoneInput.replace(/\D/g, "")
    if (raw.length < 11) {
      setCustomerData(null)
      return
    }
    const timer = setTimeout(async () => {
      setIdentifying(true)
      try {
        const res = await fetch(`/api/customers?phone=${raw}&establishmentId=${establishment.id}`)
        const data = await res.json()
        if (data && !data.notFound) {
          setCustomerData(data)
          setCustomer((prev) => ({ ...prev, name: data.name || prev.name, phone: data.phone, address: data.address || prev.address }))
          setCustomerLoyaltyPoints(data.loyaltyPoints || 0)
          if (data.cep && data.address) {
            setAddressSaved(true)
          }
          // Pre-fill CEP - the useEffect([cep, orderType]) will handle the ViaCEP lookup
          if (data.cep) {
            setCep(data.cep)
          }
        } else {
          setCustomerData(null)
          setCustomer((prev) => ({ ...prev, phone: raw }))
        }
      } catch { } finally {
        setIdentifying(false)
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [phoneInput, establishment.id])

  function handleOrderTypeChange(type: "delivery" | "pickup") {
    setOrderType(type)
    if (type === "pickup" && paymentMethod === "delivery") {
      setPaymentMethod(paymentConfig.pickup ? "pickup" : "online")
    } else if (type === "delivery" && paymentMethod === "pickup") {
      setPaymentMethod(paymentConfig.delivery ? "delivery" : "online")
    }
  }

  const availablePayments = []
  if (paymentConfig.online) availablePayments.push({ key: "online", label: "Pix / Cartão", icon: <CreditCard className="h-5 w-5" /> })
  if (paymentConfig.delivery && orderType === "delivery") availablePayments.push({ key: "delivery", label: "Pagar na Entrega", icon: <Banknote className="h-5 w-5" /> })
  if (paymentConfig.pickup && orderType === "pickup") availablePayments.push({ key: "pickup", label: "Pagar na Retirada", icon: <Banknote className="h-5 w-5" /> })

  if (availablePayments.length > 0 && !availablePayments.find(p => p.key === paymentMethod)) {
    setPaymentMethod(availablePayments[0].key as any)
  }

  function addToCart(product: Product) {
    if (!customer.phone && !customerData?.phone) {
      setShowIdentifyModal(true)
      return
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, image: product.image, quantity: 1 } as CartItem]
    })
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev.map((item) =>
        item.id === productId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
      ).filter((item) => item.quantity > 0)
    )
  }

  function removeItem(productId: string) {
    setCart((prev) => prev.filter((item) => item.id !== productId))
  }

  async function validateCoupon() {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    setCouponError("")
    setCouponData(null)
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode.trim(), establishmentId: establishment.id, orderTotal: subtotal }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCouponError(data.error || "Cupom inválido")
      } else {
        setCouponData(data)
      }
    } catch {
      setCouponError("Erro ao validar cupom")
    } finally {
      setCouponLoading(false)
    }
  }

  function removeCoupon() {
    setCouponData(null)
    setCouponCode("")
    setCouponError("")
  }

  async function handleSiteOrder(e: React.FormEvent) {
    e.preventDefault()
    setOrderError("")
    setOrdering(true)

    if (!customer.name || !customer.phone) {
      setOrderError("Preencha seu nome e telefone no topo da página")
      setOrdering(false)
      return
    }

    if (orderType === "delivery" && !addressSaved) {
      setOrderError("Salve o endereço antes de finalizar o pedido")
      setOrdering(false)
      return
    }

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          establishmentId: establishment.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerAddress: orderType === "delivery" ? fullAddress : "",
          customerComplement: customer.address,
          customerCep: cep || "",
          orderType,
          paymentMethod,
          items: cart,
          total,
          deliveryFee,
          couponId: couponData?.id || undefined,
          useLoyalty: useLoyalty && (loyaltyDiscount > 0 || loyaltyFreeProduct),
          loyaltyPointsUsed: useLoyalty && (loyaltyDiscount > 0 || loyaltyFreeProduct) ? (parsedLoyalty?.redeemPoints || 0) : 0,
          loyaltyDiscount: loyaltyDiscount + (loyaltyFreeProduct ? loyaltyFreeProduct.price : 0),
          loyaltyFreeProduct: loyaltyFreeProduct ? loyaltyFreeProduct.name : null,
          notes: customer.notes,
          method: "site",
        }),
      })

      if (!res.ok) throw new Error("Erro ao criar pedido")
      const data = await res.json()

      setOrderResult({
        success: true,
        trackingUrl: data.trackingUrl,
        paymentLink: data.paymentLink,
        orderId: data.order?.id,
      })

      if (data.order?.id && data.trackingUrl) {
        const lastOrd = { orderId: data.order.id, trackingUrl: data.trackingUrl, timestamp: Date.now() }
        setLastOrder(lastOrd)
        localStorage.setItem(`pedefacil-last-order-${establishment.slug}`, JSON.stringify(lastOrd))
      }

      setCart([])
      setEditingAddress(false)
    } catch (err: any) {
      setOrderError(err.message)
    } finally {
      setOrdering(false)
    }
  }

  async function openTracking(orderId?: string, trackingUrl?: string) {
    const id = orderId || orderResult?.orderId
    const url = trackingUrl || orderResult?.trackingUrl
    if (!id || !url) return
    setHasEstablishmentReply(false)
    prevMsgCountRef.current = 0
    setShowTracking(true)
    try {
      const token = url.split("/pedido/")[1]
      const res = await fetch(`/api/orders/${id}/messages?token=${token}`)
      if (res.ok) setTrackingMessages(await res.json())
      const orderRes = await fetch(`/api/tracking/${token}`)
      if (orderRes.ok) {
        const orderData = await orderRes.json()
        setTrackingOrder(orderData)
        prevStatusRef.current = orderData.status
      }
    } catch {}
  }

  useEffect(() => {
    if (!showTracking) return
    const currentOrderId = orderResult?.orderId || lastOrder?.orderId
    const currentTrackingUrl = orderResult?.trackingUrl || lastOrder?.trackingUrl
    if (!currentOrderId || !currentTrackingUrl) return
    const token = currentTrackingUrl.split("/pedido/")[1]

    const interval = setInterval(async () => {
      try {
        const orderRes = await fetch(`/api/tracking/${token}`)
        if (orderRes.ok) {
          const orderData = await orderRes.json()
          if (prevStatusRef.current && orderData.status !== prevStatusRef.current) {
            const labels: Record<string, string> = {
              confirmed: "Pedido confirmado!",
              preparing: "Seu pedido está sendo preparado!",
              ready: "Pedido pronto para retirada!",
              out_for_delivery: "Saiu para entrega!",
              delivered: "Pedido entregue!",
            }
            setStatusAlert(labels[orderData.status] || "Status atualizado!")
            setTimeout(() => setStatusAlert(null), 5000)
          }
          setTrackingOrder(orderData)
          prevStatusRef.current = orderData.status
        }
        const msgRes = await fetch(`/api/orders/${currentOrderId}/messages?token=${token}`)
        if (msgRes.ok) setTrackingMessages(await msgRes.json())
      } catch {}
    }, 10000)
    return () => clearInterval(interval)
  }, [showTracking, orderResult?.orderId, lastOrder])

  useEffect(() => {
    if (showTracking || !lastOrder) return
    const token = lastOrder.trackingUrl.split("/pedido/")[1]
    if (!token) return

    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/${lastOrder.orderId}/messages?token=${token}`)
        if (res.ok) {
          const data = await res.json()
          const prevCount = prevMsgCountRef.current
          if (prevCount > 0 && data.length > prevCount) {
            const newMsgs = data.slice(prevCount)
            if (newMsgs.some((m: any) => m.sender === "establishment")) {
              setHasEstablishmentReply(true)
              try {
                const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVggoKIeGBGPmmNk4+FYkA3a46UjH5hQz5ujpSPgGFDPnCOlY+AYkU/cY6WkH9hREBxjpaRf2JEQXKOmJF+YkVCco6Yk39iRUJyjpmUf2JGRHOQm5Z/Y0ZFc5Ccl39kR0Z0kZ2Yf2RHSHeTn5p/ZUhId5Ofmn9lSEh4lJ+cf2ZKSnqYk59/aE1MfJyWoX9rUU5/n5ijf25STn+gmKR/cFJOf6GZpH9wUk5/oZmkf3BSTn+hmaR/cVJOf6GZpH9yVE9/opqkf3JUT3+imqR/clRPf6KapH9zVE9/opqkf3RUT3+imqR/dVRPf6KapH92VE9/opqkf3dUT3+imqR/eVRPf6OapH96VE9/pJqkf3tUT3+kmqR/e1RPf6SapH98VE9/pZqkf31UT3+mmqR/fVRPf6aapH9+VE9/p5qkf39UT3+nmqR/gFRPf6iapH+BVE9/qpqkf4JUT3+rmqR/g1RPf6uapH+EVU9/rJqkf4VVT3+tmqR/hlVPf62apH+HWU9/rpqkf4dZT3+vmqR/iFlPf7GapH+IWU9/sZqkf4lZT3+xmqR/illPf7KapH+KWU9/s5qkf4tZT3+0mqR/jFlPf7SapH+NWU9/tZqkf45ZT3+2mqR/j1lPf7eapH+QWU9/t5qkf5FZT3+4mqR/klm2tbe0uLy6u7u5trKvrLW3ubu9vr68ubSzsrO2ubu9vr69vLm0srKztrm7vb6+vr28ubSxsbK1ubu9vr69vbm0sbGytbm7vb6+vb25tLGxsrW5u72+vr29ubSxsbK1ubu9vr69vbm0sbGytbm7vb6+vb25tLGxsrW5u72+vr29ubSxsbK1ubu9vr69vbm0sQ==")
                await audio.play()
              } catch {}
              if ("vibrate" in navigator) navigator.vibrate([200, 100, 200])
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification("Resposta do estabelecimento", {
                  body: newMsgs.filter((m: any) => m.sender === "establishment").pop()?.message || "Nova mensagem",
                })
              }
            }
          }
          prevMsgCountRef.current = data.length
        }
      } catch {}
    }

    poll()
    const i = setInterval(poll, 10000)
    return () => clearInterval(i)
  }, [showTracking, lastOrder])

  async function loadCustomerOrders() {
    const phone = customer.phone || customerData?.phone
    if (!phone) return
    setLoadingOrders(true)
    try {
      const res = await fetch(`/api/orders/customer?phone=${phone.replace(/\D/g, "")}&establishmentId=${establishment.id}`)
      if (res.ok) {
        const data = await res.json()
        setCustomerOrders(data)
      }
    } catch {} finally {
      setLoadingOrders(false)
    }
  }

  function handlePedidosClick() {
    if (lastOrder) {
      openTracking(lastOrder.orderId, lastOrder.trackingUrl)
    } else {
      loadCustomerOrders()
      setShowOrdersList(true)
    }
  }

  async function sendTrackingMessage() {
    if (!trackingInput.trim() || trackingSending) return
    const currentOrderId = orderResult?.orderId || lastOrder?.orderId
    const currentTrackingUrl = orderResult?.trackingUrl || lastOrder?.trackingUrl
    if (!currentOrderId || !currentTrackingUrl) return
    setTrackingSending(true)
    const token = currentTrackingUrl.split("/pedido/")[1]
    try {
      const res = await fetch(`/api/orders/${currentOrderId}/messages?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trackingInput.trim() }),
      })
      if (res.ok) {
        const msg = await res.json()
        setTrackingMessages((prev) => [...prev, msg])
        setTrackingInput("")
      }
    } catch {} finally {
      setTrackingSending(false)
    }
  }

  const statusLabels: Record<string, string> = {
    pending: "Pedido Recebido",
    confirmed: "Confirmado",
    preparing: "Preparando",
    ready: "Pronto",
    out_for_delivery: "Saiu para Entrega",
    delivered: "Entregue",
  }

  const statusIcons: Record<string, string> = {
    pending: "📥",
    confirmed: "✅",
    preparing: "👨‍🍳",
    ready: "📦",
    out_for_delivery: "🛵",
    delivered: "🎉",
  }

  if (orderResult?.success) {
    return (
      <>
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-zinc-900">Pedido enviado!</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Seu pedido foi recebido por <strong>{establishment.name}</strong>.
              Acompanhe o status em tempo real.
            </p>

            {parsedLoyalty?.enabled && (
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-sm font-medium text-amber-700">
                  <Star className="inline h-4 w-4 mr-1" />
                  {useLoyalty && loyaltyDiscount > 0
                    ? `Usado ${parsedLoyalty.redeemPoints} pontos (-${formatCurrency(loyaltyDiscount)})`
                    : `+${Math.floor((subtotal) * (parsedLoyalty.pointsPerReal || 1))} pontos ganhos!`}
                </p>
              </div>
            )}

            {orderResult.paymentLink && (
              <div className="mt-4">
                <a href={orderResult.paymentLink} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full gap-2" variant="primary">
                    <CreditCard className="h-4 w-4" />
                    Pagar agora (Pix / Cartão)
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
                <p className="mt-1 text-xs text-zinc-400">Pagamento processado por Asaas</p>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2">
              {orderResult.orderId && (
                <Button className="w-full gap-2" onClick={() => {
                  setOrderResult(null)
                  setShowCart(false)
                  setShowCheckout(false)
                  setEditingAddress(false)
                  openTracking()
                }}>
                  <ExternalLink className="h-4 w-4" />
                  Acompanhar pedido
                </Button>
              )}
              <Button variant="outline" className="w-full" onClick={() => {
                setOrderResult(null)
                setShowCart(false)
                setShowCheckout(false)
                setCart([])
                setEditingAddress(false)
              }}>
                Fechar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      </>
    )
  }

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: theme.background }}>
      {/* Header */}
      <div className="shadow-sm sticky top-0 z-10" style={{ backgroundColor: theme.header }}>
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          {establishment.instagramUrl ? (
            <a href={establishment.instagramUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center shrink-0">
              {establishment.logo ? (
                <img src={establishment.logo} alt={establishment.name} className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                <img src="/icons/pedefacil-icon.svg" alt="PedeFácil" className="h-10 w-10" />
              )}
              <span className="text-[9px] text-zinc-400 hover:text-pink-500 transition-colors mt-0.5 flex items-center gap-0.5">
                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                Siga-nos
              </span>
            </a>
          ) : (
            <div className="flex flex-col items-center shrink-0">
              {establishment.logo ? (
                <img src={establishment.logo} alt={establishment.name} className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                <img src="/icons/pedefacil-icon.svg" alt="PedeFácil" className="h-10 w-10" />
              )}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold truncate" style={{ color: theme.text }}>{establishment.name}</h1>
          </div>
          {customer.name ? (
            <div className="text-right shrink-0">
              <p className="text-xs font-medium" style={{ color: theme.primary }}>Olá, {customer.name}!</p>
              {parsedLoyalty?.enabled && customerLoyaltyPoints > 0 && (
                <p className="text-[10px] text-amber-600 flex items-center justify-end gap-0.5">
                  <Star className="h-2.5 w-2.5" />{customerLoyaltyPoints} pontos
                </p>
              )}
              <button
                onClick={() => { setCustomerData(null); setPhoneInput(""); setCustomer({ name: "", phone: "", address: "", notes: "" }); setCep(""); setCepAddress(null); localStorage.removeItem(`pedefacil-customer-${establishment.slug}`) }}
                className="text-[10px] text-zinc-400 hover:text-zinc-600"
              >
                Trocar
              </button>
            </div>
          ) : customerData ? (
            <div className="text-right shrink-0">
              <p className="text-xs font-medium" style={{ color: theme.primary }}>Olá, {customerData.name || "cliente"}!</p>
              <button
                onClick={() => { setCustomerData(null); setPhoneInput(""); setCustomer({ name: "", phone: "", address: "", notes: "" }); setCep(""); setCepAddress(null); localStorage.removeItem(`pedefacil-customer-${establishment.slug}`) }}
                className="text-[10px] text-zinc-400 hover:text-zinc-600"
              >
                Trocar
              </button>
            </div>
          ) : (
            <button onClick={() => setShowIdentifyModal(true)} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 shrink-0 animate-pulse">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
              Identificar-se
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="mx-auto max-w-3xl px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar no cardápio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2 pl-10 pr-4 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-500 focus:bg-white focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        {!searchQuery && sortedCategories.length > 0 && (
          <div
            ref={tabsRef}
            className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide"
            style={{ scrollbarWidth: "none" }}
          >
            {sortedCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeCategory === cat.id
                    ? "text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
                style={activeCategory === cat.id ? { backgroundColor: theme.primary } : {}}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Closed banner */}
      {!isOpen && closedMessage && (
        <div className="mx-auto max-w-3xl px-4 pt-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
            <p className="text-sm font-medium text-amber-800">{closedMessage}</p>
            <p className="mt-1 text-xs text-amber-600">Aguarde, estaremos de volta!</p>
          </div>
        </div>
      )}

      {/* Categories & Products */}
      <div className="mx-auto max-w-3xl px-4 py-6">
        {searchQuery ? (
          <div>
            <p className="mb-4 text-sm text-zinc-500">
              Resultados para &quot;{searchQuery}&quot;
            </p>
            {sortedCategories.map((cat) => {
              const filtered = filteredProducts(cat)
              if (filtered.length === 0) return null
              return (
                <div key={cat.id} className="mb-6">
                  <p className="mb-2 text-xs font-medium text-zinc-400 uppercase">{cat.name}</p>
                  <div className="space-y-3">
                    {filtered.map((product) => (
                      <ProductCard key={product.id} product={product} onAdd={addToCart} theme={theme} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          sortedCategories.map((cat) => {
            const products = cat.products
            if (products.length === 0) return null
            const isActive = activeCategory === cat.id
            return (
              <div
                key={cat.id}
                id={`cat-${cat.id}`}
                className={`mb-8 ${!isActive ? "hidden" : ""}`}
              >
                <h2 className="mb-4 text-xl font-semibold text-zinc-900">{cat.name}</h2>
                <div className="space-y-3">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} onAdd={addToCart} theme={theme} />
                  ))}
                </div>
              </div>
            )
          })
        )}

      </div>

      {/* Cart FAB */}
      {cart.length > 0 && !showCart && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-zinc-200 bg-white p-4 shadow-lg">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-500">{totalItems} itens</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(total)}</p>
            </div>
            <Button size="lg" onClick={() => setShowCart(true)} className="gap-2">
              <ShoppingBag className="h-5 w-5" />
              Revisar pedido
            </Button>
          </div>
        </div>
      )}

      {/* Identify Modal */}
      {showIdentifyModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-t-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900">Identificar-se</h2>
              <button onClick={() => setShowIdentifyModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500">WhatsApp</label>
                <input
                  placeholder="(47) 99999-9999"
                  value={phoneInput}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "").slice(0, 11)
                    let formatted = raw
                    if (raw.length > 2) formatted = `(${raw.slice(0, 2)}) ${raw.slice(2)}`
                    if (raw.length > 7) formatted = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`
                    setPhoneInput(formatted)
                  }}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                />
                {identifying && <p className="text-xs text-zinc-400 mt-1">Buscando cliente...</p>}
              </div>
              <div>
                <label className="text-xs text-zinc-500">Seu nome</label>
                <input
                  placeholder="Como quer ser chamado?"
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                />
              </div>
              {customerData && (
                <p className="text-xs text-green-600">Cliente encontrado! Dados preenchidos automaticamente.</p>
              )}
              <Button
                onClick={() => {
                  if (customer.name && phoneInput.replace(/\D/g, "").length >= 11) {
                    setCustomer((prev) => ({ ...prev, phone: phoneInput.replace(/\D/g, "") }))
                    setShowIdentifyModal(false)
                  }
                }}
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={!customer.name || phoneInput.replace(/\D/g, "").length < 11}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      {showCart && !showCheckout && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-900">Seu pedido</h2>
              <button onClick={() => setShowCart(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4 flex gap-2">
              {orderConfig.delivery && (
                <button
                  type="button"
                  onClick={() => handleOrderTypeChange("delivery")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 text-sm ${
                    orderType === "delivery" ? "border-green-500 bg-green-50 text-green-700" : "border-zinc-200 text-zinc-600"
                  }`}
                >
                  <Bike className="h-5 w-5" />
                  Entrega
                </button>
              )}
              {orderConfig.pickup && (
                <button
                  type="button"
                  onClick={() => handleOrderTypeChange("pickup")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 text-sm ${
                    orderType === "pickup" ? "border-green-500 bg-green-50 text-green-700" : "border-zinc-200 text-zinc-600"
                  }`}
                >
                  <StoreIcon className="h-5 w-5" />
                  Retirada
                </button>
              )}
            </div>

            {orderType === "delivery" && deliveryFee > 0 && (
              <div className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                <p className="font-medium">Taxa de entrega: {formatCurrency(deliveryFee)}</p>
                {establishment.deliveryFeeType === "free_above" && subtotal < (establishment.deliveryFreeAbove || 0) && (
                  <p className="text-xs mt-1">
                    Frete grátis acima de {formatCurrency(establishment.deliveryFreeAbove || 0)}!
                    Faltam {formatCurrency((establishment.deliveryFreeAbove || 0) - subtotal)}.
                  </p>
                )}
              </div>
            )}
            {orderType === "delivery" && deliveryFee === 0 && (
              <div className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                <p className="font-medium">Entrega grátis!</p>
              </div>
            )}

            {cart.length === 0 ? (
              <p className="py-8 text-center text-zinc-500">Carrinho vazio</p>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg bg-zinc-50 p-3">
                    <div className="flex-1">
                      <p className="font-medium text-zinc-900">{item.name}</p>
                      <p className="text-sm text-zinc-500">{formatCurrency(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => updateQuantity(item.id, -1)} className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 hover:bg-zinc-100">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center font-medium">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 hover:bg-zinc-100">
                        <Plus className="h-3 w-3" />
                      </button>
                      <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {!couponData ? (
                  <div className="flex gap-2 pt-3">
                    <Input
                      placeholder="Cupom de desconto"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={validateCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                      className="gap-1"
                    >
                      {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
                      Aplicar
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2 pt-3">
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Tag className="h-4 w-4" />
                      <span className="font-medium">{couponData.code}</span>
                      <span>-{couponData.discountType === "percentage" ? `${couponData.discountValue}%` : formatCurrency(couponData.discountValue)}</span>
                    </div>
                    <button onClick={removeCoupon} className="text-green-600 hover:text-green-800">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {couponError && <p className="text-xs text-red-500 pt-1">{couponError}</p>}

                {/* Loyalty */}
                {parsedLoyalty?.enabled && customerLoyaltyPoints > 0 && (
                  <div className="pt-3">
                    <label className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-500" />
                        <div>
                          <p className="text-sm font-medium text-zinc-900">
                            {parsedLoyalty.redeemType === "product" ? "Trocar pontos por produto" : "Usar pontos de fidelidade"}
                          </p>
                          <p className="text-xs text-zinc-500">{customerLoyaltyPoints} pontos disponíveis</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={useLoyalty}
                        onChange={(e) => setUseLoyalty(e.target.checked)}
                        disabled={customerLoyaltyPoints < (parsedLoyalty.redeemPoints || 100)}
                        className="h-4 w-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                      />
                    </label>
                    {customerLoyaltyPoints < (parsedLoyalty.redeemPoints || 100) && (
                      <p className="mt-1 text-xs text-zinc-400">
                        {parsedLoyalty.redeemType === "product"
                          ? `Faltam ${(parsedLoyalty.redeemPoints || 100) - customerLoyaltyPoints} pontos para resgatar um produto`
                          : `Faltam ${(parsedLoyalty.redeemPoints || 100) - customerLoyaltyPoints} pontos para resgatar R$ ${parsedLoyalty.redeemDiscount || 10} de desconto`}
                      </p>
                    )}
                    {useLoyalty && loyaltyDiscount > 0 && (
                      <p className="mt-1 text-xs text-green-600">-{formatCurrency(loyaltyDiscount)} de desconto aplicado</p>
                    )}
                    {useLoyalty && loyaltyFreeProduct && (
                      <p className="mt-1 text-xs text-green-600">+{loyaltyFreeProduct.name} (Produto grátis!)</p>
                    )}
                    {parsedLoyalty.redeemType === "product" && parsedLoyalty.redeemProductId && !loyaltyFreeProduct && customerLoyaltyPoints >= (parsedLoyalty.redeemPoints || 100) && (
                      <p className="mt-1 text-xs text-zinc-500">Adicione o produto ao carrinho para resgatar</p>
                    )}
                  </div>
                )}

                <div className="pt-3 space-y-1">
                  <div className="flex justify-between text-sm text-zinc-600">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {deliveryFee > 0 && (
                    <div className="flex justify-between text-sm text-zinc-600">
                      <span>Taxa de entrega</span>
                      <span>{formatCurrency(deliveryFee)}</span>
                    </div>
                  )}
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Desconto (cupom)</span>
                      <span>-{formatCurrency(couponDiscount)}</span>
                    </div>
                  )}
                  {loyaltyDiscount > 0 && (
                    <div className="flex justify-between text-sm text-amber-600">
                      <span>Desconto (pontos)</span>
                      <span>-{formatCurrency(loyaltyDiscount)}</span>
                    </div>
                  )}
                  {loyaltyFreeProduct && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Produto grátis ({loyaltyFreeProduct.name})</span>
                      <span>-{formatCurrency(loyaltyFreeProduct.price)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-zinc-200 pt-2 text-lg font-bold">
                    <span>Total</span>
                    <span className="text-green-600">{formatCurrency(total)}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    size="lg"
                    className="w-full gap-2"
                    onClick={() => setShowCheckout(true)}
                    disabled={!isOpen}
                  >
                    <ShoppingBag className="h-5 w-5" />
                    {!isOpen ? "Estabelecimento fechado" : "Finalizar pedido"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout - Site */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-900">Finalizar pedido</h2>
              <button onClick={() => { setShowCheckout(false); setEditingAddress(false) }} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSiteOrder} className="space-y-4">
              {orderType === "delivery" ? (
                <div className="space-y-2">
                  {addressSaved && cepAddress ? (
                    <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600 space-y-2">
                      <p>{cepAddress.logradouro}, {customer.address} - {cepAddress.bairro}, {cepAddress.localidade} - {cepAddress.uf}</p>
                      <button type="button" onClick={() => setAddressSaved(false)} className="text-xs text-green-600 hover:underline">
                        Alterar endereço
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <Input label="CEP" id="cep" placeholder="00000-000" value={cep} onChange={(e) => setCep(e.target.value.replace(/\D/g, "").slice(0, 8))} className="w-32" disabled={addressSaved} />
                        {cep.length === 8 && !cepLoading && (
                          <button type="button" onClick={lookupCep} className="mt-6 text-xs text-green-600 hover:underline self-start">
                            Buscar
                          </button>
                        )}
                        {cepLoading && <Loader2 className="mt-7 h-4 w-4 animate-spin text-zinc-400" />}
                      </div>
                      {cepError && <p className="text-xs text-red-500">{cepError}</p>}
                      {cepAddress && (
                        <p className="text-xs text-zinc-500">{cepAddress.logradouro} - {cepAddress.bairro}, {cepAddress.localidade} - {cepAddress.uf}</p>
                      )}
                      <Input label="Número" id="customerAddress" placeholder="Ex: 123" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} disabled={addressSaved} />
                      {cepAddress && customer.address && (
                        <button type="button" onClick={() => { setAddressSaved(true); setEditingAddress(false) }} className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
                          Salvar endereço
                        </button>
                      )}
                    </>
                  )}
                  <input type="hidden" name="fullAddress" value={fullAddress} />
                </div>
              ) : (
                <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
                  <StoreIcon className="inline h-4 w-4 mr-1" />
                  Retirada no local: {establishment.address || "Consulte o estabelecimento"}
                </div>
              )}

              <Textarea label="Observações" id="notes" placeholder="Ex: Sem cebola, ponto da carne..." value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} />

              <div>
                <p className="mb-2 text-sm font-medium text-zinc-700">Pagamento</p>
                <div className="grid grid-cols-2 gap-2">
                  {availablePayments.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPaymentMethod(p.key as any)}
                      className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
                        paymentMethod === p.key ? "border-green-500 bg-green-50 text-green-700" : "border-zinc-200 text-zinc-600"
                      }`}
                    >
                      {p.icon}
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {orderError && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{orderError}</div>}

              <div className="rounded-lg bg-zinc-50 p-3">
                <p className="text-sm font-medium text-zinc-700 mb-2">Resumo</p>
                <div className="flex items-center gap-1 text-xs text-zinc-500 mb-2">
                  {orderType === "delivery" ? <Bike className="h-3 w-3" /> : <StoreIcon className="h-3 w-3" />}
                  {orderType === "delivery" ? "Entrega" : "Retirada"}
                </div>
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm text-zinc-600">
                    <span>{item.name} x{item.quantity}</span>
                    <span>{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
                <div className="mt-2 space-y-1 border-t border-zinc-200 pt-2">
                  <div className="flex justify-between text-sm text-zinc-600">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {deliveryFee > 0 && (
                    <div className="flex justify-between text-sm text-zinc-600">
                      <span>Taxa de entrega</span>
                      <span>{formatCurrency(deliveryFee)}</span>
                    </div>
                  )}
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Desconto ({couponData?.code})</span>
                      <span>-{formatCurrency(couponDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-zinc-900">
                    <span>Total</span>
                    <span className="text-green-600">{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={ordering}>
                {ordering ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShoppingBag className="mr-2 h-5 w-5" />}
                {ordering ? "Enviando..." : "Confirmar pedido"}
              </Button>
            </form>
          </div>
        </div>
      )}

      {(customer.phone || customerData?.phone) && !orderResult?.success && (
        <button
          onClick={handlePedidosClick}
          className={`fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-lg transition active:scale-95 sm:bottom-6 ${
            hasEstablishmentReply
              ? "bg-amber-500 hover:bg-amber-600 animate-pulse"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {hasEstablishmentReply ? (
            <span className="relative flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] text-amber-600 font-bold">!</span>
            </span>
          ) : (
            <Package className="h-4 w-4" />
          )}
          Pedidos
        </button>
      )}

      {/* Orders list modal */}
      {showOrdersList && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="w-full max-w-lg max-h-[80vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <h2 className="text-lg font-bold text-zinc-900">Seus pedidos</h2>
              <button onClick={() => setShowOrdersList(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {!customer.phone && !customerData?.phone ? (
                <div className="text-center py-8">
                  <User className="mx-auto h-8 w-8 text-zinc-300" />
                  <p className="mt-2 text-sm text-zinc-500">Identifique-se para ver seus pedidos</p>
                  <button onClick={() => { setShowOrdersList(false); setShowIdentifyModal(true) }} className="mt-2 text-sm text-green-600 hover:underline">
                    Identificar-se
                  </button>
                </div>
              ) : loadingOrders ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                </div>
              ) : customerOrders.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="mx-auto h-8 w-8 text-zinc-300" />
                  <p className="mt-2 text-sm text-zinc-500">Nenhum pedido encontrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {customerOrders.map((order) => {
                    const items = typeof order.items === "string" ? JSON.parse(order.items) : order.items
                    const statusColors: Record<string, string> = {
                      pending: "bg-yellow-100 text-yellow-700",
                      confirmed: "bg-blue-100 text-blue-700",
                      preparing: "bg-orange-100 text-orange-700",
                      ready: "bg-green-100 text-green-700",
                      out_for_delivery: "bg-purple-100 text-purple-700",
                      delivered: "bg-green-100 text-green-700",
                      cancelled: "bg-red-100 text-red-700",
                    }
                    const statusLabels: Record<string, string> = {
                      pending: "Pendente",
                      confirmed: "Confirmado",
                      preparing: "Preparando",
                      ready: "Pronto",
                      out_for_delivery: "Saiu p/ entrega",
                      delivered: "Entregue",
                      cancelled: "Cancelado",
                    }
                    return (
                      <button
                        key={order.id}
                        onClick={() => {
                          setShowOrdersList(false)
                          if (order.trackingToken) {
                            openTracking(order.id, `/pedido/${order.trackingToken}`)
                          }
                        }}
                        className="w-full text-left rounded-xl border border-zinc-200 p-3 hover:border-green-300 hover:bg-green-50/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-zinc-900 truncate">
                              {items.map((i: any) => `${i.quantity}x ${i.name}`).join(", ")}
                            </p>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              {new Date(order.createdAt).toLocaleDateString("pt-BR")} às {new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-green-600">{formatCurrency(order.total)}</p>
                            <span className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[order.status] || "bg-zinc-100 text-zinc-500"}`}>
                              {statusLabels[order.status] || order.status}
                            </span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status change alert */}
      {statusAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] animate-bounce">
          <div className="rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white shadow-lg">
            {statusAlert}
          </div>
        </div>
      )}

      {/* Tracking modal */}
      {showTracking && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="w-full max-w-lg max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-zinc-900">Acompanhar pedido</h2>
                {trackingOrder && (
                  <span className="text-xl">{statusIcons[trackingOrder.status] || "📋"}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowTracking(false)
                    loadCustomerOrders()
                    setShowOrdersList(true)
                  }}
                  className="text-xs text-green-600 hover:text-green-700 font-medium"
                >
                  Ver outros
                </button>
                <button onClick={() => setShowTracking(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {trackingOrder && (
                <>
                  <div className="space-y-2">
                    {["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered"].map((step, i) => {
                      const flowIdx = ["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered"].indexOf(trackingOrder.status)
                      const isCompleted = i <= flowIdx
                      const isCurrent = i === flowIdx
                      return (
                        <div key={step} className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${isCompleted ? "bg-green-100 text-green-600" : "bg-zinc-100 text-zinc-300"} ${isCurrent ? "ring-2 ring-green-500" : ""}`}>
                            {statusIcons[step]}
                          </div>
                          <span className={`text-sm font-medium ${isCompleted ? "text-zinc-900" : "text-zinc-400"} ${isCurrent ? "text-green-700" : ""}`}>
                            {statusLabels[step]}
                          </span>
                          {isCurrent && <Badge variant="success" className="text-[10px]">Atual</Badge>}
                        </div>
                      )
                    })}
                  </div>

                  <div className="border-t border-zinc-200 pt-3">
                    <p className="text-xs text-zinc-400">Total: <span className="font-semibold text-green-600">R$ {trackingOrder.total?.toFixed(2)}</span></p>
                  </div>
                </>
              )}

              <div className="border-t border-zinc-200 pt-3">
                <h3 className="text-sm font-semibold text-zinc-700 mb-2">Mensagens</h3>
                <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
                  {trackingMessages.length === 0 && (
                    <p className="text-center text-xs text-zinc-400 py-2">Envie uma mensagem ao estabelecimento</p>
                  )}
                  {trackingMessages.map((msg: any) => (
                    <div key={msg.id} className={`flex ${msg.sender === "customer" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm ${msg.sender === "customer" ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-800"}`}>
                        <p>{msg.message}</p>
                        <p className={`text-[10px] mt-0.5 ${msg.sender === "customer" ? "text-green-200" : "text-zinc-400"}`}>
                          {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={trackingEndRef} />
                </div>
                <div className="flex gap-2">
                  <input
                    value={trackingInput}
                    onChange={(e) => setTrackingInput(e.target.value.slice(0, 500))}
                    onKeyDown={(e) => e.key === "Enter" && sendTrackingMessage()}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                  />
                  <Button size="sm" onClick={sendTrackingMessage} disabled={!trackingInput.trim() || trackingSending}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProductCard({ product, onAdd, theme }: { product: Product; onAdd: (p: Product) => void; theme: { primary: string } }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4">
      {product.image ? (
        <img
          src={product.image}
          alt={product.name}
          className="h-20 w-20 flex-shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-3xl">
          🍕
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-zinc-900">{product.name}</h3>
          <ProductBadge badge={product.badge} />
        </div>
        {product.description && (
          <p className="mt-0.5 text-sm text-zinc-500 line-clamp-2">{product.description}</p>
        )}
        <p className="mt-1 font-bold" style={{ color: theme.primary }}>{formatCurrency(product.price)}</p>
      </div>
      <Button size="sm" onClick={() => onAdd(product)} className="flex-shrink-0" style={{ backgroundColor: theme.primary }}>+</Button>
    </div>
  )
}
