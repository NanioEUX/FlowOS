"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Store, Minus, Plus, X, CreditCard, ExternalLink, Loader2, MessageCircle, ShoppingBag, CheckCircle, Banknote, User, Package, Store as StoreIcon, Bike, History, Search, Star, Sparkles, Tag, Send, Clock, MapPin, Sun, Moon, RefreshCw, Utensils, ClipboardList, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { FlowOSLogo } from "@/components/flowos-logo"
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
  pickupMessage: string | null
  deliveryMessage: string | null
  confirmationTitle: string | null
  confirmationImage: string | null
  closedTitle: string | null
  closedSub: string | null
  defaultTheme: string
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
  mais_vendido: { label: "Mais Vendido", icon: Star, color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  novo: { label: "Novo", icon: Sparkles, color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  promocao: { label: "Promoção", icon: Tag, color: "bg-red-500/10 text-red-400 border-red-500/20" },
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

function normalizeUrl(url: string | null): string {
  if (!url) return ""
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  // If it looks like a username (no dots, or starts with @), treat as Instagram username
  const clean = url.replace(/^@/, "")
  if (!clean.includes(".") || clean.includes("instagram.com")) {
    return `https://www.instagram.com/${clean}`
  }
  return `https://${url}`
}

function getFirstName(name: string): string {
  if (!name) return ""
  return name.split(" ")[0]
}

export function MenuPage({ establishment, paymentConfig, orderConfig }: Props) {
  const hasCustomColors = establishment.colorsPublished

  const [darkMode, setDarkMode] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem(`pedefacil-theme-${establishment.slug}`)
    if (saved !== null) {
      setDarkMode(saved === "dark")
    } else {
      setDarkMode(establishment.defaultTheme !== "light")
    }
  }, [establishment.slug, establishment.defaultTheme])

  const toggleTheme = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev
      localStorage.setItem(`pedefacil-theme-${establishment.slug}`, next ? "dark" : "light")
      return next
    })
  }, [establishment.slug])

  const theme = useMemo(() => {
    if (darkMode) {
      const pc = hasCustomColors ? establishment.primaryColor : "#FF6B35"
      return {
        primary: pc,
        accent: pc,
        accentLight: `${pc}1a`,
        accentMid: `${pc}40`,
        bgPage: "#0a0a0f",
        bgCard: "rgba(255,255,255,0.03)",
        bgCardHover: "rgba(255,255,255,0.06)",
        borderCard: "rgba(255,255,255,0.08)",
        borderCardHover: "rgba(255,255,255,0.15)",
        bgInput: "rgba(255,255,255,0.04)",
        bgInputFocus: "rgba(255,255,255,0.06)",
        borderInput: "rgba(255,255,255,0.12)",
        bgHeader: "rgba(10,10,15,0.8)",
        bgModal: "#111",
        text: "#ffffff",
        textMuted: "rgba(255,255,255,0.4)",
        textMutedMore: "rgba(255,255,255,0.3)",
        textSubtle: "rgba(255,255,255,0.5)",
        borderSubtle: "rgba(255,255,255,0.06)",
        borderInputColor: "rgba(255,255,255,0.12)",
        shadowPrimary: `${pc}40`,
        overlay: "rgba(0,0,0,0.5)",
        bgBadge: "rgba(255,255,255,0.05)",
        success: "#22c55e",
      }
    }
    const ec = establishment
    const pc = ec.primaryColor || "#16a34a"
    return {
      primary: pc,
      accent: pc,
      accentLight: `${pc}1a`,
      accentMid: `${pc}40`,
      bgPage: ec.backgroundColor || "#ffffff",
      bgCard: ec.backgroundColor === "#ffffff" ? "#f9fafb" : `${ec.backgroundColor}ee`,
      bgCardHover: ec.backgroundColor === "#ffffff" ? "#f3f4f6" : `${ec.backgroundColor}dd`,
      borderCard: ec.textColor ? `${ec.textColor}14` : "rgba(0,0,0,0.08)",
      borderCardHover: ec.textColor ? `${ec.textColor}25` : "rgba(0,0,0,0.15)",
      bgInput: ec.backgroundColor === "#ffffff" ? "#f3f4f6" : `${ec.backgroundColor}dd`,
      bgInputFocus: ec.backgroundColor === "#ffffff" ? "#e5e7eb" : `${ec.backgroundColor}cc`,
      borderInput: ec.textColor ? `${ec.textColor}1a` : "rgba(0,0,0,0.1)",
      bgHeader: ec.headerColor || "#ffffff",
      bgModal: ec.backgroundColor === "#ffffff" ? "#ffffff" : ec.backgroundColor || "#ffffff",
      text: ec.textColor || "#1a1a2e",
      textMuted: ec.textColor ? `${ec.textColor}99` : "rgba(26,26,46,0.6)",
      textMutedMore: ec.textColor ? `${ec.textColor}66` : "rgba(26,26,46,0.4)",
      textSubtle: ec.textColor ? `${ec.textColor}aa` : "rgba(26,26,46,0.65)",
      borderSubtle: ec.textColor ? `${ec.textColor}10` : "rgba(0,0,0,0.06)",
      borderInputColor: ec.textColor ? `${ec.textColor}1a` : "rgba(0,0,0,0.1)",
      shadowPrimary: `${pc}40`,
      overlay: "rgba(0,0,0,0.4)",
      bgBadge: ec.textColor ? `${ec.textColor}0a` : "rgba(0,0,0,0.03)",
      success: "#16a34a",
    }
  }, [darkMode, hasCustomColors, establishment])

  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`pedefacil-cart-${establishment.slug}`)
        if (saved) return JSON.parse(saved)
      } catch {}
    }
    return []
  })

  // Save cart to localStorage
  useEffect(() => {
    localStorage.setItem(`pedefacil-cart-${establishment.slug}`, JSON.stringify(cart))
  }, [cart, establishment.slug])

  const [addedItemId, setAddedItemId] = useState<string | null>(null)
  const [cartToast, setCartToast] = useState<{ name: string; image?: string } | null>(null)
  const [showCart, setShowCart] = useState(false)
  const [showBusinessHours, setShowBusinessHours] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<"online" | "delivery" | "pickup" | "pix" | "card">("pix")
  const [orderType, setOrderType] = useState<"delivery" | "pickup">("delivery")
  const [ordering, setOrdering] = useState(false)
  const [orderResult, setOrderResult] = useState<{ success: boolean; trackingUrl?: string; paymentLink?: string; paymentError?: string; message?: string; orderId?: string; orderNumber?: number; orderType?: string; paymentMethod?: string; orderTotal?: number; paymentDone?: boolean } | null>(null)
  const [showTracking, setShowTracking] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [trackingOrder, setTrackingOrder] = useState<any>(null)
  const [trackingMessages, setTrackingMessages] = useState<any[]>([])
  const [trackingInput, setTrackingInput] = useState("")
  const [trackingSending, setTrackingSending] = useState(false)
  const [statusAlert, setStatusAlert] = useState<string | null>(null)
  const trackingEndRef = useRef<HTMLDivElement>(null)
  const prevStatusRef = useRef<string | null>(null)
  const [cancelModalOrderId, setCancelModalOrderId] = useState<string | null>(null)
  const [cancelModalTotal, setCancelModalTotal] = useState<number>(0)
  const [cancelling, setCancelling] = useState(false)
  const [customer, setCustomer] = useState<{ name: string; phone: string; address: string; notes: string; cep?: string; cpf?: string }>({ name: "", phone: "", address: "", notes: "" })

  const [lastOrder, setLastOrder] = useState<{ orderId: string; trackingUrl: string; paymentLink?: string; paymentMethod?: string; total?: number; paymentDone?: boolean; orderNumber?: number } | null>(null)
  const [hasEstablishmentReply, setHasEstablishmentReply] = useState(false)
  const prevMsgCountRef = useRef(0)
  const [showOrdersList, setShowOrdersList] = useState(false)
  const [customerOrders, setCustomerOrders] = useState<any[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [showCustomerProfile, setShowCustomerProfile] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [cpfLookupLoading, setCpfLookupLoading] = useState(false)
  const [cpfError, setCpfError] = useState("")

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

  // When payment is confirmed, clear lastOrder (cart is already cleared by onPaymentSuccess)
  useEffect(() => {
    if (!lastOrder?.orderId || !lastOrder?.paymentLink) return
    lastOrderIdRef.current = lastOrder.orderId
    const capturedOrderId = lastOrder.orderId
    const controller = new AbortController()
    fetch(`/api/orders/${capturedOrderId}/payment-status`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (data.paymentStatus === "paid" && lastOrderIdRef.current === capturedOrderId) {
          setLastOrder(null)
          localStorage.removeItem(`pedefacil-last-order-${establishment.slug}`)
        }
      })
      .catch(() => {})
    return () => controller.abort()
  }, [lastOrder?.orderId, establishment.slug])

  const [showIdentifyModal, setShowIdentifyModal] = useState(false)
  const openIdentifyModal = () => {
    setCustomer(prev => ({ ...prev, name: "", cpf: "", phone: "" }))
    setPhoneInput("")
    setCustomerData(null)
    setCpfError("")
    setShowIdentifyModal(true)
  }
  const [cep, setCep] = useState("")
  const [cepAddress, setCepAddress] = useState<any>(null)
  const [cepLoading, setCepLoading] = useState(false)
  const [editingAddress, setEditingAddress] = useState(false)
  const [addressSaved, setAddressSaved] = useState(false)
  const [cepError, setCepError] = useState("")
  const [orderError, setOrderError] = useState("")
  const [couponCode, setCouponCode] = useState("")
  const [couponData, setCouponData] = useState<{ id: string; code: string; discountType: string; discountValue: number } | null>(null)
  const [activeTab, setActiveTab] = useState<"menu" | "orders" | "profile">("menu")
  const [couponError, setCouponError] = useState("")
  const [pendingOrderConfirm, setPendingOrderConfirm] = useState<{ orderId: string; orderNumber: number; total: number } | null>(null)
  const [inProgressOrder, setInProgressOrder] = useState<{ orderId: string; orderNumber: number; status: string; total: number; trackingUrl: string } | null>(null)
  const [pendingOrderItems, setPendingOrderItems] = useState<any[]>([])
  const [pendingOrderNumber, setPendingOrderNumber] = useState<number | null>(null)
  const [pendingOrderModal, setPendingOrderModal] = useState<{ orderId: string; orderNumber: number; total: number; paymentLink: string; paymentMethod?: string } | null>(null)
  const [pendingOrderAction, setPendingOrderAction] = useState<{ orderId: string; orderNumber: number; productId: string } | null>(null)
  const skipPendingCheckRef = useRef(false)
  const orderingRef = useRef(false)
  const lastOrderIdRef = useRef<string | null>(null)
  const paidOrderIdsRef = useRef(new Set<string>())
  const seenPendingOrdersRef = useRef(new Set<string>())

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
    const today = parsedBusinessHours.find((h: any) => h.day?.trim() === todayName)
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
    const today = parsedBusinessHours.find((h: any) => h.day?.trim() === todayName)
    let nextDayName = ""
    let nextDayTime = ""
    if (today && today.active) {
      const [openH, openM] = today.open.split(":").map(Number)
      const openMinutes = openH * 60 + openM
      if (currentMinutes < openMinutes) {
        nextDayName = todayName.toLowerCase()
        nextDayTime = today.open
      }
    }

    // Find next open day
    if (!nextDayName) {
      for (let i = 1; i <= 7; i++) {
        const nextIndex = (dayIndex + i) % 7
        const nextName = dayMap[nextIndex]
        const nextDay = parsedBusinessHours.find((h: any) => h.day?.trim() === nextName)
        if (nextDay && nextDay.active) {
          nextDayName = nextName.toLowerCase()
          nextDayTime = nextDay.open
          break
        }
      }
    }

    const customTitle = establishment.closedTitle
    const customSub = establishment.closedSub

    const title = customTitle
      ? customTitle.replace(/\{day\}/g, nextDayName).replace(/\{time\}/g, nextDayTime)
      : nextDayName
        ? `Encerramos por hoje, mas ${nextDayName} às ${nextDayTime} retornamos`
        : "Estabelecimento temporariamente fechado"

    const sub = customSub || "Aguarde, estaremos de volta!"

    return { title, sub }
  }, [parsedBusinessHours, isOpen, establishment.closedTitle, establishment.closedSub])

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
  const [searchMode, setSearchMode] = useState(false)
  const tabsRef = useRef<HTMLDivElement>(null)

  const sortedCategories = establishment.categories
    .filter((cat) => cat.products.length > 0 || searchQuery === "")
    .sort((a, b) => {
      if (!searchQuery) return 0
      const q = searchQuery.toLowerCase()
      const aCatMatch = a.name.toLowerCase().includes(q)
      const bCatMatch = b.name.toLowerCase().includes(q)
      const aProdMatch = a.products.some((p) =>
        p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
      )
      const bProdMatch = b.products.some((p) =>
        p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
      )
      if (aCatMatch && !bCatMatch) return -1
      if (!aCatMatch && bCatMatch) return 1
      return aProdMatch === bProdMatch ? 0 : aProdMatch ? -1 : 1
    })

  const filteredProducts = (cat: Category) => {
    if (!searchQuery) return cat.products
    const q = searchQuery.toLowerCase()
    const catNameMatch = cat.name.toLowerCase().includes(q)
    if (catNameMatch) return cat.products
    return cat.products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q)
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
  const activeOrdersCount = customerOrders.filter((o: any) => ["pending", "confirmed", "preparing", "ready", "out_for_delivery"].includes(o.status)).length

  // Load customer orders on mount when phone is available
  useEffect(() => {
    const phone = customer.phone || customerData?.phone
    if (!phone) return
    loadCustomerOrders()
  }, [customer.phone, customerData?.phone, establishment.id])

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
          setCustomer((prev) => ({ ...prev, name: data.name || prev.name, address: data.address || prev.address, cpf: data.cpf || prev.cpf }))
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
        }
      } catch { } finally {
        setIdentifying(false)
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [phoneInput, establishment.id])

  function handleOrderTypeChange(type: "delivery" | "pickup") {
    setOrderType(type)
    // Define payment method based on available options for this order type
    if (type === "delivery" && paymentConfig.delivery) {
      setPaymentMethod("delivery")
    } else if (type === "pickup" && paymentConfig.pickup) {
      setPaymentMethod("pickup")
    } else if (paymentConfig.online) {
      setPaymentMethod("pix")
    }
  }

  const availablePayments = []
  if (paymentConfig.online) {
    availablePayments.push({ key: "pix", label: "Pix", icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z"/></svg> })
    availablePayments.push({ key: "card", label: "Cartão", icon: <CreditCard className="h-5 w-5" /> })
  }
  // Pagamento na entrega/retirada
  if (paymentConfig.delivery && orderType === "delivery") availablePayments.push({ key: "delivery", label: "Pagar na Entrega", icon: <Banknote className="h-5 w-5" /> })
  if (paymentConfig.pickup && orderType === "pickup") availablePayments.push({ key: "pickup", label: "Pagar na Retirada", icon: <Banknote className="h-5 w-5" /> })

  if (availablePayments.length > 0 && !availablePayments.find(p => p.key === paymentMethod)) {
    setPaymentMethod(availablePayments[0].key as any)
  }

  function openCart() {
    const phone = customer.phone || customerData?.phone

    // Check orderResult > lastOrder > customerOrders
    const pendingFromResult = orderResult?.paymentLink && !orderResult.paymentDone
      ? { id: orderResult.orderId, orderNumber: orderResult.orderNumber || 0, items: [] }
      : null
    const pendingFromLast = lastOrder?.paymentLink && !lastOrder.paymentDone
      ? { id: lastOrder.orderId, orderNumber: lastOrder.orderNumber || 0, items: [] }
      : null
    const pendingOrder = pendingFromResult || pendingFromLast || (phone && customerOrders.length > 0
      ? customerOrders.find((o: any) => o.paymentStatus === "pending")
      : null)

    const inProgress = phone && customerOrders.length > 0
      ? customerOrders.find((o: any) =>
          o.paymentStatus === "paid" && ["confirmed", "preparing", "ready", "out_for_delivery"].includes(o.status)
        )
      : null

    // Pending payment order - open cart directly with locked items
    if (pendingOrder) {
      setPendingOrderItems(pendingOrder.items || [])
      setPendingOrderNumber(pendingOrder.orderNumber)
      setShowCart(true)
      return
    }

    // In-progress order (preparing, etc.)
    if (inProgress && !seenPendingOrdersRef.current.has(inProgress.id)) {
      const statusLabels: Record<string, string> = {
        confirmed: "Confirmado",
        preparing: "Preparando",
        ready: "Pronto",
        out_for_delivery: "Saiu para Entrega",
      }
      setInProgressOrder({
        orderId: inProgress.id,
        orderNumber: inProgress.orderNumber,
        status: statusLabels[inProgress.status] || inProgress.status,
        total: inProgress.total,
        trackingUrl: `/pedido/${inProgress.trackingToken}`,
      })
      return
    }
    setShowCart(true)
  }

  function addToCart(product: Product) {
    // Check if customer is identified
    if (!customer.phone) {
      openIdentifyModal()
      return
    }
    // Check if has pending payment order
    if (customerOrders.length > 0 || (lastOrder?.paymentLink)) {
      const phone = customer.phone || customerData?.phone
      if (phone) {
        const pendingOrder = customerOrders.find((o: any) => o.paymentStatus === "pending")
        const orderId = pendingOrder?.id || lastOrder?.orderId
        const orderNumber = pendingOrder?.orderNumber || 0
        if (orderId) {
          // Show action modal instead of silently blocking
          setPendingOrderAction({ orderId, orderNumber, productId: product.id })
          return
        }
      }
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
    setAddedItemId(product.id)
    setTimeout(() => setAddedItemId(null), 800)
    // Show toast
    setCartToast({ name: product.name, image: product.image || undefined })
    setTimeout(() => setCartToast(null), 3000)
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

  function isValidCpf(cpf: string): boolean {
    const digits = cpf.replace(/\D/g, "")
    if (digits.length !== 11) return false
    if (/^(\d)\1{10}$/.test(digits)) return false
    let sum = 0
    for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i)
    let rev = 11 - (sum % 11)
    if (rev === 10 || rev === 11) rev = 0
    if (rev !== parseInt(digits[9])) return false
    sum = 0
    for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i)
    rev = 11 - (sum % 11)
    if (rev === 10 || rev === 11) rev = 0
    return rev === parseInt(digits[10])
  }

  async function submitOrder() {
    console.log("[submitOrder] ========== INICIO ==========")
    console.log("[submitOrder] orderingRef:", orderingRef.current, "| skipPending:", skipPendingCheckRef.current)
    console.log("[submitOrder] customer:", JSON.stringify(customer))
    console.log("[submitOrder] paymentMethod:", paymentMethod, "| orderType:", orderType)
    console.log("[submitOrder] cart:", cart.length, "itens | total:", total)
    console.log("[submitOrder] addressSaved:", addressSaved, "| couponData:", !!couponData)
    console.log("[submitOrder] orderResult atual:", orderResult ? { orderId: orderResult.orderId, success: orderResult.success, paymentLink: !!orderResult.paymentLink } : null)
    console.log("[submitOrder] lastOrder:", lastOrder ? { orderId: lastOrder.orderId, paymentLink: !!lastOrder.paymentLink } : null)
    console.log("[submitOrder] showPaymentModal:", showPaymentModal)
    if (orderingRef.current) { console.log("[submitOrder] BLOCKED by orderingRef"); return }
    if (orderResult?.success && (orderResult?.paymentLink || orderResult?.paymentDone)) { return }
    orderingRef.current = true
    setOrderError("")
    setOrdering(true)

    if (!customer.name.trim()) {
      console.log("[submitOrder] RETORNO: nome vazio")
      setOrderError("Preencha seu nome para finalizar")
      setOrdering(false)
      orderingRef.current = false
      openIdentifyModal()
      return
    }

    if (!customer.phone || customer.phone.replace(/\D/g, "").length < 11) {
      console.log("[submitOrder] RETORNO: telefone invalido")
      setOrderError("Preencha um telefone válido com DDD")
      setOrdering(false)
      orderingRef.current = false
      openIdentifyModal()
      return
    }

    const cpfDigits = (customer.cpf || "").replace(/\D/g, "")
    if (!cpfDigits || cpfDigits.length !== 11 || !isValidCpf(customer.cpf || "")) {
      console.log("[submitOrder] RETORNO: CPF invalido")
      setOrderError("CPF inválido. Verifique e tente novamente.")
      setOrdering(false)
      orderingRef.current = false
      openIdentifyModal()
      return
    }

    if (orderType === "delivery" && !addressSaved) {
      console.log("[submitOrder] RETORNO: endereco nao salvo")
      setOrderError("Salve o endereço antes de finalizar o pedido")
      setOrdering(false)
      orderingRef.current = false
      return
    }

    // Check if there's already a pending payment order
    const phone = customer.phone || customerData?.phone
    if (phone && !skipPendingCheckRef.current) {
      console.log("[submitOrder] pending check - phone:", phone)
      try {
        const checkRes = await fetch(`/api/orders/customer?phone=${phone.replace(/\D/g, "")}&establishmentId=${establishment.id}`)
        if (checkRes.ok) {
          const orders = await checkRes.json()
          const pendingOrder = orders.find((o: any) => o.paymentStatus === "pending" && o.paymentLink)
          if (pendingOrder) {
            console.log("[submitOrder] RETORNO: pedido pendente encontrado:", pendingOrder.orderNumber)
            setPendingOrderConfirm({ orderId: pendingOrder.id, orderNumber: pendingOrder.orderNumber, total: pendingOrder.total })
            setOrdering(false)
            orderingRef.current = false
            return
          }
        }
      } catch {}
    }

    try {
      console.log("[submitOrder] calling API...")
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
          customerCpf: customer.cpf || "",
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

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || "Erro ao criar pedido")
      }
      const data = await res.json()
      console.log("[submitOrder] API response:", {
        orderId: data.order?.id,
        paymentLink: data.paymentLink ? data.paymentLink.substring(0, 60) + "..." : null,
        paymentError: data.paymentError,
        orderStatus: data.order?.status,
        paymentStatus: data.order?.paymentStatus,
      })

      setOrderResult({
        success: true,
        trackingUrl: data.trackingUrl,
        paymentLink: data.paymentLink,
        paymentError: data.paymentError,
        orderId: data.order?.id,
        orderNumber: data.order?.orderNumber,
        orderType: orderType,
        paymentMethod: paymentMethod,
        orderTotal: total,
      })

      console.log("[submitOrder] setOrderResult chamado, paymentLink:", data.paymentLink ? "SIM" : "NAO")

      if (data.order?.id && data.trackingUrl) {
        const lastOrd = { orderId: data.order.id, trackingUrl: data.trackingUrl, paymentLink: data.paymentLink || "", timestamp: Date.now(), paymentMethod: paymentMethod, total, paymentDone: false, orderNumber: data.order.orderNumber }
        setLastOrder(lastOrd)
        localStorage.setItem(`pedefacil-last-order-${establishment.slug}`, JSON.stringify(lastOrd))
      }

      setEditingAddress(false)

      if (data.paymentLink) {
        console.log("[submitOrder]Abrindo PaymentModal em 300ms...")
        setTimeout(() => setShowPaymentModal(true), 300)
      } else {
        console.log("[submitOrder] SEM paymentLink - tela de sucesso vai aparecer (sem pagamento)")
      }
    } catch (err: any) {
      console.error("[submitOrder] ERROR:", err.message)
      setOrderError(err.message)
    } finally {
      setOrdering(false)
      orderingRef.current = false
      skipPendingCheckRef.current = false
    }
  }

  async function handleSiteOrder(e: React.FormEvent) {
    e.preventDefault()
    await submitOrder()
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

  async function cancelOrder(orderId: string) {
    setCancelling(true)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled", paymentStatus: "cancelled" }),
      })
      if (res.ok) {
        setCancelModalOrderId(null)
        setPendingOrderItems([])
        setPendingOrderNumber(null)
        loadCustomerOrders()
        // Close tracking if showing the cancelled order
        if (trackingOrder?.id === orderId) {
          setShowTracking(false)
          setTrackingOrder(null)
        }
        // Clear last order and cart if it was the cancelled one
        if (lastOrder?.orderId === orderId) {
          setLastOrder(null)
          localStorage.removeItem(`pedefacil-last-order-${establishment.slug}`)
          setCart([])
          localStorage.removeItem(`pedefacil-cart-${establishment.slug}`)
          setShowCart(false)
        }
      }
    } catch {} finally {
      setCancelling(false)
    }
  }

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

  // Auto-close success screen after 5 seconds
  useEffect(() => {
    if (orderResult?.success && !orderResult?.paymentLink) {
      console.log("[auto-close] Timer iniciado para pedido:", orderResult.orderId)
      const timer = setTimeout(() => {
        console.log("[auto-close] LIMPANDO orderResult do pedido:", orderResult.orderId)
        setOrderResult(null)
        setShowCart(false)
        setShowCheckout(false)
        setEditingAddress(false)
        setShowPaymentModal(false)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [orderResult?.success, orderResult?.paymentLink, orderResult?.orderId, orderResult?.paymentDone])

  // If success but has payment link, show only the payment modal (no success screen)
  if (orderResult?.success && orderResult?.paymentLink && !orderResult?.paymentDone && !paidOrderIdsRef.current.has(orderResult.orderId || "")) {
    console.log("[render] paymentLink existe, showPaymentModal:", showPaymentModal, "orderId:", orderResult.orderId)
    if (!showPaymentModal) {
      setTimeout(() => setShowPaymentModal(true), 100)
      return null
    }
    return (
      <PaymentModal
        orderId={orderResult.orderId!}
        paymentLink={orderResult.paymentLink}
        total={orderResult.orderTotal ?? total}
        theme={theme}
        onClose={() => {
          setOrderResult(prev => {
            if (prev?.paymentDone) return prev
            return null
          })
          setShowCart(false)
          setShowCheckout(false)
          setEditingAddress(false)
          setShowPaymentModal(false)
        }}
        establishmentId={establishment.id}
        establishmentSlug={establishment.slug}
        initialTab={orderResult.paymentMethod === "card" ? "card" : "pix"}
        mode={orderResult.paymentMethod ? (orderResult.paymentMethod === "card" ? "card" : "pix") : undefined}
        onPaymentSuccess={() => {
            console.log("[onPaymentSuccess] Called - clearing cart and pending order")
            setCart([])
            setPendingOrderItems([])
            setPendingOrderNumber(null)
            localStorage.removeItem(`pedefacil-cart-${establishment.slug}`)
            localStorage.removeItem(`pedefacil-last-order-${establishment.slug}`)
            localStorage.removeItem(`pedefacil-countdown-${establishment.slug}`)
            localStorage.removeItem(`pedefacil-countdown-time-${establishment.slug}`)
            setOrderResult(prev => {
              if (prev?.orderId) paidOrderIdsRef.current.add(prev.orderId)
              console.log("[onPaymentSuccess] Order marked as paid:", prev?.orderId)
              return prev ? { ...prev, paymentLink: undefined, paymentDone: true } : null
            })
          }}
      />
    )
  }

  // Error screen - payment failed but order was created
  if (orderResult?.success && orderResult.paymentError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4" style={{ backgroundColor: theme.bgPage }}>
        <div className="w-full max-w-md rounded-[20px] border text-center backdrop-blur-xl p-8" style={{ borderColor: theme.borderCard, backgroundColor: theme.bgCard }}>
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
              <X className="h-8 w-8 text-red-400" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-red-400">Erro no pagamento</h2>
          <p className="mt-2 text-sm" style={{ color: theme.textMuted }}>{orderResult.paymentError}</p>
          <p className="mt-1 text-xs" style={{ color: theme.textMutedMore }}>O pedido foi criado, mas não foi possível gerar o pagamento.</p>

          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => setShowPaymentModal(true)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF6B35] to-[#E55A2B] text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              <CreditCard className="h-4 w-4" />
              Tentar novamente
            </button>
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
              localStorage.removeItem(`pedefacil-cart-${establishment.slug}`)
              setEditingAddress(false)
            }}>
              Fechar
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Success screen - only show if no paymentLink (otherwise payment modal handles it)
  if (orderResult?.success && !orderResult?.paymentLink) {
    console.log("[render] TELA DE SUCESSO (sem paymentLink) - orderId:", orderResult.orderId, "paymentError:", orderResult.paymentError)
    return (
      <>
      <div className="flex min-h-screen items-center justify-center p-4" style={{ backgroundColor: theme.bgPage }}>
        <div className="w-full max-w-md rounded-[20px] border text-center backdrop-blur-xl p-8" style={{ borderColor: theme.borderCard, backgroundColor: theme.bgCard }}>
            <div className="mb-4 flex justify-center">
              {(establishment.confirmationImage || establishment.logo) ? (
                <img src={establishment.confirmationImage || establishment.logo || ""} alt="" className="h-16 w-16 rounded-2xl object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                  <CheckCircle className="h-8 w-8 text-green-400" />
                </div>
              )}
            </div>
            <h2 className="text-xl font-bold" style={{ color: theme.text }}>{establishment.confirmationTitle || "Pedido enviado!"}</h2>

            {orderResult.orderType === "pickup" && establishment.pickupMessage && (
              <div className="mt-3 rounded-lg border p-3" style={{ borderColor: theme.accentLight, backgroundColor: theme.accentLight }}>
                <p className="text-sm" style={{ color: theme.accent }}>{establishment.pickupMessage}</p>
              </div>
            )}
            {orderResult.orderType === "delivery" && establishment.deliveryMessage && (
              <div className="mt-3 rounded-lg border p-3" style={{ borderColor: theme.accentLight, backgroundColor: theme.accentLight }}>
                <p className="text-sm" style={{ color: theme.accent }}>{establishment.deliveryMessage}</p>
              </div>
            )}

            {parsedLoyalty?.enabled && (
              <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3">
                <p className="text-sm font-medium text-amber-300">
                  <Star className="inline h-4 w-4 mr-1" />
                  {useLoyalty && loyaltyDiscount > 0
                    ? `Usado ${parsedLoyalty.redeemPoints} pontos (-${formatCurrency(loyaltyDiscount)})`
                    : `+${Math.floor((subtotal) * (parsedLoyalty.pointsPerReal || 1))} pontos ganhos!`}
                </p>
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
                localStorage.removeItem(`pedefacil-cart-${establishment.slug}`)
                setEditingAddress(false)
              }}>
                Fechar
              </Button>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen pb-24 overflow-x-hidden transition-colors duration-300" style={{ backgroundColor: theme.bgPage, color: theme.text }}>
      <style>{`@keyframes hrBlink { 0%,100%{opacity:1;color:inherit} 50%{opacity:1;color:#FBBF24} } .animate-hr-blink { animation: hrBlink 1.5s ease-in-out infinite; } @keyframes slideUp { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } } .animate-slide-up { animation: slideUp 0.3s ease-out; }`}</style>
      {/* Background orb */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full blur-[150px] opacity-20" style={{ backgroundColor: theme.primary }} />
      </div>

      {/* Header - Fixed */}
      <div className="fixed top-0 left-0 right-0 z-10 border-b backdrop-blur-xl transition-colors duration-300" style={{ borderColor: theme.borderSubtle, backgroundColor: theme.bgHeader }}>
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center shrink-0" style={{ width: 72 }}>
              {establishment.logo ? (
                <img src={establishment.logo} alt={establishment.name} className="h-14 w-14 rounded-xl object-cover shadow-sm" />
              ) : (
                <FlowOSLogo size={56} variant="icon" className="h-14 w-14" />
              )}
              {establishment.instagramUrl && (
                <a href={normalizeUrl(establishment.instagramUrl)} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center justify-center gap-1 text-[10px] hover:opacity-70 w-full" style={{ color: theme.textMutedMore }}>
                  <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                  Siga-nos
                </a>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold truncate" style={{ color: theme.text }}>{establishment.name}</h1>
              {establishment.description && (
                <p className="text-[11px] leading-tight truncate" style={{ color: theme.textMuted }}>{establishment.description}</p>
              )}
            </div>
            {(customer.phone || customerData?.phone) ? (
              <button
                onClick={() => setShowCustomerProfile(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-colors shrink-0 text-sm font-bold"
                style={{ backgroundColor: theme.primary, color: "#ffffff" }}
              >
                {getFirstName(customer.name || customerData?.name || "").charAt(0).toUpperCase()}
              </button>
            ) : (
              <button
                onClick={() => openIdentifyModal()}
                className="flex items-center gap-1.5 text-xs hover:opacity-70 shrink-0 animate-pulse"
                style={{ color: theme.textMutedMore }}
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </span>
                Identificar-se
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs + Search */}
        <div
          ref={tabsRef}
          className="mx-auto max-w-3xl px-4 pb-3"
        >
          {searchMode ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: theme.textMutedMore }} />
              <input
                type="text"
                placeholder="Buscar no cardápio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full rounded-xl py-2.5 pl-10 pr-10 text-sm backdrop-blur-sm transition-all focus:outline-none"
                style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }}
              />
              <button
                onClick={() => { setSearchQuery(""); setSearchMode(false) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70"
                style={{ color: theme.textMutedMore }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none" }}>
              <button
                onClick={() => setSearchMode(true)}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-300 shrink-0 hover:opacity-80"
                style={{ backgroundColor: theme.bgCard, color: theme.textSubtle, borderWidth: 1, borderStyle: "solid", borderColor: theme.borderCard }}
              >
                <Search className="h-4 w-4" />
                <span>Buscar</span>
              </button>
              {sortedCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-300 ${
                    activeCategory === cat.id
                      ? "text-white shadow-lg"
                      : "hover:opacity-80"
                  }`}
                  style={activeCategory === cat.id ? { backgroundColor: theme.primary, boxShadow: `0 0 20px ${theme.shadowPrimary}`, color: "#ffffff" } : { backgroundColor: theme.bgCard, color: theme.textSubtle, borderWidth: 1, borderStyle: "solid", borderColor: theme.borderCard }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-[120px]" />

      {/* Closed banner */}
      {!isOpen && closedMessage && (
        <div className="mx-auto max-w-3xl px-4 pt-3">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-center backdrop-blur-sm">
            <p className="text-sm font-medium text-amber-300">{closedMessage.title}</p>
            <p className="mt-1 text-xs text-amber-400/70">{closedMessage.sub}</p>
          </div>
        </div>
      )}

      {/* Categories & Products */}
      <div className="mx-auto max-w-3xl px-4 py-6">
        {searchQuery ? (
          <div>
            <p className="mb-4 text-sm" style={{ color: theme.textMuted }}>
              Resultados para &quot;{searchQuery}&quot;
            </p>
            {sortedCategories.map((cat) => {
              const filtered = filteredProducts(cat)
              if (filtered.length === 0) return null
              return (
                <div key={cat.id} className="mb-6">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: theme.textMutedMore }}>{cat.name}</p>
                  <div className="space-y-3">
                    {filtered.map((product) => (
                      <ProductCard key={product.id} product={product} onAdd={addToCart} theme={theme} disabled={!isOpen} isAdded={addedItemId === product.id} />
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
                <div className="space-y-3">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} onAdd={addToCart} theme={theme} disabled={!isOpen} isAdded={addedItemId === product.id} />
                  ))}
                </div>
              </div>
            )
          })
        )}

      </div>

      {/* Cart Toast */}
      {cartToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 animate-slide-up">
          <div className="flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-xl" style={{ backgroundColor: theme.bgModal, borderColor: theme.borderCard }}>
            {cartToast.image ? (
              <img src={cartToast.image} alt="" className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: theme.bgCard }}>
                <ShoppingBag className="h-4 w-4" style={{ color: theme.primary }} />
              </div>
            )}
            <span className="text-sm font-medium max-w-[180px] truncate" style={{ color: theme.text }}>{cartToast.name}</span>
            <button
              onClick={() => {
                setCartToast(null)
                openCart()
              }}
              className="text-sm font-semibold shrink-0"
              style={{ color: theme.primary }}
            >
              Ver
            </button>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      {!showCart && !orderResult?.success && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t backdrop-blur-xl transition-colors duration-300" style={{ borderColor: theme.borderSubtle, backgroundColor: theme.bgHeader }}>
          <div className="mx-auto max-w-3xl flex items-center justify-around px-2 py-2">
            <button
              onClick={() => setActiveTab("menu")}
              className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors"
              style={{ color: activeTab === "menu" ? theme.primary : theme.textMuted }}
            >
              <Utensils className="h-5 w-5" />
              <span className="text-[10px] font-medium">Cardápio</span>
            </button>
            <button
              onClick={() => openCart()}
              className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors relative"
              style={{ color: cart.length > 0 ? theme.primary : theme.textMuted }}
            >
              <ShoppingBag className="h-5 w-5" />
              <span className="text-[10px] font-medium">Carrinho</span>
              {mounted && totalItems > 0 && (
                <span className="absolute -top-1.5 right-0.5 flex flex-col items-center justify-center rounded-full px-0.5 text-[7px] font-bold text-white leading-tight" style={{ backgroundColor: theme.primary, minWidth: "1.4rem", height: "1.4rem" }}>
                  <span>R${Math.round(total)}</span>
                  <span className="text-[6px] opacity-80">{totalItems}</span>
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab("orders")
                if (customer.phone || customerData?.phone) {
                  loadCustomerOrders()
                  setShowOrdersList(true)
                } else {
                  openIdentifyModal()
                }
              }}
              className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors relative"
              style={{ color: activeTab === "orders" ? theme.primary : theme.textMuted }}
            >
              <ClipboardList className="h-5 w-5" />
              <span className="text-[10px] font-medium">Pedidos</span>
              {mounted && activeOrdersCount > 0 && (
                <span className="absolute -top-0.5 right-0 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white" style={{ backgroundColor: theme.primary }}>
                  {activeOrdersCount}
                </span>
              )}
              {activeOrdersCount === 0 && hasEstablishmentReply && (
                <span className="absolute -top-0.5 right-1 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab("profile")
                if (customer.phone || customerData?.phone) {
                  setShowCustomerProfile(true)
                } else {
                  openIdentifyModal()
                }
              }}
              className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors"
              style={{ color: activeTab === "profile" ? theme.primary : theme.textMuted }}
            >
              <User className="h-5 w-5" />
              <span className="text-[10px] font-medium">Perfil</span>
            </button>
          </div>
        </div>
      )}

      {/* Identify Modal */}
      {showIdentifyModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: theme.overlay }}>
          <div className="w-full max-w-lg rounded-t-2xl border-t p-6 backdrop-blur-xl" style={{ backgroundColor: theme.bgModal, borderColor: theme.borderCard }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: theme.text }}>Identificar-se</h2>
              <button onClick={() => setShowIdentifyModal(false)} style={{ color: theme.textMutedMore }} className="hover:opacity-70">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs" style={{ color: theme.textMuted }}>CPF</label>
                <input
                  placeholder="000.000.000-00"
                  value={customer.cpf || ""}
                  maxLength={14}
                  onChange={(e) => {
                    let v = e.target.value.replace(/\D/g, "")
                    if (v.length > 11) v = v.slice(0, 11)
                    if (v.length > 9) v = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`
                    else if (v.length > 6) v = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`
                    else if (v.length > 3) v = `${v.slice(0, 3)}.${v.slice(3)}`
                    setCustomer({ ...customer, cpf: v })
                    // Validate CPF
                    const cpfDigits = v.replace(/\D/g, "")
                    if (cpfDigits.length === 11) {
                      if (!isValidCpf(v)) {
                        setCpfError("CPF inválido")
                      } else {
                        setCpfError("")
                        // Auto-fill by CPF lookup
                        setCpfLookupLoading(true)
                        fetch(`/api/customers?cpf=${cpfDigits}&establishmentId=${establishment.id}`)
                          .then(r => r.json())
                          .then(data => {
                            if (data && !data.notFound) {
                              setCustomerData(data)
                              setCustomer(prev => ({
                                ...prev,
                                name: data.name || prev.name,
                                cpf: v,
                                address: data.address || prev.address,
                                cep: data.cep || prev.cep,
                              }))
                              if (data.phone) setPhoneInput(data.phone.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3"))
                              if (data.cep) setCep(data.cep)
                            } else {
                              setCustomerData(null)
                            }
                          })
                          .catch(() => {})
                          .finally(() => setCpfLookupLoading(false))
                      }
                    }
                  }}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }}
                />
                {cpfLookupLoading && <p className="text-xs mt-1" style={{ color: theme.textMutedMore }}>Buscando cliente...</p>}
                {cpfError && !cpfLookupLoading && (
                  <p className="text-xs mt-1 text-red-400">{cpfError}</p>
                )}
                {customerData && !cpfLookupLoading && !cpfError && (
                  <p className="text-xs mt-1" style={{ color: theme.accent }}>Cliente encontrado! Dados preenchidos automaticamente.</p>
                )}
              </div>
              <div>
                <label className="text-xs" style={{ color: theme.textMuted }}>WhatsApp</label>
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
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }}
                />
              </div>
              <div>
                <label className="text-xs" style={{ color: theme.textMuted }}>Seu nome</label>
                <input
                  placeholder="Como quer ser chamado?"
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }}
                />
              </div>
              <p className="text-[10px]" style={{ color: theme.textMutedMore }}>CPF obrigatório para gerar pagamento</p>
              <Button
                onClick={() => {
                  const cpfDigits = (customer.cpf || "").replace(/\D/g, "")
                  if (customer.name && phoneInput.replace(/\D/g, "").length >= 11 && cpfDigits.length === 11 && isValidCpf(customer.cpf || "")) {
                    setCustomer((prev) => ({ ...prev, phone: phoneInput.replace(/\D/g, "") }))
                    setShowIdentifyModal(false)
                  }
                }}
                className="w-full bg-gradient-to-r from-[#FF6B35] to-[#E55A2B] hover:opacity-90"
                disabled={!customer.name || phoneInput.replace(/\D/g, "").length < 11 || !isValidCpf(customer.cpf || "")}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Business Hours Modal */}
      {showBusinessHours && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: theme.overlay }}>
          <div className="w-full max-w-lg rounded-t-2xl border-t p-6 backdrop-blur-xl" style={{ backgroundColor: theme.bgModal, borderColor: theme.borderCard }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: theme.text }}>Horários de Funcionamento</h2>
              <button onClick={() => setShowBusinessHours(false)} style={{ color: theme.textMutedMore }} className="hover:opacity-70">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2">
              {parsedBusinessHours?.map((h: any) => (
                <div key={h.day} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: h.active ? theme.accentLight : theme.bgCard }}>
                  <span className="text-sm font-medium" style={{ color: h.active ? theme.text : theme.textMutedMore }}>{h.day?.trim()}</span>
                  {h.active ? (
                    <span className="text-sm" style={{ color: theme.accent }}>{h.open} – {h.close}</span>
                  ) : (
                    <span className="text-sm" style={{ color: theme.textMutedMore }}>Fechado</span>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowBusinessHours(false)}
              className="mt-4 w-full rounded-lg py-2.5 text-sm font-medium hover:opacity-80 border"
              style={{ backgroundColor: theme.bgCard, color: theme.text, borderColor: theme.borderCard }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Customer Profile Modal */}
      {showCustomerProfile && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: theme.overlay }}>
          <div className="w-full max-w-lg rounded-t-2xl border-t p-6 backdrop-blur-xl" style={{ backgroundColor: theme.bgModal, borderColor: theme.borderCard }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: theme.text }}>Meus dados</h2>
              <button onClick={() => { setShowCustomerProfile(false); setEditingProfile(false) }} style={{ color: theme.textMutedMore }} className="hover:opacity-70">
                <X className="h-5 w-5" />
              </button>
            </div>

            {!editingProfile ? (
              <div className="space-y-4">
                <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: theme.bgCard }}>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: theme.textMutedMore }}>Nome</p>
                    <p className="text-sm font-medium" style={{ color: theme.text }}>{customer.name || "Não informado"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: theme.textMutedMore }}>WhatsApp</p>
                    <p className="text-sm font-medium" style={{ color: theme.text }}>{phoneInput || customer.phone ? `(${(phoneInput || customer.phone).slice(0,2)}) ${(phoneInput || customer.phone).slice(2,7)}-${(phoneInput || customer.phone).slice(7)}` : "Não informado"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: theme.textMutedMore }}>CPF</p>
                    <p className="text-sm font-medium" style={{ color: theme.text }}>{customer.cpf || "Não informado"}</p>
                  </div>
                  {parsedLoyalty?.enabled && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: theme.textMutedMore }}>Pontos</p>
                      <p className="text-sm font-medium text-amber-400 flex items-center gap-1">
                        <Star className="h-3 w-3" />{customerLoyaltyPoints} pontos
                      </p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setEditingProfile(true)}
                  className="w-full rounded-lg py-2.5 text-sm font-medium text-white hover:opacity-90"
                  style={{ backgroundColor: theme.primary }}
                >
                  Editar dados
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs" style={{ color: theme.textMuted }}>Nome</label>
                  <input
                    value={customer.name}
                    onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                    className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }}
                  />
                </div>
                <div>
                  <label className="text-xs" style={{ color: theme.textMuted }}>WhatsApp</label>
                  <input
                    value={phoneInput}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "").slice(0, 11)
                      let formatted = raw
                      if (raw.length > 2) formatted = `(${raw.slice(0, 2)}) ${raw.slice(2)}`
                      if (raw.length > 7) formatted = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`
                      setPhoneInput(formatted)
                    }}
                    className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }}
                  />
                </div>
                <div>
                  <label className="text-xs" style={{ color: theme.textMuted }}>CPF</label>
                  <input
                    value={customer.cpf || ""}
                    maxLength={14}
                    onChange={(e) => {
                      let v = e.target.value.replace(/\D/g, "")
                      if (v.length > 11) v = v.slice(0, 11)
                      if (v.length > 9) v = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`
                      else if (v.length > 6) v = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`
                      else if (v.length > 3) v = `${v.slice(0, 3)}.${v.slice(3)}`
                      setCustomer({ ...customer, cpf: v })
                    }}
                    className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingProfile(false)}
                    className="flex-1 rounded-lg py-2.5 text-sm font-medium border hover:opacity-80"
                    style={{ backgroundColor: theme.bgCard, color: theme.text, borderColor: theme.borderCard }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      const phoneRaw = phoneInput.replace(/\D/g, "")
                      const cpfDigits = (customer.cpf || "").replace(/\D/g, "")
                      // Save to Supabase
                      if (customerData?.id) {
                        try {
                          await fetch("/api/customers", {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              id: customerData.id,
                              name: customer.name,
                              phone: phoneRaw,
                              cpf: customer.cpf,
                              establishmentId: establishment.id,
                            }),
                          })
                        } catch {}
                      }
                      // Save to localStorage
                      localStorage.setItem(`pedefacil-customer-${establishment.slug}`, JSON.stringify({ ...customer, phone: phoneRaw }))
                      setEditingProfile(false)
                      setShowCustomerProfile(false)
                    }}
                    className="flex-1 rounded-lg py-2.5 text-sm font-medium text-white hover:opacity-90"
                    style={{ backgroundColor: theme.primary }}
                  >
                    Salvar
                  </button>
                </div>
              </div>
            )}

            {/* Dark Mode Toggle */}
            <div className="mt-4 pt-4 border-t" style={{ borderColor: theme.borderCard }}>
              <button
                onClick={toggleTheme}
                className="w-full flex items-center justify-between rounded-lg p-3 transition-colors hover:opacity-80"
                style={{ backgroundColor: theme.bgCard }}
              >
                <div className="flex items-center gap-3">
                  {darkMode ? <Sun className="h-4 w-4" style={{ color: theme.textMuted }} /> : <Moon className="h-4 w-4" style={{ color: theme.textMuted }} />}
                  <span className="text-sm" style={{ color: theme.text }}>{darkMode ? "Modo claro" : "Modo escuro"}</span>
                </div>
                <div
                  className="relative h-5 w-9 rounded-full transition-colors"
                  style={{ backgroundColor: darkMode ? theme.primary : theme.borderCard }}
                >
                  <div
                    className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
                    style={{ left: darkMode ? "18px" : "2px" }}
                  />
                </div>
              </button>
            </div>

            {/* Logout */}
            {(customer.phone || customerData?.phone) && (
              <button
                onClick={() => {
                  setCustomerData(null)
                  setPhoneInput("")
                  setCustomer({ name: "", phone: "", address: "", notes: "" })
                  setCep("")
                  setCepAddress(null)
                  localStorage.removeItem(`pedefacil-customer-${establishment.slug}`)
                  setShowCustomerProfile(false)
                }}
                className="mt-2 w-full flex items-center justify-center gap-2 rounded-lg p-3 text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: "#EF4444" }}
              >
                <X className="h-4 w-4" />
                Sair da conta
              </button>
            )}
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      {showCart && !showCheckout && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: theme.overlay }}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border-t p-6 backdrop-blur-xl" style={{ backgroundColor: theme.bgModal, borderColor: theme.borderCard }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold" style={{ color: theme.text }}>Seu pedido</h2>
              <div className="flex items-center gap-2">
                {pendingOrderNumber && (
                  <button
                    onClick={() => {
                      setCancelModalOrderId(customerOrders.find((o: any) => o.orderNumber === pendingOrderNumber)?.id || "")
                      setCancelModalTotal(total)
                    }}
                    className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                    style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)" }}
                  >
                    <X className="h-3 w-3" />
                    Cancelar
                  </button>
                )}
                <button onClick={() => setShowCart(false)} style={{ color: theme.textMutedMore }} className="hover:opacity-70">
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="mb-4 flex gap-2">
              {orderConfig.delivery && (
                <button
                  type="button"
                  onClick={() => handleOrderTypeChange("delivery")}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 text-sm"
                  style={orderType === "delivery" ? { borderColor: `${theme.primary}80`, backgroundColor: `${theme.primary}14`, color: theme.primary } : { borderColor: theme.borderCard, color: theme.textSubtle }}
                >
                  <Bike className="h-5 w-5" />
                  Entrega
                </button>
              )}
              {orderConfig.pickup && (
                <button
                  type="button"
                  onClick={() => handleOrderTypeChange("pickup")}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 text-sm"
                  style={orderType === "pickup" ? { borderColor: `${theme.primary}80`, backgroundColor: `${theme.primary}14`, color: theme.primary } : { borderColor: theme.borderCard, color: theme.textSubtle }}
                >
                  <StoreIcon className="h-5 w-5" />
                  Retirada
                </button>
              )}
            </div>

            {orderType === "pickup" && establishment.address && (
              <div className="mb-3 rounded-lg border p-3" style={{ backgroundColor: theme.accentLight, borderColor: theme.accentLight }}>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: theme.accent }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: theme.accent }}>Retirada em:</p>
                    <p className="text-sm" style={{ color: theme.accentMid }}>{establishment.address}</p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(establishment.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium"
                      style={{ color: theme.accent }}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Ver no mapa
                    </a>
                  </div>
                </div>
              </div>
            )}

            {orderType === "delivery" && deliveryFee > 0 && (
              <div className="mb-3 rounded-lg bg-amber-500/[0.06] p-3 text-sm text-amber-300">
                <p className="font-medium">Taxa de entrega: {formatCurrency(deliveryFee)}</p>
                {establishment.deliveryFeeType === "free_above" && subtotal < (establishment.deliveryFreeAbove || 0) && (
                  <p className="text-xs mt-1 text-amber-400/70">
                    Frete grátis acima de {formatCurrency(establishment.deliveryFreeAbove || 0)}!
                    Faltam {formatCurrency((establishment.deliveryFreeAbove || 0) - subtotal)}.
                  </p>
                )}
              </div>
            )}
            {orderType === "delivery" && deliveryFee === 0 && (
              <div className="mb-3 rounded-lg p-3 text-sm" style={{ backgroundColor: theme.accentLight, color: theme.accent }}>
                <p className="font-medium">Entrega grátis!</p>
              </div>
            )}

            {cart.length === 0 ? (
              <p className="py-8 text-center" style={{ color: theme.textMuted }}>Carrinho vazio</p>
            ) : (
              <div className="space-y-3">
                {pendingOrderNumber && (
                  <div className="rounded-lg p-2 text-center" style={{ backgroundColor: `${theme.primary}15`, borderWidth: 1, borderStyle: "solid", borderColor: `${theme.primary}30` }}>
                    <p className="text-xs font-medium" style={{ color: theme.primary }}>Pedido #{pendingOrderNumber} - Aguardando pagamento</p>
                  </div>
                )}
{cart.map((item) => {
                  const isPending = !!pendingOrderNumber
                  const isFromPendingOrder = isPending
                  return (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg p-2" style={{ backgroundColor: theme.bgCard }}>
                    {item.image && (
                      <img src={item.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" style={{ color: theme.text }}>{item.name}</p>
                      <p className="text-xs" style={{ color: theme.textMuted }}>{formatCurrency(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => updateQuantity(item.id, -1)} disabled={isFromPendingOrder} className="flex h-9 w-9 items-center justify-center rounded-full transition-all" style={{ border: `1px solid ${theme.borderInputColor}`, color: isFromPendingOrder ? theme.textMutedMore : theme.textSubtle, opacity: isFromPendingOrder ? 0.4 : 1 }}>
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center font-medium" style={{ color: theme.text }}>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} disabled={isFromPendingOrder} className="flex h-9 w-9 items-center justify-center rounded-full transition-all" style={{ border: `1px solid ${theme.borderInputColor}`, color: isFromPendingOrder ? theme.textMutedMore : theme.textSubtle, opacity: isFromPendingOrder ? 0.4 : 1 }}>
                        <Plus className="h-3 w-3" />
                      </button>
                      <button onClick={() => removeItem(item.id)} disabled={isFromPendingOrder} className="flex h-8 w-8 items-center justify-center rounded-full transition-colors" style={{ color: isFromPendingOrder ? theme.textMutedMore : "#EF4444", opacity: isFromPendingOrder ? 0.4 : 1 }}>
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  );})}

                {!lastOrder?.paymentLink && !pendingOrderNumber && (
                  <button
                    onClick={() => {
                      if (window.confirm("Deseja esvaziar o carrinho?")) {
                        setCart([])
                        localStorage.removeItem(`pedefacil-cart-${establishment.slug}`)
                      }
                    }}
                    className="text-xs font-medium hover:underline pt-1"
                    style={{ color: "#EF4444" }}
                  >
                    Esvaziar carrinho
                  </button>
                )}

                {!couponData ? (
                  <div className="flex gap-2 pt-3">
                    <input
                      placeholder="Cupom de desconto"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="flex-1 h-10 rounded-lg border px-3 py-2 text-sm placeholder:opacity-40 focus:outline-none focus:ring-2 focus:ring-green-500"
                      style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }}
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
                  <div className="flex items-center justify-between rounded-lg border px-3 py-2 pt-3" style={{ backgroundColor: theme.accentLight, borderColor: theme.accentLight }}>
                    <div className="flex items-center gap-2 text-sm" style={{ color: theme.accent }}>
                      <Tag className="h-4 w-4" />
                      <span className="font-medium">{couponData.code}</span>
                      <span>-{couponData.discountType === "percentage" ? `${couponData.discountValue}%` : formatCurrency(couponData.discountValue)}</span>
                    </div>
                    <button onClick={removeCoupon} style={{ color: theme.accent }}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {couponError && <p className="text-xs text-red-400 pt-1">{couponError}</p>}

                {/* Loyalty */}
                {parsedLoyalty?.enabled && customerLoyaltyPoints > 0 && (
                  <div className="pt-3">
                    <label className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-400" />
                        <div>
                          <p className="text-sm font-medium" style={{ color: theme.text }}>
                            {parsedLoyalty.redeemType === "product" ? "Trocar pontos por produto" : "Usar pontos de fidelidade"}
                          </p>
                          <p className="text-xs" style={{ color: theme.textMuted }}>{customerLoyaltyPoints} pontos disponíveis</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={useLoyalty}
                        onChange={(e) => setUseLoyalty(e.target.checked)}
                        disabled={customerLoyaltyPoints < (parsedLoyalty.redeemPoints || 100)}
                        className="h-4 w-4 rounded border-white/20 text-amber-500 focus:ring-amber-500"
                      />
                    </label>
                    {customerLoyaltyPoints < (parsedLoyalty.redeemPoints || 100) && (
                      <p className="mt-1 text-xs" style={{ color: theme.textMutedMore }}>
                        {parsedLoyalty.redeemType === "product"
                          ? `Faltam ${(parsedLoyalty.redeemPoints || 100) - customerLoyaltyPoints} pontos para resgatar um produto`
                          : `Faltam ${(parsedLoyalty.redeemPoints || 100) - customerLoyaltyPoints} pontos para resgatar R$ ${parsedLoyalty.redeemDiscount || 10} de desconto`}
                      </p>
                    )}
                    {useLoyalty && loyaltyDiscount > 0 && (
                      <p className="mt-1 text-xs" style={{ color: theme.accent }}>-{formatCurrency(loyaltyDiscount)} de desconto aplicado</p>
                    )}
                    {useLoyalty && loyaltyFreeProduct && (
                      <p className="mt-1 text-xs" style={{ color: theme.accent }}>+{loyaltyFreeProduct.name} (Produto grátis!)</p>
                    )}
                    {parsedLoyalty.redeemType === "product" && parsedLoyalty.redeemProductId && !loyaltyFreeProduct && customerLoyaltyPoints >= (parsedLoyalty.redeemPoints || 100) && (
                      <p className="mt-1 text-xs" style={{ color: theme.textMuted }}>Adicione o produto ao carrinho para resgatar</p>
                    )}
                  </div>
                )}

                <div className="pt-3 space-y-1">
                  <div className="flex justify-between text-sm" style={{ color: theme.textSubtle }}>
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {deliveryFee > 0 && (
                    <div className="flex justify-between text-sm" style={{ color: theme.textSubtle }}>
                      <span>Taxa de entrega</span>
                      <span>{formatCurrency(deliveryFee)}</span>
                    </div>
                  )}
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-sm" style={{ color: theme.accent }}>
                      <span>Desconto (cupom)</span>
                      <span>-{formatCurrency(couponDiscount)}</span>
                    </div>
                  )}
                  {loyaltyDiscount > 0 && (
                    <div className="flex justify-between text-sm text-amber-400">
                      <span>Desconto (pontos)</span>
                      <span>-{formatCurrency(loyaltyDiscount)}</span>
                    </div>
                  )}
                  {loyaltyFreeProduct && (
                    <div className="flex justify-between text-sm" style={{ color: theme.accent }}>
                      <span>Produto grátis ({loyaltyFreeProduct.name})</span>
                      <span>-{formatCurrency(loyaltyFreeProduct.price)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 text-lg font-bold" style={{ borderColor: theme.borderCard }}>
                    <span style={{ color: theme.text }}>Total</span>
                    <span style={{ color: theme.accent }}>{formatCurrency(total)}</span>
                  </div>
                </div>

                <div className="pt-2">
                  {lastOrder?.paymentLink ? (
                    <Button
                      size="lg"
                      className="w-full gap-2"
                      onClick={() => {
                        setShowCart(false)
                        setOrderResult({
                          success: true,
                          orderId: lastOrder.orderId,
                          paymentLink: lastOrder.paymentLink,
                          paymentMethod: lastOrder.paymentMethod || "pix",
                          orderTotal: total,
                        })
                        setTimeout(() => setShowPaymentModal(true), 300)
                      }}
                    >
                      <CreditCard className="h-5 w-5" />
                      Pagar pedido
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      className="w-full gap-2"
                      onClick={() => setShowCheckout(true)}
                      disabled={!isOpen}
                    >
                      <ShoppingBag className="h-5 w-5" />
                      {!isOpen ? "Estabelecimento fechado" : "Finalizar pedido"}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout - Site */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border-t p-6 backdrop-blur-xl" style={{ backgroundColor: theme.bgModal, borderColor: theme.borderCard }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold" style={{ color: theme.text }}>Finalizar pedido</h2>
              <button onClick={() => { setShowCheckout(false); setEditingAddress(false) }} style={{ color: theme.textMutedMore }} className="hover:opacity-70">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSiteOrder} className="space-y-4">
              {orderType === "delivery" ? (
                <div className="space-y-2">
                  {addressSaved && cepAddress ? (
                    <div className="rounded-lg p-3 text-sm space-y-2" style={{ backgroundColor: theme.bgCard, color: theme.textSubtle }}>
                      <p>{cepAddress.logradouro}, {customer.address} - {cepAddress.bairro}, {cepAddress.localidade} - {cepAddress.uf}</p>
                      <button type="button" onClick={() => setAddressSaved(false)} className="text-xs hover:underline" style={{ color: theme.accent }}>
                        Alterar endereço
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                      <div className="space-y-1">
                        <label htmlFor="cep" className="block text-sm font-medium" style={{ color: theme.textSubtle }}>CEP</label>
                        <input id="cep" placeholder="00000-000" value={cep} onChange={(e) => setCep(e.target.value.replace(/\D/g, "").slice(0, 8))} className="w-32 h-10 rounded-lg border px-3 py-2 text-sm placeholder:opacity-40 focus:outline-none focus:ring-2 focus:ring-green-500" style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }} disabled={addressSaved && !!cepAddress} />
                      </div>
                        {cep.length === 8 && !cepLoading && (
                          <button type="button" onClick={lookupCep} className="mt-6 text-xs hover:underline self-start" style={{ color: theme.accent }}>
                            Buscar
                          </button>
                        )}
                        {cepLoading && <Loader2 className="mt-7 h-4 w-4 animate-spin" style={{ color: theme.textMutedMore }} />}
                      </div>
                      {cepError && <p className="text-xs text-red-400">{cepError}</p>}
                      {cepAddress && (
                        <p className="text-xs" style={{ color: theme.textMuted }}>{cepAddress.logradouro} - {cepAddress.bairro}, {cepAddress.localidade} - {cepAddress.uf}</p>
                      )}
                      <div className="space-y-1">
                        <label htmlFor="customerAddress" className="block text-sm font-medium" style={{ color: theme.textSubtle }}>Número</label>
                        <input id="customerAddress" placeholder="Ex: 123" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} className="w-full h-10 rounded-lg border px-3 py-2 text-sm placeholder:opacity-40 focus:outline-none focus:ring-2 focus:ring-green-500" style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }} disabled={addressSaved} />
                      </div>
                      {cepAddress && customer.address && (
                        <button type="button" onClick={() => { setAddressSaved(true); setEditingAddress(false) }} className="w-full rounded-lg bg-gradient-to-r from-[#FF6B35] to-[#E55A2B] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
                          Salvar endereço
                        </button>
                      )}
                    </>
                  )}
                  <input type="hidden" name="fullAddress" value={fullAddress} />
                </div>
              ) : (
                <div className="rounded-lg p-3 text-sm border" style={{ backgroundColor: theme.accentLight, color: theme.accent, borderColor: theme.accentLight }}>
                  <StoreIcon className="inline h-4 w-4 mr-1" />
                  Retirada no local: {establishment.address || "Consulte o estabelecimento"}
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="notes" className="block text-sm font-medium" style={{ color: theme.textSubtle }}>Observações</label>
                <textarea
                  id="notes"
                  placeholder="Ex: Sem cebola, ponto da carne..."
                  value={customer.notes}
                  onChange={(e) => setCustomer({ ...customer, notes: e.target.value })}
                  style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput }}
                  className="flex min-h-[80px] w-full rounded-lg border px-3 py-2 text-sm placeholder:opacity-40 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-medium" style={{ color: theme.textSubtle }}>Pagamento</p>
                <div className="grid grid-cols-2 gap-2">
                  {availablePayments.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPaymentMethod(p.key as any)}
                      className="flex items-center gap-2 rounded-lg border p-3 text-sm"
                      style={paymentMethod === p.key ? { borderColor: `${theme.primary}80`, backgroundColor: `${theme.primary}14`, color: theme.primary } : { borderColor: theme.borderCard, color: theme.textSubtle }}
                    >
                      {p.icon}
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {orderError && <div className="rounded-lg bg-red-500/[0.06] p-3 text-sm text-red-400 border border-red-500/20">{orderError}</div>}

              <div className="rounded-lg p-3" style={{ backgroundColor: theme.bgCard }}>
                <p className="text-sm font-medium mb-2" style={{ color: theme.textSubtle }}>Resumo</p>
                <div className="flex items-center gap-1 text-xs mb-2" style={{ color: theme.textMuted }}>
                  {orderType === "delivery" ? <Bike className="h-3 w-3" /> : <StoreIcon className="h-3 w-3" />}
                  {orderType === "delivery" ? "Entrega" : "Retirada"}
                </div>
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm" style={{ color: theme.textSubtle }}>
                    <span>{item.name} x{item.quantity}</span>
                    <span>{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
                <div className="mt-2 space-y-1 border-t pt-2" style={{ borderColor: theme.borderCard }}>
                  <div className="flex justify-between text-sm" style={{ color: theme.textSubtle }}>
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {deliveryFee > 0 && (
                    <div className="flex justify-between text-sm" style={{ color: theme.textSubtle }}>
                      <span>Taxa de entrega</span>
                      <span>{formatCurrency(deliveryFee)}</span>
                    </div>
                  )}
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-sm" style={{ color: theme.accent }}>
                      <span>Desconto ({couponData?.code})</span>
                      <span>-{formatCurrency(couponDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold" style={{ color: theme.text }}>
                    <span>Total</span>
                    <span style={{ color: theme.accent }}>{formatCurrency(total)}</span>
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

      {/* Orders list modal */}
      {showOrdersList && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ backgroundColor: theme.overlay }}>
          <div className="w-full max-w-lg max-h-[80vh] overflow-hidden rounded-t-2xl sm:rounded-2xl flex flex-col backdrop-blur-xl" style={{ backgroundColor: theme.bgModal, borderWidth: 1, borderStyle: "solid", borderColor: theme.borderCard }}>
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: theme.borderCard }}>
              <h2 className="text-lg font-bold" style={{ color: theme.text }}>Seus pedidos</h2>
              <button onClick={() => setShowOrdersList(false)} style={{ color: theme.textMutedMore }} className="hover:opacity-70">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {!customer.phone && !customerData?.phone ? (
                <div className="text-center py-8">
                  <User className="mx-auto h-8 w-8" style={{ color: theme.textMutedMore }} />
                  <p className="mt-2 text-sm" style={{ color: theme.textMuted }}>Identifique-se para ver seus pedidos</p>
                  <button onClick={() => { setShowOrdersList(false); openIdentifyModal() }} className="mt-2 text-sm hover:underline" style={{ color: theme.accent }}>
                    Identificar-se
                  </button>
                </div>
              ) : loadingOrders ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" style={{ color: theme.accent }} />
                </div>
              ) : customerOrders.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="mx-auto h-8 w-8" style={{ color: theme.textMutedMore }} />
                  <p className="mt-2 text-sm" style={{ color: theme.textMuted }}>Nenhum pedido encontrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {customerOrders.map((order) => {
                    const items = typeof order.items === "string" ? JSON.parse(order.items) : order.items
                    const statusColors: Record<string, string> = {
                      pending: "bg-amber-500/10 text-amber-400",
                      confirmed: "bg-blue-500/10 text-blue-400",
                      preparing: "bg-orange-500/10 text-orange-400",
                      ready: "bg-green-500/10 text-green-400",
                      out_for_delivery: "bg-purple-500/10 text-purple-400",
                      delivered: "bg-green-500/10 text-green-400",
                      cancelled: "bg-red-500/10 text-red-400",
                      payment_pending: "bg-amber-500/10 text-amber-400",
                    }
                    const statusLabels: Record<string, string> = {
                      pending: "Pendente",
                      confirmed: "Confirmado",
                      preparing: "Preparando",
                      ready: "Pronto",
                      out_for_delivery: "Saiu p/ entrega",
                      delivered: "Entregue",
                      cancelled: "Cancelado",
                      payment_pending: "Aguardando pagamento",
                    }
                    const hasPendingPayment = order.paymentStatus === "pending" && order.paymentLink
                    const isCancelled = order.status === "cancelled"
                    return (
                      <div
                        key={order.id}
                        className="rounded-xl border p-3 transition-colors"
                        style={{
                          borderColor: isCancelled ? "rgba(239,68,68,0.3)" : theme.borderCard,
                          backgroundColor: isCancelled ? "rgba(239,68,68,0.05)" : undefined,
                        }}
                      >
                        <button
                          onClick={() => {
                            setShowOrdersList(false)
                            if (order.trackingToken) {
                              openTracking(order.id, `/pedido/${order.trackingToken}`)
                            }
                          }}
                          className="w-full text-left"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium" style={{ color: theme.textMuted }}>
                                #{order.orderNumber}
                              </p>
                              <p className="text-sm font-medium truncate" style={{ color: theme.text }}>
                                {items.map((i: any) => `${i.quantity}x ${i.name}`).join(", ")}
                              </p>
                              <p className="text-xs mt-0.5" style={{ color: theme.textMutedMore }}>
                                {new Date(order.createdAt).toLocaleDateString("pt-BR")} às {new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold" style={{ color: theme.accent }}>{formatCurrency(order.total)}</p>
                              <span className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[order.status] || ""}`} style={!statusColors[order.status] ? { backgroundColor: theme.bgCard, color: theme.textMuted } : {}}>
                                {statusLabels[order.status] || order.status}
                              </span>
                            </div>
                          </div>
                        </button>
                        {hasPendingPayment && (
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => {
                                setShowOrdersList(false)
                                setOrderResult({
                                  success: true,
                                  orderId: order.id,
                                  paymentLink: order.paymentLink,
                                  paymentMethod: order.paymentMethod || "pix",
                                  orderTotal: order.total,
                                })
                                setTimeout(() => setShowPaymentModal(true), 300)
                              }}
                              className="flex-1 rounded-lg py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                              style={{ backgroundColor: theme.primary }}
                            >
                              <CreditCard className="inline h-4 w-4 mr-1" />
                              Pagar agora
                            </button>
                            <button
                              onClick={() => {
                                setCancelModalOrderId(order.id)
                                setCancelModalTotal(order.total)
                              }}
                              className="rounded-lg border px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80"
                              style={{ borderColor: theme.borderCard, color: theme.textMuted }}
                            >
                              <X className="inline h-4 w-4" />
                            </button>
                          </div>
                        )}
                        {!hasPendingPayment && (
                          <>
                            {["pending", "confirmed", "preparing", "ready", "out_for_delivery"].includes(order.status) && (
                              <button
                                onClick={() => {
                                  setShowOrdersList(false)
                                  if (order.trackingToken) {
                                    openTracking(order.id, `/pedido/${order.trackingToken}`)
                                  }
                                }}
                                className="mt-2 w-full rounded-lg py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                                style={{ backgroundColor: theme.primary }}
                              >
                                Acompanhar pedido
                              </button>
                            )}
                            {!["pending", "confirmed", "preparing", "ready", "out_for_delivery"].includes(order.status) && (
                              <button
                                onClick={() => {
                                  setCart(items.map((i: any) => ({ id: i.id || i.productId || i.name, name: i.name, price: i.price, image: i.image, quantity: i.quantity })))
                                  setShowOrdersList(false)
                                  openCart()
                                }}
                                className="mt-2 w-full rounded-lg border py-2 text-sm font-medium transition-opacity hover:opacity-80"
                                style={{ borderColor: theme.borderCard, color: theme.accent }}
                              >
                                <RefreshCw className="inline h-3.5 w-3.5 mr-1" />
                                Pedir novamente
                              </button>
                            )}
                          </>
                        )}
                      </div>
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
          <div className="rounded-lg bg-[#FF6B35] px-6 py-3 text-sm font-semibold text-white shadow-lg">
            {statusAlert}
          </div>
        </div>
      )}

      {/* Tracking modal */}
      {showTracking && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ backgroundColor: theme.overlay }}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-2xl flex flex-col backdrop-blur-xl" style={{ backgroundColor: theme.bgModal, borderWidth: 1, borderStyle: "solid", borderColor: theme.borderCard }}>
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: theme.borderCard }}>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold" style={{ color: theme.text }}>Acompanhar pedido</h2>
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
                  className="text-xs font-medium"
                  style={{ color: theme.accent }}
                >
                  Ver outros
                </button>
                <button onClick={() => setShowTracking(false)} style={{ color: theme.textMutedMore }} className="hover:opacity-70">
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
                      const showPayButton = step === "pending" && trackingOrder.paymentStatus === "pending" && trackingOrder.paymentLink
                      return (
                        <div key={step} className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${isCompleted ? "bg-green-500/[0.12] text-green-400" : ""} ${isCurrent ? "ring-2 ring-green-500" : ""}`} style={!isCompleted ? { backgroundColor: theme.bgCard, color: theme.textMutedMore } : {}}>
                            {statusIcons[step]}
                          </div>
                          <span className={`text-sm font-medium ${isCurrent ? "text-green-300" : ""}`} style={!isCompleted ? { color: theme.textMutedMore } : isCompleted ? { color: theme.text } : {}}>
                            {statusLabels[step]}
                          </span>
                          {isCurrent && <Badge variant="success" className="text-[10px]">Atual</Badge>}
                           {showPayButton && (
                             <div className="ml-auto flex gap-1">
                               <button
                                  onClick={() => {
                                    setOrderResult({
                                      success: true,
                                      orderId: trackingOrder.id,
                                      paymentLink: trackingOrder.paymentLink,
                                      paymentMethod: trackingOrder.paymentMethod || "pix",
                                      orderTotal: trackingOrder.total,
                                    })
                                    setTimeout(() => {
                                      setShowTracking(false)
                                      setShowPaymentModal(true)
                                    }, 300)
                                  }}
                                 className="rounded-lg px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90"
                                 style={{ backgroundColor: theme.primary }}
                               >
                                 <CreditCard className="inline h-3 w-3 mr-1" />
                                 Pagar
                               </button>
                               <button
                                 onClick={() => {
                                   setCancelModalOrderId(trackingOrder.id)
                                   setCancelModalTotal(trackingOrder.total)
                                 }}
                                 className="rounded-lg border px-2 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                                 style={{ borderColor: theme.borderCard, color: theme.textMuted }}
                               >
                                 <X className="inline h-3 w-3" />
                               </button>
                             </div>
                           )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="border-t pt-3" style={{ borderColor: theme.borderCard }}>
                    <p className="text-xs" style={{ color: theme.textMutedMore }}>Total: <span className="font-semibold" style={{ color: theme.accent }}>R$ {trackingOrder.total?.toFixed(2)}</span></p>
                  </div>
                </>
              )}

              <div className="border-t pt-3" style={{ borderColor: theme.borderCard }}>
                <h3 className="text-sm font-semibold mb-2" style={{ color: theme.textSubtle }}>Mensagens</h3>
                <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
                  {trackingMessages.length === 0 && (
                    <p className="text-center text-xs py-2" style={{ color: theme.textMutedMore }}>Envie uma mensagem ao estabelecimento</p>
                  )}
                  {trackingMessages.map((msg: any) => (
                    <div key={msg.id} className={`flex ${msg.sender === "customer" ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[80%] rounded-lg px-3 py-1.5 text-sm" style={msg.sender === "customer" ? { backgroundColor: theme.primary, color: "#ffffff" } : { backgroundColor: theme.bgCard, color: theme.textSubtle }}>
                        <p>{msg.message}</p>
                        <p className="text-[10px] mt-0.5" style={msg.sender === "customer" ? { color: "rgba(255,255,255,0.6)" } : { color: theme.textMutedMore }}>
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
                    className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }}
                  />
                  <Button size="sm" onClick={sendTrackingMessage} disabled={!trackingInput.trim() || trackingSending} loading={trackingSending}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment modal - Checkout Transparente */}
      {/* PaymentModal is rendered in the early return above when paymentLink exists */}

      {/* Pending order confirmation modal */}
      {pendingOrderConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: theme.overlay }}>
          <div className="w-full max-w-sm rounded-2xl p-6 backdrop-blur-xl" style={{ backgroundColor: theme.bgModal, borderWidth: 1, borderStyle: "solid", borderColor: theme.borderCard }}>
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
                <Package className="h-6 w-6 text-amber-400" />
              </div>
            </div>
            <h3 className="mb-2 text-center text-lg font-bold" style={{ color: theme.text }}>Pedido em andamento</h3>
            <p className="mb-6 text-center text-sm" style={{ color: theme.textMuted }}>
              Você já tem o pedido <strong style={{ color: theme.accent }}>#{pendingOrderConfirm.orderNumber}</strong> com pagamento pendente (<strong style={{ color: theme.accent }}>R$ {pendingOrderConfirm.total.toFixed(2)}</strong>). Deseja criar outro pedido?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setPendingOrderConfirm(null); skipPendingCheckRef.current = false }}
                className="flex-1 rounded-xl border py-3 text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ borderColor: theme.borderCard, color: theme.text }}
              >
                Não, voltar
              </button>
              <button
                onClick={() => {
                  console.log("[Sim, criar novo] clicked, setting skipPendingCheck=true and calling submitOrder()")
                  if (pendingOrderConfirm) seenPendingOrdersRef.current.add(pendingOrderConfirm.orderId)
                  setPendingOrderConfirm(null)
                  skipPendingCheckRef.current = true
                  submitOrder()
                }}
                className="flex-1 rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: theme.primary }}
              >
                Sim, criar novo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending payment order modal */}
      {pendingOrderModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: theme.overlay }}>
          <div className="w-full max-w-sm rounded-2xl p-6 backdrop-blur-xl" style={{ backgroundColor: theme.bgModal, borderWidth: 1, borderStyle: "solid", borderColor: theme.borderCard }}>
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
                <Clock className="h-6 w-6 text-amber-400" />
              </div>
            </div>
            <h3 className="mb-2 text-center text-lg font-bold" style={{ color: theme.text }}>Pagamento pendente</h3>
            <p className="mb-6 text-center text-sm" style={{ color: theme.textMuted }}>
              Você tem o pedido <strong style={{ color: theme.accent }}>#{pendingOrderModal.orderNumber}</strong> pendente de pagamento no valor de <strong style={{ color: theme.accent }}>R$ {pendingOrderModal.total.toFixed(2)}</strong>. O que deseja fazer?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setPendingOrderModal(null)
                  openTracking(pendingOrderModal.orderId, `/pedido/${pendingOrderModal.orderId}`)
                }}
                className="w-full rounded-xl py-3 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ backgroundColor: theme.primary, color: "white" }}
              >
                Acompanhar pedido
              </button>
              <button
                onClick={() => {
                  seenPendingOrdersRef.current.add(pendingOrderModal.orderId)
                  setPendingOrderModal(null)
                  setOrderResult({
                    success: true,
                    orderId: pendingOrderModal.orderId,
                    paymentLink: pendingOrderModal.paymentLink,
                    paymentMethod: pendingOrderModal.paymentMethod || "pix",
                    orderTotal: pendingOrderModal.total,
                  })
                  setShowPaymentModal(true)
                }}
                className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: theme.accent }}
              >
                Pagar agora
              </button>
              <button
                onClick={() => {
                  setCancelModalOrderId(pendingOrderModal.orderId)
                  setCancelModalTotal(pendingOrderModal.total)
                  setPendingOrderModal(null)
                }}
                className="w-full rounded-xl border py-3 text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ borderColor: "rgba(239,68,68,0.3)", color: "#EF4444" }}
              >
                Cancelar pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending order action modal - when trying to add item with pending payment */}
      {pendingOrderAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: theme.overlay }} onClick={() => setPendingOrderAction(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6 backdrop-blur-xl" style={{ backgroundColor: theme.bgModal, borderWidth: 1, borderStyle: "solid", borderColor: theme.borderCard }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex justify-center flex-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
                  <Clock className="h-6 w-6 text-amber-400" />
                </div>
              </div>
              <button onClick={() => setPendingOrderAction(null)} className="flex h-8 w-8 items-center justify-center rounded-full transition-colors" style={{ color: theme.textMuted }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <h3 className="mb-2 text-center text-lg font-bold" style={{ color: theme.text }}>Pedido pendente</h3>
            <p className="mb-6 text-center text-sm" style={{ color: theme.textMuted }}>
              {pendingOrderAction.orderNumber > 0
                ? `Você tem o pedido <strong style={{ color: theme.accent }}>#${pendingOrderAction.orderNumber}</strong> aguardando pagamento. Para fazer novo pedido, pague ou cancele o atual.`
                : "Você tem um pedido aguardando pagamento. Para fazer novo pedido, pague ou cancele o atual."
              }
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setPendingOrderAction(null)
                  setShowCart(true)
                }}
                className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: theme.accent }}
              >
                Ver carrinho
              </button>
              <button
                onClick={() => {
                  setCancelModalOrderId(pendingOrderAction.orderId)
                  setCancelModalTotal(
                    customerOrders.find((o: any) => o.id === pendingOrderAction.orderId)?.total ||
                    (lastOrder?.orderId === pendingOrderAction.orderId ? lastOrder.total : 0)
                  )
                  setPendingOrderAction(null)
                }}
                className="w-full rounded-xl border py-3 text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ borderColor: "rgba(239,68,68,0.3)", color: "#EF4444" }}
              >
                Cancelar pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-progress order notification modal */}
      {inProgressOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: theme.overlay }} onClick={() => setInProgressOrder(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6 backdrop-blur-xl" style={{ backgroundColor: theme.bgModal, borderWidth: 1, borderStyle: "solid", borderColor: theme.borderCard }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex justify-center flex-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
                  <Package className="h-6 w-6 text-blue-400" />
                </div>
              </div>
              <button onClick={() => setInProgressOrder(null)} className="flex h-8 w-8 items-center justify-center rounded-full transition-colors" style={{ color: theme.textMuted }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <h3 className="mb-2 text-center text-lg font-bold" style={{ color: theme.text }}>Pedido em andamento</h3>
            <p className="mb-6 text-center text-sm" style={{ color: theme.textMuted }}>
              Você já tem o pedido <strong style={{ color: theme.accent }}>#{inProgressOrder.orderNumber}</strong> ({inProgressOrder.status}) no valor de <strong style={{ color: theme.accent }}>R$ {inProgressOrder.total.toFixed(2)}</strong>. O que deseja fazer?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  const token = inProgressOrder.trackingUrl.split("/pedido/")[1]
                  setInProgressOrder(null)
                  openTracking(inProgressOrder.orderId, inProgressOrder.trackingUrl)
                }}
                className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: theme.primary }}
              >
                Acompanhar pedido
              </button>
              <button
                onClick={() => {
                  seenPendingOrdersRef.current.add(inProgressOrder.orderId)
                  setInProgressOrder(null)
                }}
                className="w-full rounded-xl border py-3 text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ borderColor: theme.borderCard, color: theme.text }}
              >
                Fazer novo pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel order confirmation modal */}
      {cancelModalOrderId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: theme.overlay }}>
          <div className="w-full max-w-sm rounded-2xl p-6 backdrop-blur-xl" style={{ backgroundColor: theme.bgModal, borderWidth: 1, borderStyle: "solid", borderColor: theme.borderCard }}>
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                <X className="h-6 w-6 text-red-400" />
              </div>
            </div>
            <h3 className="mb-2 text-center text-lg font-bold" style={{ color: theme.text }}>Cancelar pedido?</h3>
            <p className="mb-6 text-center text-sm" style={{ color: theme.textMuted }}>
              Tem certeza que deseja cancelar este pedido de <strong style={{ color: theme.accent }}>R$ {cancelModalTotal.toFixed(2)}</strong>? O pagamento não será processado.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelModalOrderId(null)}
                className="flex-1 rounded-xl border py-3 text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ borderColor: theme.borderCard, color: theme.text }}
              >
                Voltar
              </button>
              <button
                onClick={() => cancelOrder(cancelModalOrderId)}
                disabled={cancelling}
                className="flex-1 rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "#EF4444" }}
              >
                {cancelling ? "Cancelando..." : "Sim, cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PaymentModal({
  orderId,
  paymentLink,
  total,
  theme,
  onClose,
  establishmentId,
  establishmentSlug,
  initialTab,
  mode,
  onPaymentSuccess,
}: {
  orderId: string
  paymentLink: string
  total: number
  theme: any
  onClose: () => void
  establishmentId: string
  establishmentSlug: string
  initialTab?: "pix" | "card"
  mode?: "pix" | "card"
  onPaymentSuccess?: () => void
}) {
  const [tab, setTab] = useState<"pix" | "card">(initialTab || "pix")

  // Pix state
  const [qrCode, setQrCode] = useState<{ image: string; payload: string } | null>(null)
  const [qrLoading, setQrLoading] = useState(true)
  const [qrError, setQrError] = useState("")
  const [copied, setCopied] = useState(false)
  const [countdown, setCountdown] = useState(() => {
    if (typeof window === "undefined") return 0
    const savedCountdown = parseInt(localStorage.getItem(`pedefacil-countdown-${establishmentSlug}`) || "0")
    const savedTime = parseInt(localStorage.getItem(`pedefacil-countdown-time-${establishmentSlug}`) || "0")
    if (savedCountdown > 0 && savedTime > 0) {
      const elapsed = Math.floor((Date.now() - savedTime) / 1000)
      return Math.max(0, savedCountdown - elapsed)
    }
    return 0
  })
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  function handleClose() {
    if (countdown > 0) {
      localStorage.setItem(`pedefacil-countdown-${establishmentSlug}`, countdown.toString())
      localStorage.setItem(`pedefacil-countdown-time-${establishmentSlug}`, Date.now().toString())
    }
    onClose()
  }
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null)

  // Card state
  const [cardNumber, setCardNumber] = useState("")
  const [cardExpiry, setCardExpiry] = useState("")
  const [cardCvv, setCardCvv] = useState("")
  const [cardName, setCardName] = useState("")
  const [cardCpf, setCardCpf] = useState("")
  const [cardEmail, setCardEmail] = useState("")
  const [cardPhone, setCardPhone] = useState("")
  const [cardCep, setCardCep] = useState("")
  const [cardAddressNum, setCardAddressNum] = useState("")
  const [cardProcessing, setCardProcessing] = useState(false)
  const [cardError, setCardError] = useState("")
  const [cardPending, setCardPending] = useState(false)

  // Success state
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  // Fetch QR Code on mount with retry (runs for PIX tab and card mode to get invoiceUrl)
  useEffect(() => {
    if ((tab !== "pix" && !mode) || !orderId) return
    setQrLoading(true)
    setQrError("")
    const controller = new AbortController()

    async function fetchQrCode(retries = 3) {
      for (let i = 0; i < retries; i++) {
        if (controller.signal.aborted) return
        try {
          const res = await fetch("/api/payments/asaas/qr-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId }),
            signal: controller.signal,
          })
          if (controller.signal.aborted) return
          const data = await res.json()
          if (data.encodedImage) {
            setQrCode({ image: data.encodedImage, payload: data.payload })
            setCountdown(prev => prev > 0 ? prev : 300)
            setQrLoading(false)
            return
          }
          // Handle invoiceUrl for non-PIX payments (sandbox)
          if (data.invoiceUrl) {
            setInvoiceUrl(data.invoiceUrl)
            setQrLoading(false)
            return
          }
          // If error, wait and retry
          if (i < retries - 1) {
            await new Promise(r => setTimeout(r, 2000))
          } else {
            setQrError(data.error || "Erro ao gerar QR Code")
          }
        } catch (err: any) {
          if (controller.signal.aborted) return
          if (i < retries - 1) {
            await new Promise(r => setTimeout(r, 2000))
          } else {
            setQrError("Erro de conexão")
          }
        }
      }
      setQrLoading(false)
    }

    fetchQrCode()
    return () => controller.abort()
  }, [tab, orderId])

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [countdown > 0])

  // Check payment status periodically
  // PIX tab: poll after QR code loaded (no 8s delay since modal is open)
  // Card tab: only poll after user submitted card (cardPending=true)
  useEffect(() => {
    if (paymentSuccess || !orderId) return
    if (tab === "pix" && !qrCode) return
    if (tab === "card" && !cardPending) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      const check = setInterval(async () => {
        if (controller.signal.aborted) { clearInterval(check); return }
        try {
          const res = await fetch(`/api/orders/${orderId}/payment-status`, { signal: controller.signal })
          if (res.ok) {
            const data = await res.json()
            if (data.paymentStatus === "paid") {
              console.log("[PaymentModal] Polling detected paid status, calling onPaymentSuccess")
              setPaymentSuccess(true)
              setCardPending(false)
              onPaymentSuccess?.()
              clearInterval(check)
            }
          }
        } catch {}
      }, 3000)
      controller.signal.addEventListener("abort", () => clearInterval(check))
    }, 0)
    return () => { controller.abort(); clearTimeout(timer) }
  }, [orderId, paymentSuccess, tab, cardPending, qrCode])

  function formatCountdown(seconds: number) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  async function copyPix() {
    if (!qrCode?.payload) return
    try {
      await navigator.clipboard.writeText(qrCode.payload)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea")
      textarea.value = qrCode.payload
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  async function handleCardPayment() {
    console.log("[Card] handleCardPayment called")
    setCardError("")
    if (cardNumber.replace(/\s/g, "").length < 16) {
      setCardError("Número do cartão inválido")
      return
    }
    if (cardExpiry.length < 5) {
      setCardError("Data de validade inválida")
      return
    }
    if (cardCvv.length < 3) {
      setCardError("CVV inválido")
      return
    }
    if (!cardName.trim()) {
      setCardError("Nome do titular obrigatório")
      return
    }
    if (!cardEmail.trim() || !cardEmail.includes("@")) {
      setCardError("E-mail do titular obrigatório")
      return
    }

    setCardProcessing(true)
    try {
      const res = await fetch("/api/payments/asaas/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          creditCard: { number: cardNumber, expiry: cardExpiry, cvv: cardCvv },
          creditCardHolderInfo: {
            name: cardName,
            cpf: cardCpf,
            email: cardEmail,
            phone: cardPhone,
            cep: cardCep,
            number: cardAddressNum,
          },
        }),
      })
      const data = await res.json()
      console.log("[Card] Response:", JSON.stringify(data), "status:", res.status)
      if (!res.ok) {
        setCardError(data.error || `Erro ${res.status}`)
      } else if (data.status === "CONFIRMED" || data.status === "RECEIVED" || data.status === "AUTHORIZED") {
        console.log("[Card] Payment confirmed, calling onPaymentSuccess")
        setPaymentSuccess(true)
        onPaymentSuccess?.()
      } else if (data.error) {
        setCardError(data.error)
      } else {
        setCardPending(true)
        setCardError("")
      }
    } catch (e: any) {
      console.error("[Card] Catch error:", e?.name, e?.message, e)
      setCardError(`Erro: ${e?.message || "desconhecido"}`)
    } finally {
      setCardProcessing(false)
    }
  }

  function formatCardNumber(value: string) {
    const v = value.replace(/\D/g, "").slice(0, 16)
    return v.replace(/(\d{4})(?=\d)/g, "$1 ")
  }

  function formatExpiry(value: string) {
    const v = value.replace(/\D/g, "").slice(0, 4)
    if (v.length >= 3) return `${v.slice(0, 2)}/${v.slice(2)}`
    return v
  }

  // Auto-close after payment success
  const [autoCloseCountdown, setAutoCloseCountdown] = useState(3)

  useEffect(() => {
    if (!paymentSuccess) return
    // Play success sound
    try {
      const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVggoKIeGBGPmmNk4+FYkA3a46UjH5hQz5ujpSPgGFDPnCOlY+AYkU/cY6WkH9hREBxjpaRf2JEQXKOmJF+YkVCco6Yk39iRUJyjpmUf2JGRHOQm5Z/Y0ZFc5Ccl39kR0Z0kZ2Yf2RHSHeTn5p/ZUhId5Ofmn9lSEh4lJ+cf2ZKSnqYk59/aE1MfJyWoX9rUU5/n5ijf25STn+gmKR/cFJOf6GZpH9wUk5/oZmkf3BSTn+hmaR/cVJOf6GZpH9yVE9/opqkf3JUT3+imqR/clRPf6KapH9zVE9/opqkf3RUT3+imqR/dVRPf6KapH92VE9/opqkf3dUT3+imqR/eVRPf6OapH96VE9/pJqkf3tUT3+kmqR/e1RPf6SapH98VE9/pZqkf31UT3+mmqR/fVRPf6aapH9+VE9/p5qkf39UT3+nmqR/gFRPf6iapH+BVE9/qpqkf4JUT3+rmqR/g1RPf6uapH+EVU9/rJqkf4VVT3+tmqR/hlVPf62apH+HWU9/rpqkf4dZT3+vmqR/iFlPf7GapH+IWU9/sZqkf4lZT3+xmqR/illPf7KapH+KWU9/s5qkf4tZT3+0mqR/jFlPf7SapH+NWU9/tZqkf45ZT3+2mqR/j1lPf7eapH+QWU9/t5qkf5FZT3+4mqR/klm2tbe0uLy6u7u5trKvrLW3ubu9vr68ubSzsrO2ubu9vr69vLm0srKztrm7vb6+vr28ubSxsbK1ubu9vr69vbm0sbGytbm7vb6+vb25tLGxsrW5u72+vr29ubSxsbK1ubu9vr69vbm0sbGytbm7vb6+vb25tLGxsrW5u72+vr29ubSxsbK1ubu9vr69vbm0sQ==")
      audio.play()
    } catch {}
    // Vibrate
    if ("vibrate" in navigator) navigator.vibrate([200, 100, 200])

    const timer = setInterval(() => {
      setAutoCloseCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          handleClose()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [paymentSuccess])

  if (paymentSuccess) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="rounded-2xl p-8 text-center shadow-2xl" style={{ width: "min(400px, 95vw)", backgroundColor: theme.bgCard }}>
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 animate-bounce">
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-green-400">Pagamento confirmado!</h2>
          <p className="mt-2 text-sm" style={{ color: theme.textMuted }}>Seu pedido foi pago com sucesso.</p>
          <div className="mt-4 rounded-lg bg-green-500/10 p-3">
            <p className="text-sm font-medium text-green-400">Pedido confirmado e sendo preparado!</p>
          </div>
          <p className="mt-3 text-xs" style={{ color: theme.textMuted }}>
            Fechando automaticamente em <span className="font-bold">{autoCloseCountdown}s</span>
          </p>
          <button
            onClick={handleClose}
            className="mt-4 w-full rounded-xl py-3 text-sm font-semibold text-white"
            style={{ backgroundColor: theme.primary }}
          >
            Acompanhar pedido
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="relative flex flex-col rounded-2xl overflow-hidden shadow-2xl max-h-[90vh]"
        style={{ width: "min(480px, 95vw)", backgroundColor: theme.bgCard }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: theme.borderInput }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: theme.text }}>Pagamento</p>
            <p className="text-xs" style={{ color: theme.textMuted }}>Total: {formatCurrency(total)}</p>
          </div>
          <button onClick={handleClose} className="flex h-8 w-8 items-center justify-center rounded-full transition-colors" style={{ color: theme.textMuted }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs - only show when mode is not set */}
        {!mode && (
          <div className="flex border-b" style={{ borderColor: theme.borderInput }}>
            <button
              onClick={() => setTab("pix")}
              className="flex-1 py-3 text-sm font-medium transition-colors border-b-2"
              style={tab === "pix" ? { color: theme.primary, borderColor: theme.primary } : { color: theme.textMuted, borderColor: "transparent" }}
            >
              Pix
            </button>
            <button
              onClick={() => setTab("card")}
              className="flex-1 py-3 text-sm font-medium transition-colors border-b-2"
              style={tab === "card" ? { color: theme.primary, borderColor: theme.primary } : { color: theme.textMuted, borderColor: "transparent" }}
            >
              Cartão
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {(mode === "pix" || (!mode && tab === "pix")) ? (
            <div className="flex flex-col items-center">
              {qrLoading ? (
                <div className="py-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto" style={{ color: theme.primary }} />
                  <p className="mt-3 text-sm" style={{ color: theme.textMuted }}>Gerando QR Code...</p>
                </div>
              ) : qrError ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-red-400">{qrError}</p>
                  <button
                    onClick={() => { setTab("pix"); setQrLoading(true); setQrError("") }}
                    className="mt-3 text-sm hover:underline"
                    style={{ color: theme.primary }}
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : qrCode ? (
                <>
                  {countdown > 0 && (
                    <div className="mb-3 rounded-lg px-4 py-2 text-center" style={{ backgroundColor: theme.bgCardHover }}>
                      <p className="text-xs" style={{ color: theme.textMuted }}>
                        Expira em <span className="font-mono font-bold" style={{ color: countdown < 60 ? "#ef4444" : theme.primary }}>{formatCountdown(countdown)}</span>
                      </p>
                    </div>
                  )}
                  {countdown === 0 && (
                    <div className="mb-3 rounded-lg bg-amber-500/10 px-4 py-3 text-center">
                      <p className="text-sm font-medium text-amber-400">QR Code expirado</p>
                      <button
                        onClick={() => { setQrLoading(true); setQrError(""); setCountdown(0) }}
                        className="mt-2 text-sm hover:underline"
                        style={{ color: theme.primary }}
                      >
                        Gerar novo QR Code
                      </button>
                    </div>
                  )}
                  <img
                    src={`data:image/png;base64,${qrCode.image}`}
                    alt="QR Code Pix"
                    className="h-56 w-56 rounded-xl"
                    style={{ backgroundColor: "#ffffff", padding: 8 }}
                  />
                  <p className="mt-3 text-xs text-center" style={{ color: theme.textMuted }}>
                    Escaneie com o app do seu banco
                  </p>
                  <div className="mt-4 w-full">
                    <p className="text-xs mb-1.5" style={{ color: theme.textMuted }}>Ou copie o código Pix:</p>
                    <div className="flex gap-2">
                      <div
                        className="flex-1 rounded-lg px-3 py-2 text-xs truncate"
                        style={{ backgroundColor: theme.bgCardHover, color: theme.textMuted }}
                      >
                        {qrCode.payload?.substring(0, 40)}...
                      </div>
                      <button
                        onClick={copyPix}
                        className="rounded-lg px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 shrink-0"
                        style={{ backgroundColor: theme.primary }}
                      >
                        {copied ? "✓ Copiado" : "Copiar"}
                      </button>
                    </div>
                  </div>
                </>
              ) : invoiceUrl ? (
                <div className="flex flex-col items-center py-4">
                  <p className="text-sm mb-4 text-center" style={{ color: theme.textMuted }}>
                    Clique no botão abaixo para acessar a página de pagamento:
                  </p>
                  <a
                    href={invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: theme.primary }}
                  >
                    Pagar agora
                  </a>
                  <p className="mt-3 text-xs text-center" style={{ color: theme.textMuted }}>
                    Você será redirecionado para a página de pagamento do Asaas
                  </p>
                </div>
              ) : null}
            </div>
          ) : (mode === "card" || (!mode && tab === "card")) ? (
            cardPending ? (
              <div className="flex flex-col items-center py-8 relative">
                <button
                  onClick={onClose}
                  className="absolute top-0 right-0 flex h-8 w-8 items-center justify-center rounded-full transition-opacity hover:opacity-70"
                  style={{ color: theme.textMuted }}
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full animate-pulse" style={{ backgroundColor: `${theme.primary}15` }}>
                  <CreditCard className="h-8 w-8" style={{ color: theme.primary }} />
                </div>
                <h3 className="text-base font-semibold mb-1" style={{ color: theme.text }}>Aguardando pagamento</h3>
                <p className="text-sm text-center mb-4" style={{ color: theme.textMuted }}>
                  Processando seu pagamento com cartão...
                </p>
                <div className="flex items-center gap-2 mb-6">
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: theme.primary }} />
                  <p className="text-xs" style={{ color: theme.textMuted }}>Aguardando confirmação do Asaas</p>
                </div>
                <button
                  onClick={() => { setCardPending(false); setCardError("") }}
                  className="rounded-lg px-4 py-2 text-xs font-medium transition-opacity hover:opacity-80"
                  style={{ backgroundColor: `${theme.primary}15`, color: theme.primary, borderWidth: 1, borderStyle: "solid", borderColor: `${theme.primary}30` }}
                >
                  Tentar novamente
                </button>
              </div>
            ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs" style={{ color: theme.textMuted }}>Número do cartão</label>
                <input
                  placeholder="0000 0000 0000 0000"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  maxLength={19}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ backgroundColor: theme.bgCardHover, color: theme.text, borderWidth: 1, borderStyle: "solid", borderColor: theme.borderInput }}
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs" style={{ color: theme.textMuted }}>Validade</label>
                  <input
                    placeholder="MM/AA"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                    maxLength={5}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ backgroundColor: theme.bgCardHover, color: theme.text, borderWidth: 1, borderStyle: "solid", borderColor: theme.borderInput }}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs" style={{ color: theme.textMuted }}>CVV</label>
                  <input
                    placeholder="000"
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    maxLength={4}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ backgroundColor: theme.bgCardHover, color: theme.text, borderWidth: 1, borderStyle: "solid", borderColor: theme.borderInput }}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs" style={{ color: theme.textMuted }}>Nome no cartão</label>
                <input
                  placeholder="Como está impresso no cartão"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value.toUpperCase())}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ backgroundColor: theme.bgCardHover, color: theme.text, borderWidth: 1, borderStyle: "solid", borderColor: theme.borderInput }}
                />
              </div>
              <div>
                <label className="text-xs" style={{ color: theme.textMuted }}>CPF do titular</label>
                <input
                  placeholder="000.000.000-00"
                  value={cardCpf}
                  onChange={(e) => {
                    let v = e.target.value.replace(/\D/g, "").slice(0, 11)
                    if (v.length > 9) v = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`
                    else if (v.length > 6) v = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`
                    else if (v.length > 3) v = `${v.slice(0, 3)}.${v.slice(3)}`
                    setCardCpf(v)
                  }}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ backgroundColor: theme.bgCardHover, color: theme.text, borderWidth: 1, borderStyle: "solid", borderColor: theme.borderInput }}
                />
              </div>
              <div>
                <label className="text-xs" style={{ color: theme.textMuted }}>E-mail do titular</label>
                <input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={cardEmail}
                  onChange={(e) => setCardEmail(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ backgroundColor: theme.bgCardHover, color: theme.text, borderWidth: 1, borderStyle: "solid", borderColor: theme.borderInput }}
                />
              </div>
              {cardError && (
                <div className="rounded-lg bg-red-500/10 p-2 text-xs text-red-400 border border-red-500/20">{cardError}</div>
              )}
              <button
                onClick={handleCardPayment}
                disabled={cardProcessing}
                className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: theme.primary }}
              >
                {cardProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processando...
                  </span>
                ) : (
                  `Pagar ${formatCurrency(total)}`
                )}
              </button>
              <p className="text-[10px] text-center" style={{ color: theme.textMuted }}>
                Pagamento seguro processado por Asaas
              </p>
            </div>
            )
          ) : null}
        </div>
      </div>
    </div>
  )
}

function ProductCard({ product, onAdd, theme, disabled, isAdded }: { product: Product; onAdd: (p: Product) => void; theme: { primary: string; bgCard: string; bgCardHover: string; borderCard: string; borderCardHover: string; text: string; textMuted: string; shadowPrimary: string }; disabled?: boolean; isAdded?: boolean }) {
  return (
    <div className={`flex items-center gap-4 rounded-xl p-4 transition-all duration-300 backdrop-blur-sm ${disabled ? "opacity-50" : ""}`} style={{ backgroundColor: theme.bgCard, borderWidth: 1, borderStyle: "solid", borderColor: isAdded ? theme.primary : theme.borderCard }}>
      {product.image ? (
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className={`h-20 w-20 flex-shrink-0 rounded-xl object-cover transition-transform duration-300 ${isAdded ? "scale-105" : ""}`}
        />
      ) : (
        <div className={`flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl transition-transform duration-300 ${isAdded ? "scale-105" : ""}`} style={{ backgroundColor: theme.bgCardHover }}>
          <svg className="h-8 w-8" style={{ color: theme.textMuted }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold" style={{ color: theme.text }}>{product.name}</h3>
          <ProductBadge badge={product.badge} />
        </div>
        {product.description && (
          <p className="mt-0.5 text-sm line-clamp-2" style={{ color: theme.textMuted }}>{product.description}</p>
        )}
        <p className="mt-1 font-bold" style={{ color: theme.primary }}>{formatCurrency(product.price)}</p>
      </div>
      <button
        onClick={() => onAdd(product)}
        aria-label={`Adicionar ${product.name} ao carrinho`}
        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-white font-bold text-lg transition-all duration-200 active:scale-90 ${isAdded ? "animate-bounce-once" : ""}`}
        style={{
          backgroundColor: isAdded ? "#22c55e" : theme.primary,
          boxShadow: isAdded ? "0 0 25px rgba(34,197,94,0.5)" : `0 0 20px ${theme.shadowPrimary}`,
          transform: isAdded ? "scale(1.15)" : "scale(1)",
        }}
        disabled={disabled}
      >
        {isAdded ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        ) : (
          "+"
        )}
      </button>
    </div>
  )
}
