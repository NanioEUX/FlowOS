"use client"
import { PushHeal } from "@/components/pwa/push-heal"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Store, Minus, Plus, X, CreditCard, ExternalLink, Loader2, MessageCircle, ShoppingBag, CheckCircle, Banknote, User, Package, Store as StoreIcon, Bike, History, Search, Star, Sparkles, Tag, Send, Clock, MapPin, Sun, Moon, RefreshCw, Utensils, ClipboardList, Settings, Shield, ArrowLeft, Pencil, Check, Timer, Truck, Gift, Heart, Repeat, HelpCircle, ChevronRight, LogOut, Bell, Home, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { FlowOSLogo } from "@/components/flowos-logo"
import type { CartItem } from "@/types"
import { useToast } from "@/components/toast"
import { OrderConfirmationScreen } from "@/components/order-confirmation-screen"
import { OrdersScreen } from "@/components/orders-screen"
import { GeolocationButton, type DeliveryInfo } from "@/components/delivery/geolocation-button"
import { PushSubscribe } from "@/components/pwa/push-subscribe"
import { InstallButton } from "@/components/pwa/install-button"
import { InstallPromptToast } from "@/components/pwa/install-prompt-toast"

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  image: string | null
  badge: string | null
  additionalOptions?: any[]
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
  tierConfig: string | null
  firstPurchaseEnabled: boolean
  firstPurchaseDiscount: number | null
  firstPurchaseBonus: number
  pickupMessage: string | null
  deliveryMessage: string | null
  confirmationTitle: string | null
  confirmationImage: string | null
  closedTitle: string | null
  closedSub: string | null
  defaultTheme: string
  paymentProvider: string
  estimatedDeliveryMin: number
  estimatedDeliveryMax: number
}

interface CustomerData {
  id: string
  name: string | null
  phone: string
  email: string | null
  totalOrders: number
  totalSpent: number
  loyaltyPoints: number
  tier: string
  whatsappVerified?: boolean
  verifiedAt?: string | null
  realTotalSpent?: number
  realTotalOrders?: number
  cpf?: string | null
  birthDate?: string | null
}

interface Props {
  establishment: Establishment & { categories: Category[] }
  paymentConfig: { online: boolean; delivery: boolean; pickup: boolean }
  orderConfig: { delivery: boolean; pickup: boolean }
  minimumOrder: { enabled: boolean; value: number; applyToDelivery: boolean; applyToPickup: boolean }
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

function extractTrackingToken(trackingUrl: string | null | undefined): string {
  if (!trackingUrl) return ""
  const parts = trackingUrl.split("/")
  return parts[parts.length - 1] || ""
}

// Pedidos só podem ser cancelados pelo cliente enquanto ainda não foram
// aceitos pelo estabelecimento. Após "confirmed" (em preparo ou além), o
// cliente precisa solicitar cancelamento pelo chat.
function canCancelByCustomer(orderStatus: string | null | undefined): boolean {
  return orderStatus === "pending" || orderStatus === "payment_pending"
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

function getGreetingFromHour(hour: number): string {
  if (hour >= 5 && hour < 12) return "Bom dia"
  if (hour >= 12 && hour < 18) return "Boa tarde"
  return "Boa noite"
}

function pointsToCurrency(points: number, redeemPoints: number = 100, redeemDiscount: number = 10): number {
  if (!redeemPoints || !redeemDiscount) return 0
  return (points / redeemPoints) * redeemDiscount
}



export function MenuPage({ establishment, paymentConfig, orderConfig, minimumOrder }: Props) {
  const hasCustomColors = establishment.colorsPublished

  const { toast } = useToast()
  const [darkMode] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [greeting, setGreeting] = useState("Olá")

  useEffect(() => {
    setMounted(true)
    setGreeting(getGreetingFromHour(new Date().getHours()))
  }, [])

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
    const pc = ec.primaryColor || "#06B6D4"
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

  const [cart, setCart] = useState<CartItem[]>([])
  
  // Load cart from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`pedefacil-cart-${establishment.slug}`)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.length > 0) setCart(parsed)
      }
    } catch {}
  }, [establishment.slug])

  // Save cart to localStorage
  useEffect(() => {
    localStorage.setItem(`pedefacil-cart-${establishment.slug}`, JSON.stringify(cart))
  }, [cart, establishment.slug])

  const [addedItemId, setAddedItemId] = useState<string | null>(null)
  const [cartToast, setCartToast] = useState<{ name: string; image?: string } | null>(null)
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null)
  const [showCart, setShowCart] = useState(false)
  const [bottomSheetProduct, setBottomSheetProduct] = useState<Product | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedProductQty, setSelectedProductQty] = useState(1)
  const [selectedProductOptions, setSelectedProductOptions] = useState<{ name: string; price: number; quantity: number }[]>([])
  const [showBusinessHours, setShowBusinessHours] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [cartStep, setCartStep] = useState<"cart" | "payment" | "confirmation">("cart")
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [verifyStep, setVerifyStep] = useState<1 | 2>(1)
  const [verifyCode, setVerifyCode] = useState("")
  const [verifySending, setVerifySending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState("")
  const [verifyDevCode, setVerifyDevCode] = useState("")
  const [whatsappSent, setWhatsappSent] = useState(false)
  const [whatsappError, setWhatsappError] = useState("")
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([])
  const verifyCodeAutoSentRef = useRef(false)
  // Garante que a aplicação do login aconteça UMA
  // vez por verificação, mesmo com múltiplos handlers (storage/BroadcastChannel,
  // focus, polling) detectando a mesma validação ao mesmo tempo.
  const verifyAppliedRef = useRef(false)
  const [showFirstPurchaseBonus, setShowFirstPurchaseBonus] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<"online" | "delivery" | "pickup" | "pix" | "card">("pix")
  const [cashSubMethod, setCashSubMethod] = useState<"cash" | "card" | null>(null)
  const [changeFor, setChangeFor] = useState<string>("")
  const [orderType, setOrderType] = useState<"delivery" | "pickup">("delivery")
  const [geoDeliveryInfo, setGeoDeliveryInfo] = useState<DeliveryInfo | null>(null)
  const [ordering, setOrdering] = useState(false)
  const [orderResult, setOrderResult] = useState<{ success: boolean; trackingUrl?: string; paymentLink?: string; paymentError?: string; message?: string; orderId?: string; orderNumber?: number; orderType?: string; paymentMethod?: string; orderTotal?: number; paymentDone?: boolean; deliveryCode?: string | null } | null>(null)
  const [showTracking, setShowTracking] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const userClosedPaymentModalRef = useRef(false)

  // Stories data
  const [storiesData, setStoriesData] = useState<{ stories: any[]; combos: any[] }>({ stories: [], combos: [] })
  const [bannersData, setBannersData] = useState<any[]>([])
  const [activeStory, setActiveStory] = useState<string | null>(null)
  const [storyProducts, setStoryProducts] = useState<any[]>([])
  const [storyCombos, setStoryCombos] = useState<any[]>([])
  const [bannerSlide, setBannerSlide] = useState(0)
  const [destaqueSlide, setDestaqueSlide] = useState(0)

  // Auto-scroll ref for compact promo cards
  const promoScrollRef = useRef<HTMLDivElement>(null)
  const bannerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  // Featured products (3 seções: trending/new/promo) - substitui stories
  const [featuredSections, setFeaturedSections] = useState<{
    trending: Array<{ id: string; name: string; price: number; originalPrice: number | null; image: string | null; badge: string | null; onSale: boolean; hasOptions: boolean }>
    new: Array<{ id: string; name: string; price: number; originalPrice: number | null; image: string | null; badge: string | null; onSale: boolean; hasOptions: boolean }>
    promo: Array<{ id: string; name: string; price: number; originalPrice: number | null; image: string | null; badge: string | null; onSale: boolean; hasOptions: boolean }>
  }>({ trending: [], new: [], promo: [] })
  const [featuredTab, setFeaturedTab] = useState<"promo" | "trending" | "lastOrder">("promo")
  const [featuredTabInitialized, setFeaturedTabInitialized] = useState(false)
  const [trackingOrder, setTrackingOrder] = useState<any>(null)
  const [trackingMessages, setTrackingMessages] = useState<any[]>([])
  const [trackingInput, setTrackingInput] = useState("")
  const [trackingSending, setTrackingSending] = useState(false)
  const [statusAlert, setStatusAlert] = useState<string | null>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const trackingEndRef = useRef<HTMLDivElement>(null)
  const prevStatusRef = useRef<string | null>(null)
  const prevOrderStatusesRef = useRef<Record<string, string>>({})
  const [cancelModalOrderId, setCancelModalOrderId] = useState<string | null>(null)
  const [cancelModalTotal, setCancelModalTotal] = useState<number>(0)
  const [cancelReason, setCancelReason] = useState<string>("")
  const [cancelling, setCancelling] = useState(false)
  const [customer, setCustomer] = useState<{ name: string; phone: string; address: string; notes: string; cep?: string; cpf?: string; birthDate?: string; email?: string }>({ name: "", phone: "", address: "", notes: "" })
  const [addresses, setAddresses] = useState<{ id: string; label?: string; street: string; number: string; neighborhood?: string; city: string; state: string; cep: string; complement?: string; isDefault: boolean }[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)

  const [lastOrder, setLastOrder] = useState<{ orderId: string; trackingUrl: string; paymentLink?: string; paymentMethod?: string; total?: number; paymentDone?: boolean; orderNumber?: number; items?: CartItem[] } | null>(null)
  const [hasEstablishmentReply, setHasEstablishmentReply] = useState(false)
  const prevMsgCountRef = useRef(0)
  const trackingTokenRef = useRef<string>("")
  const [showOrdersList, setShowOrdersList] = useState(false)
  const [customerOrders, setCustomerOrders] = useState<any[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [pushNotification, setPushNotification] = useState<{ title: string; body: string; url: string } | null>(null)
  const [showCustomerProfile, setShowCustomerProfile] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [expandedProfileItem, setExpandedProfileItem] = useState<string | null>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [cpfLookupLoading, setCpfLookupLoading] = useState(false)
  const [cpfError, setCpfError] = useState("")

  // Notifications
  const [notifications, setNotifications] = useState<{ id: string; type: string; title: string; message: string; read: boolean; createdAt: string }[]>([])
  const [showNotifDropdown, setShowNotifDropdown] = useState(false)
  // Saved cart data for confirmation screen (cart is cleared after order)
  const [confirmationItems, setConfirmationItems] = useState<CartItem[]>([])
  const [confirmationSubtotal, setConfirmationSubtotal] = useState(0)

  useEffect(() => {
    const saved = localStorage.getItem(`pedefacil-customer-${establishment.slug}`)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setCustomer({ ...parsed, phone: String(parsed.phone || "").replace(/\D/g, "").slice(0, 11) })
        if (parsed.phone) {
          const digits = String(parsed.phone).replace(/\D/g, "").slice(0, 11)
          let formatted = digits
          if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`
          if (digits.length > 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
          setPhoneInput(formatted)
        }
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
        if (parsed.orderId && parsed.trackingUrl && parsed.timestamp > Date.now() - 604800000) {
          setLastOrder(parsed)
          // Busca itens via API se estiverem faltando (pedidos antigos salvos sem items)
          if (!parsed.items || parsed.items.length === 0) {
            const token = parsed.trackingUrl.split("/pedido/")[1]
            if (token) {
              fetch(`/api/orders/${parsed.orderId}?token=${token}`)
                .then(r => r.json())
                .then(data => {
                  if (data.items) {
                    let orderItems: any[] = []
                    try { orderItems = typeof data.items === "string" ? JSON.parse(data.items) : data.items } catch {}
                    if (orderItems.length > 0) {
                      setLastOrder((prev) => {
                        if (prev && prev.orderId === parsed.orderId) {
                          const updated = { orderId: prev.orderId, trackingUrl: prev.trackingUrl, paymentLink: prev.paymentLink || "", paymentMethod: prev.paymentMethod || "", total: prev.total || 0, paymentDone: prev.paymentDone || false, orderNumber: prev.orderNumber || 0, items: orderItems as any }
                          localStorage.setItem(`pedefacil-last-order-${establishment.slug}`, JSON.stringify(updated))
                          return updated
                        }
                        return prev
                      })
                    }
                  }
                })
                .catch(() => {})
            }
          }
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
    fetch(`/api/orders/${capturedOrderId}/payment-status?token=${extractTrackingToken(lastOrder.trackingUrl)}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (data.paymentStatus === "paid" && lastOrderIdRef.current === capturedOrderId) {
          setLastOrder(prev => prev ? { ...prev, paymentDone: true } : null)
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

  async function sendVerificationCode() {
    const phoneDigits = (customer.phone || phoneInput).replace(/\D/g, "")
    if (phoneDigits.length < 10) {
      setVerifyError("Telefone inválido")
      return
    }
    const finalName = customer.name || customerData?.name || ""
    setVerifySending(true)
    setVerifyError("")
    setVerifyDevCode("")
    setWhatsappSent(false)
    setWhatsappError("")
    verifyAppliedRef.current = false
    try {
      const res = await fetch("/api/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneDigits,
          establishmentId: establishment.id,
          name: finalName || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao enviar código")
      if (data.whatsappSent) {
        setWhatsappSent(true)
      } else if (data.devCode) {
        setVerifyDevCode(data.devCode)
        setWhatsappError(data.whatsappError || "WhatsApp não configurado ou falhou")
      }
    } catch (e: any) {
      setVerifyError(e.message)
    } finally {
      setVerifySending(false)
    }
  }

  async function submitVerifyCode() {
    const phoneDigits = (customer.phone || phoneInput).replace(/\D/g, "")
    if (!verifyCode.trim() || verifyCode.length < 4) {
      setVerifyError("Digite o código recebido")
      return
    }
    setVerifying(true)
    setVerifyError("")
    try {
      const res = await fetch("/api/verification", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneDigits, establishmentId: establishment.id, code: verifyCode.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Código incorreto")
      // Refresh customer data
      const refreshed = await fetch(`/api/customers?phone=${phoneDigits}&establishmentId=${establishment.id}`)
      const refreshedData = await refreshed.json()
      if (refreshedData && !refreshedData.notFound) {
        setCustomerData(refreshedData)
      }
      setShowVerifyModal(false)
      setShowIdentifyModal(false)
      setVerifyStep(1)
      setVerifyCode("")
      setWhatsappSent(false)
      setVerifyDevCode("")
      applyLocalVerified(phoneDigits)
      markSessionVerified()
    } catch (e: any) {
      setVerifyError(e.message)
    } finally {
      setVerifying(false)
    }
  }

  // Flag de verificação de sessão: só é criado quando a verificação é
  // completada (código OU link). Fechar a página não desloga; só o logout
  // explícito apaga esse flag e exige nova verificação.
  const markSessionVerified = () => {
    setSessionVerified(true)
    try { localStorage.setItem(SESSION_KEY, "1") } catch {}
    // Show first purchase bonus screen if eligible
    if (isFirstPurchase && ((establishment.firstPurchaseDiscount || 0) > 0 || establishment.firstPurchaseBonus > 0)) {
      setShowFirstPurchaseBonus(true)
    }
  }
  const clearSessionVerified = () => {
    setSessionVerified(false)
    try { localStorage.removeItem(SESSION_KEY) } catch {}
    verifyAppliedRef.current = false
    markVerifySessionStart()
  }

  // Marca o momento em que a sessão atual (sem login) começou. O auto-login
  // via servidor só é aplicado se a verificação (verifiedAt) aconteceu DEPOIS
  // desse momento — assim, depois do logout (que redefine este marcador), o
  // verifiedAt antigo não loga o usuário de volta sozinho.
  const markVerifySessionStart = () => {
    try { localStorage.setItem(`flowos-verify-session-start-${establishment.slug}`, String(Date.now())) } catch {}
  }
  const getVerifySessionStart = (): number => {
    try {
      return parseInt(localStorage.getItem(`flowos-verify-session-start-${establishment.slug}`) || "0", 10) || 0
    } catch {
      return 0
    }
  }

  useEffect(() => {
    try {
      if (localStorage.getItem(SESSION_KEY) === "1") setSessionVerified(true)
      else {
        // Só redefine o sessionStart se não existir ou for antigo (> 30 min).
        // Se a PWA recarregar no meio do fluxo de verificação (iOS mata a PWA
        // em background), preserva o sessionStart para que o verifiedAt do
        // link (que pode ser anterior a este mount) ainda seja detectado.
        const existing = getVerifySessionStart()
        if (!existing || Date.now() - existing > 30 * 60 * 1000) markVerifySessionStart()
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establishment.slug])

  async function applyLocalVerified(phoneDigits: string) {
    try {
      const res = await fetch(`/api/customers?phone=${phoneDigits}&establishmentId=${establishment.id}&_=${Date.now()}`, { cache: "no-store" })
      const data = await res.json()
      console.log("[applyLocalVerified] phone:", phoneDigits, "loyaltyPoints:", data?.loyaltyPoints, "tier:", data?.tier, "notFound:", data?.notFound)
      if (data && !data.notFound) {
        setCustomerData(data)
        setCustomerLoyaltyPoints(data.loyaltyPoints || 0)
        setCustomerTier(data.tier || "bronze")
        setCustomer((prev) => ({
          ...prev,
          name: data.name || prev.name,
          address: data.address || prev.address,
          cpf: data.cpf || prev.cpf,
        }))
      } else {
        console.warn("[applyLocalVerified] Customer not found for phone:", phoneDigits)
      }
    } catch (err: any) {
      console.error("[applyLocalVerified] FAILED to re-sync customer:", phoneDigits, err?.message || err)
    }
  }

  function handleOtpChange(index: number, value: string) {
    const digits = value.replace(/\D/g, "")
    if (digits) {
      const next = verifyCode.slice(0, index) + digits.slice(-1) + verifyCode.slice(index + 1)
      setVerifyCode(next)
      if (index < 5) otpInputsRef.current[index + 1]?.focus()
    } else {
      setVerifyCode(verifyCode.slice(0, index) + verifyCode.slice(index + 1))
      if (index > 0) otpInputsRef.current[index - 1]?.focus()
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !verifyCode[index] && index > 0) {
      setVerifyCode(verifyCode.slice(0, index - 1) + verifyCode.slice(index))
      otpInputsRef.current[index - 1]?.focus()
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    if (pasted) {
      setVerifyCode(pasted)
      const focusIndex = Math.min(pasted.length, 5)
      otpInputsRef.current[focusIndex]?.focus()
    }
  }

  async function pasteVerifyCode() {
    // Foca no campo OTP primeiro: no iOS/Android isso faz o teclado mostrar a
    // sugestão nativa "Colar" (cola sem pedir permissão). Em seguida tenta ler
    // o clipboard via API — na primeira vez o sistema pede permissão, depois
    // cola direto.
    otpInputsRef.current[0]?.focus()
    try {
      const text = await navigator.clipboard.readText()
      const digits = text.replace(/\D/g, "").slice(0, 6)
      if (digits) {
        setVerifyCode(digits)
        setVerifyError("")
        const focusIndex = Math.min(digits.length, 5)
        otpInputsRef.current[focusIndex]?.focus()
      } else {
        setVerifyError("Nenhum código encontrado. Toque e segure no campo para colar.")
      }
    } catch {
      setVerifyError("Toque e segure no campo e escolha Colar para preencher o código.")
    }
  }

  const [cep, setCep] = useState("")
  const [cepAddress, setCepAddress] = useState<any>(null)
  const [cepLoading, setCepLoading] = useState(false)
  const [editingAddress, setEditingAddress] = useState(false)
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [showPaymentAddressPicker, setShowPaymentAddressPicker] = useState(false)
  const [addressForm, setAddressForm] = useState({ label: "", street: "", number: "", neighborhood: "", city: "", state: "", cep: "", complement: "" })
  const [addressFormLoading, setAddressFormLoading] = useState(false)
  const [addressFormError, setAddressFormError] = useState("")
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
  const [pendingOrderModal, setPendingOrderModal] = useState<{ orderId: string; orderNumber: number; total: number; paymentLink: string; paymentMethod?: string; status?: string } | null>(null)
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
    if (!mounted) return true
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
  }, [parsedBusinessHours, mounted])

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

  const parsedTierConfig = useMemo(() => {
    try {
      return establishment.tierConfig ? JSON.parse(establishment.tierConfig) : null
    } catch { return null }
  }, [establishment.tierConfig])

  const [useLoyalty, setUseLoyalty] = useState(false)
  const [customerLoyaltyPoints, setCustomerLoyaltyPoints] = useState(0)
  const [customerTier, setCustomerTier] = useState("bronze")

  // Calculate tier multiplier
  const tierMultiplier = useMemo(() => {
    if (!parsedTierConfig?.enabled) return 1
    const tiers = parsedTierConfig.tiers || []
    const tier = tiers.find((t: any) => t.name?.toLowerCase() === customerTier)
    return tier?.multiplier || 1
  }, [parsedTierConfig, customerTier])

  useEffect(() => {
    if (customer.name || customer.phone) {
      localStorage.setItem(`pedefacil-customer-${establishment.slug}`, JSON.stringify({ ...customer, cep }))
    }
  }, [customer, cep])
  const [couponLoading, setCouponLoading] = useState(false)

  // Tab & search
  const [activeCategory, setActiveCategory] = useState<string>("all")
  const [visibleCategoryId, setVisibleCategoryId] = useState<string>("all")
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

  const getCategoryEmoji = (name: string): string => {
    const lower = name.toLowerCase()
    if (lower.includes("pizza")) return "🍕"
    if (lower.includes("hambúrguer") || lower.includes("burger") || lower.includes("lanches")) return "🍔"
    if (lower.includes("bebida") || lower.includes("drink")) return "🥤"
    if (lower.includes("sobremesa") || lower.includes("doce")) return "🍰"
    if (lower.includes("acompanhamento") || lower.includes("batata")) return "🍟"
    if (lower.includes("combo")) return "🎁"
    if (lower.includes("promoção") || lower.includes("oferta")) return "💰"
    if (lower.includes("porção")) return "🍽️"
    if (lower.includes("massa")) return "🍝"
    if (lower.includes("salada")) return "🥗"
    if (lower.includes("sorvete") || lower.includes("gelado")) return "🍦"
    if (lower.includes("café")) return "☕"
    if (lower.includes("suco")) return "🧃"
    if (lower.includes("cerveja") || lower.includes("álcool")) return "🍺"
    if (lower.includes("molho")) return "🫙"
    if (lower.includes("ingrediente") || lower.includes("insumo")) return "📦"
    return "🍽️"
  }

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
      setActiveCategory("all")
    }
  }, [sortedCategories])

  // Scroll spy: observa qual categoria está visível e atualiza o highlight
  useEffect(() => {
    if (typeof window === "undefined") return
    const sections = sortedCategories
      .map((cat) => document.getElementById(`cat-${cat.id}`))
      .filter(Boolean) as HTMLElement[]
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          const id = visible[0].target.id.replace("cat-", "")
          setVisibleCategoryId(id)
        }
      },
      { rootMargin: "-92px 0px -40% 0px", threshold: [0, 0.3] }
    )

    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [sortedCategories])

  // Fetch stories + featured data
  const loadStories = useCallback(async () => {
    try {
      const [storiesRes, bannersRes, featuredRes] = await Promise.all([
        fetch(`/api/stories?establishmentId=${establishment.id}`),
        fetch(`/api/banners?establishmentId=${establishment.id}`),
        fetch(`/api/products/featured?establishmentId=${establishment.id}`),
      ])
      if (storiesRes.ok) {
        const data = await storiesRes.json()
        setStoriesData(data)
      }
      if (bannersRes.ok) {
        const data = await bannersRes.json()
        setBannersData(data)
      }
      if (featuredRes.ok) {
        const data = await featuredRes.json()
        setFeaturedSections(data.sections || { trending: [], new: [], promo: [] })
      }
    } catch {}
  }, [establishment.id])

  useEffect(() => {
    loadStories()
  }, [loadStories])

  // Refresh featured data when user returns to the tab (admin may have changed)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadStories()
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [loadStories])

  // Banner carousel auto-advance
  useEffect(() => {
    if (bannersData.length <= 1) return
    bannerIntervalRef.current = setInterval(() => {
      setBannerSlide((prev) => (prev + 1) % bannersData.length)
    }, 4000)
    return () => { if (bannerIntervalRef.current) clearInterval(bannerIntervalRef.current) }
  }, [bannersData.length])

  // Destaques carousel auto-advance
  const destaqueIntervalRef = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    if (featuredSections.trending.length <= 1) return
    destaqueIntervalRef.current = setInterval(() => {
      setDestaqueSlide((prev) => (prev + 1) % featuredSections.trending.length)
    }, 4000)
    return () => { if (destaqueIntervalRef.current) clearInterval(destaqueIntervalRef.current) }
  }, [featuredSections.trending.length])

  // Promo compact cards auto-scroll (cross-tab loop)
  const promoAutoScrollRef = useRef<NodeJS.Timeout | null>(null)
  const userInteractingRef = useRef(false)
  useEffect(() => {
    const el = promoScrollRef.current
    if (!el) return
    const tabOrder: Array<"promo" | "trending" | "lastOrder"> = [
      ...(featuredSections.promo.length > 0 ? ["promo" as const] : []),
      ...(featuredSections.trending.length > 0 ? ["trending" as const] : []),
      ...(lastOrder?.items && lastOrder.items.length > 0 ? ["lastOrder" as const] : []),
    ]
    if (tabOrder.length === 0) return
    let tabIdx = tabOrder.indexOf(featuredTab) >= 0 ? tabOrder.indexOf(featuredTab) : 0
    if (promoAutoScrollRef.current) clearInterval(promoAutoScrollRef.current)
    promoAutoScrollRef.current = setInterval(() => {
      if (userInteractingRef.current) return
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 10
      if (atEnd) {
        tabIdx = (tabIdx + 1) % tabOrder.length
        setFeaturedTab(tabOrder[tabIdx])
        el.scrollTo({ left: 0 })
      } else {
        el.scrollBy({ left: 233, behavior: "smooth" })
      }
    }, 3000)
    return () => { if (promoAutoScrollRef.current) clearInterval(promoAutoScrollRef.current) }
  }, [featuredTab, featuredSections.promo.length, featuredSections.trending.length, lastOrder?.items?.length])

  // Auto-select first available tab
  useEffect(() => {
    if (featuredTabInitialized) return
    if (featuredSections.promo.length > 0) { setFeaturedTab("promo"); setFeaturedTabInitialized(true) }
    else if (featuredSections.trending.length > 0) { setFeaturedTab("trending"); setFeaturedTabInitialized(true) }
    else if (lastOrder?.items && lastOrder.items.length > 0) { setFeaturedTab("lastOrder"); setFeaturedTabInitialized(true) }
  }, [featuredSections.promo.length, featuredSections.trending.length, lastOrder?.items, featuredTabInitialized])

  const openStory = (storyId: string) => {
    const story = storiesData.stories.find((s: any) => s.id === storyId)
    if (!story) return
    setActiveStory(storyId)
    setStoryCombos([])
    if (story.products) setStoryProducts(story.products)
    else setStoryProducts([])
  }

  // Use selected address from new system, fallback to old system
  const selectedAddr = addresses.find(a => a.id === selectedAddressId)
  const fullAddress = selectedAddr
    ? `${selectedAddr.street}, ${selectedAddr.number}${selectedAddr.neighborhood ? ` - ${selectedAddr.neighborhood}` : ``}, ${selectedAddr.city} - ${selectedAddr.state}`
    : cepAddress
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

  // Address management
  async function fetchAddresses(customerId: string) {
    try {
      const res = await fetch(`/api/addresses?customerId=${customerId}&establishmentId=${establishment.id}`)
      const data = await res.json()
      if (data.addresses) {
        setAddresses(data.addresses)
        // Auto-select default or first
        const defaultAddr = data.addresses.find((a: any) => a.isDefault) || data.addresses[0]
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id)
        }
      }
    } catch { }
  }

  async function deleteAddress(addressId: string) {
    if (!customerData?.id) return
    try {
      await fetch(`/api/addresses?id=${addressId}&customerId=${customerData.id}&establishmentId=${establishment.id}`, { method: "DELETE" })
      await fetchAddresses(customerData.id)
    } catch { }
  }

  async function saveNewAddress() {
    if (!customerData?.id) return
    setAddressFormLoading(true)
    setAddressFormError("")
    try {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerData.id,
          establishmentId: establishment.id,
          label: addressForm.label || null,
          street: addressForm.street,
          number: addressForm.number,
          neighborhood: addressForm.neighborhood || null,
          city: addressForm.city,
          state: addressForm.state,
          cep: addressForm.cep,
          complement: addressForm.complement || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAddressFormError(data.error || "Erro ao salvar endereço")
        return
      }
      await fetchAddresses(customerData.id)
      setShowAddressForm(false)
      setAddressForm({ label: "", street: "", number: "", neighborhood: "", city: "", state: "", cep: "", complement: "" })
    } catch {
      setAddressFormError("Erro ao salvar endereço")
    } finally {
      setAddressFormLoading(false)
    }
  }

  async function lookupAddressCep() {
    if (addressForm.cep.length !== 8) return
    setAddressFormLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${addressForm.cep}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setAddressForm(prev => ({
          ...prev,
          street: data.logradouro || "",
          neighborhood: data.bairro || "",
          city: data.localidade || "",
          state: data.uf || "",
        }))
      }
    } catch { } finally {
      setAddressFormLoading(false)
    }
  }

  const [identifying, setIdentifying] = useState(false)
  const [customerData, setCustomerData] = useState<CustomerData | null>(null)
  const [phoneInput, setPhoneInput] = useState("")
  const [sessionVerified, setSessionVerified] = useState(false)
  const SESSION_KEY = `flowos-session-verified-${establishment.slug}`

  // First purchase discount
  const isFirstPurchase = useMemo(() => {
    if (!establishment.firstPurchaseEnabled) return false
    if (!customerData?.whatsappVerified) return false
    // totalOrders === 0 means first order
    return (customerData.totalOrders || 0) === 0
  }, [establishment.firstPurchaseEnabled, customerData?.whatsappVerified, customerData?.totalOrders])

  const firstPurchaseDiscountValue = useMemo(() => {
    if (!isFirstPurchase) return 0
    return establishment.firstPurchaseDiscount || 0
  }, [isFirstPurchase, establishment.firstPurchaseDiscount])

  // Quando há pedido pendente (Pix), usa os items do pedido salvo em
  // pendingOrderItems. Caso contrário, usa o cart normal.
  const displayItems = pendingOrderNumber ? pendingOrderItems : cart
  const subtotal = displayItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const totalItems = displayItems.reduce((sum, item) => sum + item.quantity, 0)

  const loyaltyDiscount = useMemo(() => {
    const _debug = { useLoyalty, enabled: parsedLoyalty?.enabled, pts: customerLoyaltyPoints, subtotal, config: parsedLoyalty }
    if (!useLoyalty || !parsedLoyalty?.enabled || !customerLoyaltyPoints) { console.log("[loyaltyDiscount] BLOCKED (first guard):", _debug); return 0 }
    const pointsNeeded = parsedLoyalty.redeemPoints || 100
    if (parsedLoyalty.redeemType === "product") {
      return customerLoyaltyPoints >= pointsNeeded ? 0 : 0
    }
    const discount = parsedLoyalty.redeemDiscount || 10
    if (customerLoyaltyPoints < pointsNeeded) { console.log("[loyaltyDiscount] BLOCKED (points < needed):", _debug, { pointsNeeded }); return 0 }

    const minOrder = parsedLoyalty.minOrderToRedeem || 0
    if (minOrder > 0 && subtotal < minOrder) { console.log("[loyaltyDiscount] BLOCKED (below min):", _debug, { minOrder }); return 0 }

    const limitType = parsedLoyalty.redeemLimitType || "percentage"
    const limitValue = parsedLoyalty.redeemLimitValue || 30
    let maxDiscount = discount

    if (limitType === "percentage") {
      maxDiscount = (subtotal * limitValue) / 100
    } else {
      maxDiscount = limitValue
    }

    const result = Math.min(discount, maxDiscount)
    console.log("[loyaltyDiscount] RESULT:", { result, discount, maxDiscount, ..._debug })
    return result
  }, [useLoyalty, parsedLoyalty, customerLoyaltyPoints, subtotal])

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
  // Status real do pedido pendente para decidir se o botão "Cancelar" aparece.
  // customerOrders filtra pedidos pending no pagamento online, então pode estar
  // desatualizado; usamos o que estiver em memória (lastOrder/pendingOrderItems).
  // Se nenhum dos dois, assumimos "pending" (caminho normal).
  const pendingOrderLiveStatus: string | null = (() => {
    if (!pendingOrderNumber) return null
    const sameOrder = customerOrders.find((o: any) => o.orderNumber === pendingOrderNumber)
    return sameOrder?.status || "pending"
  })()
  const canCancelPending = canCancelByCustomer(pendingOrderLiveStatus) || pendingOrderLiveStatus === null
  const activeOrdersCount = customerOrders.filter((o: any) => ["pending", "confirmed", "preparing", "ready", "out_for_delivery"].includes(o.status)).length

  // Load customer orders on mount when phone is available
  useEffect(() => {
    const phone = customer.phone || customerData?.phone
    if (!phone) return
    loadCustomerOrders()
  }, [customer.phone, customerData?.phone, establishment.id])

  function calcDeliveryFee(): number {
    if (orderType !== "delivery") return 0
    // Se tem info de geolocalização calculada, usa ela
    if (geoDeliveryInfo?.available) {
      const fee = geoDeliveryInfo.fee || 0
      const freeAbove = geoDeliveryInfo.freeAbove
      if (freeAbove && subtotal >= freeAbove) return 0
      return fee
    }
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

  const total = subtotal + deliveryFee - couponDiscount - loyaltyDiscount - firstPurchaseDiscountValue - (loyaltyFreeProduct ? loyaltyFreeProduct.price : 0)

  const isBelowMinimum = minimumOrder.enabled && subtotal > 0 && (
    (orderType === "delivery" && minimumOrder.applyToDelivery && subtotal < minimumOrder.value) ||
    (orderType === "pickup" && minimumOrder.applyToPickup && subtotal < minimumOrder.value)
  )

  useEffect(() => {
    const raw = phoneInput.replace(/\D/g, "")
    if (raw.length < 11) {
      setCustomerData(null)
      return
    }
    const timer = setTimeout(async () => {
      setIdentifying(true)
      try {
        // Force fresh fetch (bust cache) to ensure stale customerData isn't used
        const res = await fetch(`/api/customers?phone=${raw}&establishmentId=${establishment.id}&_=${Date.now()}`, {
          cache: "no-store",
        })
        const data = await res.json()
        if (data && !data.notFound) {
          setCustomerData(data)
          setCustomer((prev) => ({ ...prev, name: data.name || prev.name, address: data.address || prev.address, cpf: data.cpf || prev.cpf, birthDate: data.birthDate || prev.birthDate }))
          setCustomerLoyaltyPoints(data.loyaltyPoints || 0)
          setCustomerTier(data.tier || "bronze")
          if (data.cep && data.address) {
            setAddressSaved(true)
          }
          // Pre-fill CEP - the useEffect([cep, orderType]) will handle the ViaCEP lookup
          if (data.cep) {
            setCep(data.cep)
          }
          // Fetch saved addresses
          fetchAddresses(data.id)
        } else {
          setCustomerData(null)
          // Reset verified state too — customer deleted or never existed
          setCustomerLoyaltyPoints(0)
          setCustomerTier("bronze")
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
  // Pagamento na entrega/retirada: gera um botão "Pagar na Entrega/Retirada"
  // que expande em dois sub-botões (Dinheiro / Cartão) e, no caso de dinheiro,
  // mostra um campo para informar o valor que o cliente vai entregar.
  if (paymentConfig.delivery && orderType === "delivery") availablePayments.push({ key: "delivery", label: "Pagar na Entrega", icon: <Banknote className="h-5 w-5" /> })
  if (paymentConfig.pickup && orderType === "pickup") availablePayments.push({ key: "pickup", label: "Pagar na Retirada", icon: <Banknote className="h-5 w-5" /> })

  if (availablePayments.length > 0 && !availablePayments.find(p => p.key === paymentMethod)) {
    setPaymentMethod(availablePayments[0].key as any)
  }

  function openCart() {
    if (!customer.phone || !customer.name || !sessionVerified) {
      if (!customer.phone || !customer.name) {
        openIdentifyModal()
      } else {
        markVerifySessionStart()
        setShowIdentifyModal(true)
        setVerifyStep(2)
        setVerifyError("")
      }
      return
    }
    const phone = customer.phone || customerData?.phone

    // Só trava o cliente se houver pedido Pix/Card online com pagamento
    // ainda pendente (cliente precisa pagar pra fazer novo pedido).
    // Pedidos na entrega (com ou sem aceitação) NÃO travam — o novo pedido
    // é forçado a pagamento online automaticamente.
    let pendingItems: CartItem[] = []
    let pendingOrderNumberVal: number | null = null
    if (orderResult?.paymentLink && !orderResult.paymentDone && orderResult.orderNumber) {
      pendingItems = lastOrder?.items ?? []
      pendingOrderNumberVal = orderResult.orderNumber
    } else if (lastOrder?.paymentLink && !lastOrder.paymentDone) {
      pendingOrderNumberVal = lastOrder.orderNumber ?? null
      // Os itens foram salvos no lastOrder (localStorage) no momento da
      // criação do pedido, justamente para este caso: reabrição do carrinho
      // antes do pagamento PIX. Não dependemos mais da API /api/orders/customer
      // (que filtra pedidos pendentes).
      if (lastOrder.items && lastOrder.items.length > 0) {
        pendingItems = lastOrder.items
      } else {
        // Fallback legado: tenta pegar do customerOrders pelo orderId.
        const sameOrder = customerOrders.find((o: any) => o.id === lastOrder.orderId)
        if (sameOrder?.items) {
          try {
            const parsed = typeof sameOrder.items === "string" ? JSON.parse(sameOrder.items) : sameOrder.items
            pendingItems = Array.isArray(parsed) ? parsed : []
          } catch {
            pendingItems = []
          }
        }
      }
    }
    const pendingOrder = pendingOrderNumberVal !== null ? { orderNumber: pendingOrderNumberVal } : null

    const inProgress = phone && customerOrders.length > 0
      ? customerOrders.find((o: any) =>
          o.paymentStatus === "paid" && ["confirmed", "preparing", "ready", "out_for_delivery"].includes(o.status)
        )
      : null

    // Pending payment order - open cart directly with locked items
    if (pendingOrder) {
      setPendingOrderItems(pendingItems)
      setPendingOrderNumber(pendingOrderNumberVal)
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
    setCartStep("cart")
  }

  async function checkAndOpenPayment(orderId: string, trackingToken: string) {
    try {
      const res = await fetch(`/api/orders/${orderId}/payment-status?token=${trackingToken}`)
      if (res.ok) {
        const data = await res.json()
        if (data.paymentStatus === "paid") {
          // Payment already confirmed - use shared handler
          handlePaymentSuccess()
          
          // Load orders and show in-progress modal
          loadCustomerOrders()
          setTimeout(() => {
            const order = customerOrders.find((o: any) => o.id === orderId)
            if (order) {
              const statusLabels: Record<string, string> = {
                confirmed: "Confirmado",
                preparing: "Preparando",
                ready: "Pronto",
                out_for_delivery: "Saiu para Entrega",
              }
              setInProgressOrder({
                orderId: order.id,
                orderNumber: order.orderNumber,
                status: statusLabels[order.status] || order.status,
                total: order.total,
                trackingUrl: `/pedido/${order.trackingToken}`,
              })
            }
          }, 300)
          return
        }
      }
    } catch {}
    // If not paid or error, open payment modal
    const order = customerOrders.find((o: any) => o.id === orderId) || { paymentLink: lastOrder?.paymentLink }
    if (order?.paymentLink) {
      userClosedPaymentModalRef.current = false
      setOrderResult({
        success: true,
        orderId,
        paymentLink: order.paymentLink || lastOrder?.paymentLink,
        paymentMethod: "pix",
        orderTotal: total,
      })
      setTimeout(() => setShowPaymentModal(true), 300)
    }
  }

  function addToCart(product: Product) {
    // Check if has pending online payment (Pix/Card) — pay-on-delivery
    // orders never block; the new order is forced to online.
    const paymentDone = orderResult?.paymentDone || lastOrder?.paymentDone
    if (!paymentDone && (customerOrders.length > 0 || (lastOrder?.paymentLink))) {
      const phone = customer.phone || customerData?.phone
      if (phone) {
        const pendingOnlineOrder = customerOrders.find((o: any) =>
          o.paymentStatus === "pending" && o.paymentLink
        )
        const orderId = pendingOnlineOrder?.id || lastOrder?.paymentLink ? lastOrder?.orderId : null
        const orderNumber = pendingOnlineOrder?.orderNumber || 0
        if (orderId && pendingOnlineOrder) {
          // Show action modal so customer can pay or cancel the previous
          // online order before starting a new one.
          setPendingOrderAction({ orderId, orderNumber, productId: product.id })
          return
        }
      }
    }

    // If product has additional options, open bottom sheet
    if ((product as any).additionalOptions?.length > 0) {
      setBottomSheetProduct(product)
      return
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { id: product.id, name: product.name, price: (product as any).promoPrice && (product as any).onSale ? (product as any).promoPrice : product.price, image: product.image, quantity: 1, additionalOptions: [] } as CartItem]
    })
    setAddedItemId(product.id)
    setTimeout(() => setAddedItemId(null), 800)
    // Show toast
    setCartToast({ name: product.name, image: product.image || undefined })
    setTimeout(() => setCartToast(null), 3000)
  }

  function toggleCartItemOption(itemId: string, option: { name: string; price: number; quantity?: number }) {
    const qty = option.quantity ?? 0
    setCart((prev) => prev.map((item) => {
      if (item.id !== itemId) return item
      const currentOptions = item.additionalOptions || []
      const isSelected = currentOptions.some((o) => o.name === option.name)
      
      let newOptions
      if (option.quantity !== undefined) {
        // Quantity mode - add or remove
        if (isSelected) {
          const existing = currentOptions.find((o) => o.name === option.name)
          if (existing && existing.quantity + qty > 0) {
            newOptions = currentOptions.map((o) => o.name === option.name ? { ...o, quantity: o.quantity + qty } : o)
          } else {
            newOptions = currentOptions.filter((o) => o.name !== option.name)
          }
        } else {
          newOptions = [...currentOptions, { name: option.name, price: option.price, quantity: qty || 1 }]
        }
      } else {
        // Radio mode - toggle
        newOptions = isSelected
          ? currentOptions.filter((o) => o.name !== option.name)
          : [...currentOptions, { name: option.name, price: option.price, quantity: 1 }]
      }
      
      const optionsPrice = newOptions.reduce((sum, o) => sum + (o.price * (o.quantity ?? 0)), 0)
      const basePrice = (item as any).basePrice || item.price
      return {
        ...item,
        additionalOptions: newOptions,
        price: basePrice + optionsPrice,
        basePrice: basePrice,
      }
    }))
  }

  function updateCartItemOptionQuantity(itemId: string, optionName: string, delta: number) {
    setCart((prev) => prev.map((item) => {
      if (item.id !== itemId) return item
      const currentOptions = item.additionalOptions || []
      const newOptions = currentOptions.map((o) => {
        if (o.name !== optionName) return o
        const newQty = (o.quantity ?? 0) + delta
        return newQty > 0 ? { ...o, quantity: newQty } : o
      }).filter((o) => (o.quantity ?? 0) > 0)
      
      const optionsPrice = newOptions.reduce((sum, o) => sum + (o.price * (o.quantity ?? 0)), 0)
      const basePrice = (item as any).basePrice || item.price
      return {
        ...item,
        additionalOptions: newOptions,
        price: basePrice + optionsPrice,
        basePrice: basePrice,
      }
    }))
  }

  function getProductOptions(productId: string): any[] {
    for (const cat of establishment.categories) {
      const product = cat.products.find((p: any) => p.id === productId)
      if (product) {
        return (product as any).additionalOptions || []
      }
    }
    return []
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

    // Verificação WhatsApp obrigatória para esta sessão (flag é apagado no logout)
    if (!sessionVerified) {
      console.log("[submitOrder] RETORNO: sessao nao verificada")
      markVerifySessionStart()
      setShowIdentifyModal(true)
      setVerifyStep(2)
      setVerifyError("")
      setOrdering(false)
      orderingRef.current = false
      return
    }

    // CPF só é obrigatório se o pagamento for online (PIX/Card) — gateways exigem
    const paymentMethodCheck: string = paymentMethod as string
    const isOnlinePayment = paymentMethodCheck === "pix" || paymentMethodCheck === "card" || paymentMethodCheck === "online" || paymentMethodCheck === "asaas" || paymentMethodCheck === "inter"
    if (isOnlinePayment) {
      const cpfDigits = (customer.cpf || "").replace(/\D/g, "")
      if (!cpfDigits || cpfDigits.length !== 11 || !isValidCpf(customer.cpf || "")) {
        console.log("[submitOrder] RETORNO: CPF obrigatorio para pagamento online")
        setOrderError("CPF é obrigatório para pagamento online (PIX/Cartão). Adicione na identificação.")
        setOrdering(false)
        orderingRef.current = false
        openIdentifyModal()
        return
      }
    }

    if (orderType === "delivery" && !addressSaved) {
      console.log("[submitOrder] RETORNO: endereco nao salvo")
      setOrderError("Salve o endereço antes de finalizar o pedido")
      setOrdering(false)
      orderingRef.current = false
      return
    }

    // Só trava se houver pedido Pix/Card online com pagamento pendente.
    // Pedidos na entrega nunca travam — o novo pedido é forçado a online.
    const phone = customer.phone || customerData?.phone
    if (phone && !skipPendingCheckRef.current) {
      console.log("[submitOrder] pending check - phone:", phone)
      try {
        const checkRes = await fetch(`/api/orders/customer?phone=${phone.replace(/\D/g, "")}&establishmentId=${establishment.id}`)
        if (checkRes.ok) {
          const orders = await checkRes.json()
          // Only block for genuinely blocking: online (Pix/Card) with
          // paymentLink and not yet paid.
          const pendingOrder = orders.find((o: any) =>
            o.paymentStatus === "pending" && o.paymentLink
          )
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

    // Se o cliente já tem pedido na entrega em andamento, força pagamento
    // online no novo pedido (qualquer tentativa de pagar na entrega é
    // convertida para Pix/Card automaticamente).
    const hasOpenDeliveryOrder =
      customerOrders.length > 0 &&
      customerOrders.some((o: any) =>
        ["pending", "confirmed", "preparing", "ready"].includes(o.status) &&
        ["cash", "delivery", "pickup", "card_delivery", "card_pickup"].includes(o.paymentMethod)
      )
    let effectivePaymentMethod = paymentMethod
    if (hasOpenDeliveryOrder && (paymentMethod === "delivery" || paymentMethod === "pickup")) {
      console.log("[submitOrder] Forçando pagamento online — pedido na entrega em andamento")
      effectivePaymentMethod = "pix"
    }

    try {
      console.log("[submitOrder] calling API...")
      // If the user picked "Pagar na Entrega/Retirada" we need a sub-method
      // (cash/card) and, for cash, a changeFor amount. Until that is filled
      // we block the order.
      let resolvedMethod: any = effectivePaymentMethod
      if (resolvedMethod === "delivery" || resolvedMethod === "pickup") {
        if (!cashSubMethod) {
          setOrderError("Escolha Dinheiro ou Cartão para pagar na entrega")
          return
        }
        resolvedMethod = cashSubMethod === "card" ? "card_delivery" : cashSubMethod || resolvedMethod
      }
      const isOnlinePaymentMethod =
        resolvedMethod === "pix" ||
        resolvedMethod === "card" ||
        resolvedMethod === "online" ||
        resolvedMethod === "asaas" ||
        resolvedMethod === "inter"
      const changeForValue =
        !isOnlinePaymentMethod && cashSubMethod === "cash" && changeFor
          ? Number(changeFor)
          : null

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          establishmentId: establishment.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerEmail: customer.email || "",
          customerAddress: orderType === "delivery" ? fullAddress : "",
          customerComplement: customer.address,
          customerCep: cep || "",
          customerCpf: customer.cpf || "",
          customerLat: geoDeliveryInfo?.lat || null,
          customerLng: geoDeliveryInfo?.lng || null,
          orderType,
          paymentMethod: resolvedMethod,
          changeFor: changeForValue,
          items: cart,
          total,
          deliveryFee,
          couponId: couponData?.id || undefined,
          couponDiscount: couponDiscount || 0,
          firstPurchaseDiscount: firstPurchaseDiscountValue || 0,
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

      // Snapshot cart items BEFORE clearing, so we can persist them with
      // the pending order and show them in the cart if the customer closes
      // the PIX modal without paying and reopens the cart later.
      const orderItemsSnapshot: CartItem[] = cart.map((it) => ({ ...it }))

      // Clear cart and pending state right after the order is successfully
      // created, regardless of payment method. Otherwise pay-on-delivery
      // orders leave the cart dirty and the customer sees stale items.
      setConfirmationItems([...cart])
      setConfirmationSubtotal(subtotal)
      setCart([])
      localStorage.removeItem(`pedefacil-cart-${establishment.slug}`)
      setChangeFor("")
      setUseLoyalty(false)

      // Re-sync customer loyalty points from server after order
      if (customer.phone) {
        const phoneDigits = customer.phone.replace(/\D/g, "")
        applyLocalVerified(phoneDigits)
      }

      // If payment link exists, close cart (payment modal will take over).
      // Otherwise, stay in cart and show confirmation step.
      if (data.paymentLink) {
        setShowCart(false)
        setCartStep("confirmation")
      } else {
        setCartStep("confirmation")
      }

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
        deliveryCode: data.order?.deliveryCode,
      })

      const installPromptShown = localStorage.getItem(`pedefacil-install-prompted-${establishment.slug}`) === "1"
      if (!installPromptShown) {
        localStorage.setItem(`pedefacil-install-prompted-${establishment.slug}`, "1")
        setTimeout(() => setShowInstallPrompt(true), 2500)
      }

      console.log("[submitOrder] setOrderResult chamado, paymentLink:", data.paymentLink ? "SIM" : "NAO")

      if (data.order?.id && data.trackingUrl) {
        const lastOrd = { orderId: data.order.id, trackingUrl: data.trackingUrl, paymentLink: data.paymentLink || "", timestamp: Date.now(), paymentMethod: paymentMethod, total, paymentDone: false, orderNumber: data.order.orderNumber, items: orderItemsSnapshot }
        setLastOrder(lastOrd)
        localStorage.setItem(`pedefacil-last-order-${establishment.slug}`, JSON.stringify(lastOrd))
        // Clear old countdown localStorage for new order
        if (data.paymentLink) {
          localStorage.removeItem(`pedefacil-countdown-${establishment.slug}`)
          localStorage.removeItem(`pedefacil-countdown-time-${establishment.slug}`)
        }
      }

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
    const token = url.split("/pedido/")[1]
    if (!token) return
    trackingTokenRef.current = token
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

  // Auto-open orders screen when URL has ?orders=1 (from push notification click)
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const openOrders = params.get("orders")
    if (!openOrders) return

    // Clean URL immediately
    const cleanUrl = window.location.pathname
    window.history.replaceState({}, "", cleanUrl)

    // Open orders screen on Em Andamento tab
    setShowOrdersList(true)
  }, [])

  useEffect(() => {
    if (!showTracking) return
    const currentOrderId = orderResult?.orderId || lastOrder?.orderId || trackingOrder?.id
    const token = trackingTokenRef.current
    if (!currentOrderId || !token) return

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
  }, [showTracking, orderResult?.orderId, lastOrder, trackingOrder?.id])

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

  async function cancelOrder(orderId: string, reason: string) {
    setCancelling(true)
    try {
      // Cliente anônimo autentica via trackingToken salvo no lastOrder
      const trackingToken = extractTrackingToken(lastOrder?.trackingUrl)
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "cancelled",
          paymentStatus: "cancelled",
          cancelledBy: "customer",
          cancellationReason: reason || null,
          trackingToken,
        }),
      })
      if (res.ok) {
        setCancelModalOrderId(null)
        setPendingOrderItems([])
        setPendingOrderNumber(null)
        // IMPORTANTE: limpar também o orderResult. Caso contrário, o openCart
        // ainda enxerga paymentLink+orderNumber pendentes e força a abertura
        // do carrinho vazio (com pendingOrderItems=[]) em vez de mostrar os
        // itens que o cliente acabou de adicionar ao cart.
        if (orderResult?.orderId === orderId) {
          setOrderResult(null)
        }
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
        toast("Pedido cancelado", "success")
      } else {
        const errBody = await res.json().catch(() => null)
        toast(errBody?.error || "Não foi possível cancelar o pedido", "error")
      }
    } catch (e: any) {
      console.error("[cancelOrder] erro:", e?.message)
      toast("Erro ao cancelar o pedido", "error")
    } finally {
      setCancelling(false)
    }
  }

  const loadCustomerOrders = useCallback(async () => {
    const phone = customer.phone || customerData?.phone
    if (!phone) return
    setLoadingOrders(true)
    try {
      const res = await fetch(`/api/orders/customer?phone=${phone.replace(/\D/g, "")}&establishmentId=${establishment.id}&_=${Date.now()}`)
      if (res.ok) {
        const data = await res.json()
        setCustomerOrders(data)
      }
    } catch {} finally {
      setLoadingOrders(false)
    }
  }, [customer.phone, customerData?.phone, establishment.id, establishment.slug])

  // Poll customer orders periodically so the Pedidos badge updates even
  // without push notifications (e.g. browser without service worker).
  useEffect(() => {
    const phone = customer.phone || customerData?.phone
    if (!phone) return
    const interval = setInterval(async () => {
      await loadCustomerOrders()
      // Detect status changes and auto-clear notifications for delivered orders
      try {
        const res = await fetch(`/api/orders/customer?phone=${phone.replace(/\D/g, "")}&establishmentId=${establishment.id}&_=${Date.now()}`)
        if (res.ok) {
          const data = await res.json()
          let hasDelivered = false
          for (const order of data) {
            const prev = prevOrderStatusesRef.current[order.id]
            if (prev && prev !== order.status) {
              // Clear bell notifications when order is delivered
              if (order.status === "delivered") {
                hasDelivered = true
              }
            }
            prevOrderStatusesRef.current[order.id] = order.status
          }
          // Auto-clear order notifications from bell when any order is delivered
          if (hasDelivered) {
            fetch("/api/customers/notifications", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ phone, establishmentId: establishment.id, markAllRead: true }),
            }).catch(() => {})
            setNotifications(prev => prev.map(n => ({ ...n, read: true })))
          }
        }
      } catch {}
    }, 15000)
    return () => clearInterval(interval)
  }, [customer.phone, customerData?.phone, establishment.id, loadCustomerOrders])

  // Fetch notifications when customer is logged in
  useEffect(() => {
    const phone = customer.phone || customerData?.phone
    if (!phone || !sessionVerified) return
    async function loadNotifications() {
      try {
        const res = await fetch(`/api/customers/notifications?phone=${phone}&establishmentId=${establishment.id}`)
        if (res.ok) {
          const data = await res.json()
          setNotifications(data.notifications || [])
        }
      } catch { }
    }
    loadNotifications()
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [customer.phone, customerData?.phone, establishment.id, sessionVerified])

const handlePaymentSuccess = useCallback(() => {
    console.log("[handlePaymentSuccess] Called - clearing cart and pending order")
    setCart([])
    setPendingOrderItems([])
    setPendingOrderNumber(null)
    localStorage.removeItem(`pedefacil-cart-${establishment.slug}`)
    localStorage.removeItem(`pedefacil-countdown-${establishment.slug}`)
    localStorage.removeItem(`pedefacil-countdown-time-${establishment.slug}`)
    // Clear paymentLink AND set paymentDone: true so modal closes and doesn't reopen
    setOrderResult(prev => {
      if (prev?.orderId) paidOrderIdsRef.current.add(prev.orderId)
      console.log("[handlePaymentSuccess] Payment confirmed, clearing paymentLink:", prev?.orderId)
      return prev ? { ...prev, paymentLink: undefined, paymentDone: true } : null
    })
    loadCustomerOrders()
    // Re-sync customer loyalty points after payment confirmation
    setUseLoyalty(false)
    if (customer.phone) {
      const phoneDigits = customer.phone.replace(/\D/g, "")
      applyLocalVerified(phoneDigits)
    }
  }, [establishment.slug, loadCustomerOrders, customer.phone])

  // Listen for push notifications from service worker → refresh orders + show toast
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "push-notification") {
        loadCustomerOrders()
        setPushNotification({ title: event.data.title || "", body: event.data.body || "", url: event.data.url || "" })
        setTimeout(() => setPushNotification(null), 6000)
      }
    }
    navigator.serviceWorker.addEventListener("message", handleMessage)
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage)
  }, [loadCustomerOrders])

  // Auto-foco no primeiro campo OTP ao abrir o modal de verificação
  useEffect(() => {
    if (showIdentifyModal && verifyStep === 2) {
      setTimeout(() => otpInputsRef.current[0]?.focus(), 150)
    }
  }, [showIdentifyModal, verifyStep])

  // Auto-cola: quando o modal abre, tenta ler o código que o cliente copiou
  // Validação do código: usuário deve clicar "Confirmar" manualmente

  // Ouvinte cross-tab: se outra aba/PWA validou o código (via link), fecha o
  // modal aqui e atualiza os dados do cliente.
  useEffect(() => {
    if (typeof window === "undefined") return
    const doneKey = `flowos-verify-done-${establishment.slug}`
    let channel: BroadcastChannel | null = null

    async function onVerifiedElsewhere() {
      // Vários mecanismos (storage + BroadcastChannel) podem entregar a mesma
      // validação; só aplica o login/toast uma vez.
      if (verifyAppliedRef.current) return
      verifyAppliedRef.current = true
      setShowVerifyModal(false)
      setShowIdentifyModal(false)
      setVerifyStep(1)
      setVerifyError("")
      setVerifyCode("")
      setWhatsappSent(false)
      setVerifyDevCode("")
      // Phone pode não estar em estado na PWA (ex.: navegando sem modal);
      // tenta ler do marcador de verificação gravado pelo link.
      let phoneDigits = (customer.phone || customerData?.phone || phoneInput).replace(/\D/g, "")
      if (phoneDigits.length < 10) {
        try {
          const raw = JSON.parse(localStorage.getItem(doneKey) || "{}")
          phoneDigits = String(raw.phone || "").replace(/\D/g, "")
        } catch {}
      }
      if (phoneDigits.length >= 10) {
        await applyLocalVerified(phoneDigits)
        markSessionVerified()
      }
    }

    function onStorage(e: StorageEvent) {
      if (e.key === doneKey) onVerifiedElsewhere()
    }
    window.addEventListener("storage", onStorage)

    if (typeof BroadcastChannel !== "undefined") {
      try {
        channel = new BroadcastChannel(`flowos-verify-${establishment.slug}`)
        channel.onmessage = (e) => {
          if (e.data?.type === "verified") onVerifiedElsewhere()
        }
      } catch {}
    }

    return () => {
      window.removeEventListener("storage", onStorage)
      channel?.close()
    }
  }, [establishment.slug, customer.phone, customerData?.phone, phoneInput])

  // Fallback: se a validação aconteceu em outra aba/PWA (via link) e esta
  // janela não recebeu o evento cross-tab (limitação iOS), ao voltar o foco
  // para a janela o modal fecha e a sessão é marcada como verificada. Também
  // cobre o caso do PWA aberto navegando sem modal: ao voltar o foco, aplica
  // o login consultando o servidor (verifiedAt recente) — no iOS o storage
  // local não é compartilhado entre PWA e Safari, então a decisão vem do banco.
  useEffect(() => {
    if (typeof window === "undefined") return
    async function checkVerifiedOnFocus() {
      // Se já aplicamos o login desta verificação, não repete (evita várias
      // telinhas de "código confirmado" a cada foco).
      if (verifyAppliedRef.current || sessionVerified) return
      let phoneDigits = (customer.phone || customerData?.phone || phoneInput).replace(/\D/g, "")
      // Pega o telefone do marcador (funciona onde o storage é compartilhado:
      // Android/desktop). No iOS vem do estado salvo no próprio PWA.
      if (phoneDigits.length < 10) {
        try {
          const raw = JSON.parse(localStorage.getItem(`flowos-verify-done-${establishment.slug}`) || "{}")
          phoneDigits = String(raw.phone || "").replace(/\D/g, "")
        } catch {}
      }
      if (phoneDigits.length < 10) return
      // Só aplica o login se a verificação aconteceu DEPOIS desta sessão
      // começou. Depois do logout o sessionStart é redefinido para "agora",
      // então um verifiedAt antigo (dos últimos 5 min) não reloga o usuário.
      const sessionStart = getVerifySessionStart()
      if (!sessionStart) return
      try {
        const res = await fetch(`/api/customers?phone=${phoneDigits}&establishmentId=${establishment.id}&_=${Date.now()}`, { cache: "no-store" })
        const data = await res.json()
        const verifiedAt = data?.verifiedAt ? new Date(data.verifiedAt).getTime() : 0
        if (data && !data.notFound && data.whatsappVerified && verifiedAt > sessionStart && Date.now() - verifiedAt < 5 * 60 * 1000) {
          verifyAppliedRef.current = true
          setShowVerifyModal(false)
          setShowIdentifyModal(false)
          setVerifyStep(1)
          setVerifyCode("")
          setWhatsappSent(false)
          setVerifyDevCode("")
          setCustomerData(data)
          setCustomerLoyaltyPoints(data.loyaltyPoints || 0)
          setCustomerTier(data.tier || "bronze")
          markSessionVerified()
        }
      } catch {}
    }
    const onFocus = () => checkVerifiedOnFocus()
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onFocus)
    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onFocus)
    }
  }, [establishment.id, establishment.slug, customer.phone, customerData?.phone, phoneInput, sessionVerified])

  // Polling de segurança: no iOS, quando a PWA volta do background, eventos
  // storage/BroadcastChannel/focus podem não disparar de forma confiável.
  // Consulta o servidor periodicamente e aplica o login se o cliente foi
  // verificado recentemente (verifiedAt dos últimos 5 min). Só roda enquanto
  // o modal de verificação estiver aberto (fluxo ativo) para não gastar
  // requests com o usuário navegando sem estar em verificação.
  useEffect(() => {
    if (typeof window === "undefined" || sessionVerified) return
    const doneKey = `flowos-verify-done-${establishment.slug}`
    let cancelled = false

    async function pollVerified() {
      if (cancelled || sessionVerified || !showVerifyModal || verifyAppliedRef.current) return
      let phoneDigits = (customer.phone || customerData?.phone || phoneInput).replace(/\D/g, "")
      if (phoneDigits.length < 10) {
        try {
          const raw = JSON.parse(localStorage.getItem(doneKey) || "{}")
          phoneDigits = String(raw.phone || "").replace(/\D/g, "")
        } catch {}
      }
      if (phoneDigits.length < 10) return
      const sessionStart = getVerifySessionStart()
      if (!sessionStart) return
      try {
        const res = await fetch(`/api/customers?phone=${phoneDigits}&establishmentId=${establishment.id}&_=${Date.now()}`, { cache: "no-store" })
        const data = await res.json()
        const verifiedAt = data?.verifiedAt ? new Date(data.verifiedAt).getTime() : 0
        if (data && !data.notFound && data.whatsappVerified && verifiedAt > sessionStart && Date.now() - verifiedAt < 5 * 60 * 1000) {
          verifyAppliedRef.current = true
          setShowVerifyModal(false)
          setShowIdentifyModal(false)
          setVerifyStep(1)
          setVerifyCode("")
          setWhatsappSent(false)
          setVerifyDevCode("")
          setCustomerData(data)
          setCustomerLoyaltyPoints(data.loyaltyPoints || 0)
          setCustomerTier(data.tier || "bronze")
          markSessionVerified()
        }
      } catch {}
    }

    pollVerified()
    const id = setInterval(pollVerified, 2000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establishment.id, establishment.slug, sessionVerified, customer.phone, customerData?.phone, phoneInput, showIdentifyModal, verifyStep])

  // Link de verificação (ex.: ?code=123456&phone=5511999999999):
  // valida automaticamente, avisa a PWA aberta e decide se fecha a aba.
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const code = params.get("code")
    const phoneParam = params.get("phone")
    if (!code) return

    // Remove o código da URL imediatamente (segurança + não repetir validação)
    const cleanUrl = window.location.pathname + (window.location.search.replace(/[?&]code=[^&]*/, "").replace(/[?&]phone=[^&]*/, ""))
    window.history.replaceState({}, "", cleanUrl)

    const phoneDigits = (phoneParam || customer.phone || customerData?.phone || phoneInput).replace(/\D/g, "")

    if (phoneDigits.length < 10) {
      setVerifyError("Link de verificação inválido")
      markVerifySessionStart()
      setShowIdentifyModal(true)
      setVerifyStep(2)
      return
    }

    ;(async () => {
      setVerifying(true)
      setVerifyError("")
      try {
        const res = await fetch("/api/verification", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phoneDigits, establishmentId: establishment.id, code }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Código incorreto")

        // Salva o telefone confirmado no cliente local
        setCustomer((prev) => ({ ...prev, phone: phoneDigits, name: prev.name || data.customer?.name || prev.name }))
        try {
          const saved = localStorage.getItem(`pedefacil-customer-${establishment.slug}`)
          const parsed = saved ? JSON.parse(saved) : {}
          parsed.phone = phoneDigits
          localStorage.setItem(`pedefacil-customer-${establishment.slug}`, JSON.stringify(parsed))
        } catch {}

        await applyLocalVerified(phoneDigits)
        markSessionVerified()

        // Avisa a PWA já aberta que o código foi validado (inclui o telefone
        // para que a PWA consiga logar mesmo sem ter o phone em estado)
        try {
          localStorage.setItem(`flowos-verify-done-${establishment.slug}`, JSON.stringify({ ts: Date.now(), phone: phoneDigits }))
        } catch {}
        try {
          const ch = new BroadcastChannel(`flowos-verify-${establishment.slug}`)
          ch.postMessage({ type: "verified" })
          ch.close()
        } catch {}

        setShowVerifyModal(false)
        setShowIdentifyModal(false)
        setVerifyStep(1)
        setVerifyCode("")
        setWhatsappSent(false)
        setVerifyDevCode("")

        // Fluxo simples: validação concluída e o usuário já está logado. O
        // cardápio abre direto nesta aba, sem tela de sucesso nem heartbeat.
      } catch (e: any) {
        setVerifyError(e.message)
        markVerifySessionStart()
        setShowIdentifyModal(true)
        setVerifyStep(2)
      } finally {
        setVerifying(false)
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    ready: "Pronto para Retirada",
    out_for_delivery: "Saiu para Entrega",
    delivered: "Entregue",
  }

  const statusLabelsDelivery: Record<string, string> = {
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

  // Persistent polling for payment status - runs even when modal is closed
  useEffect(() => {
    if (!orderResult?.paymentLink || orderResult?.paymentDone) return
    if (!orderResult?.orderId) return

    const controller = new AbortController()
    let mounted = true
    const startTime = Date.now()
    const POLLING_TIMEOUT = 2 * 60 * 1000 // 2 minutes

    const poll = async () => {
      while (mounted) {
        await new Promise(r => setTimeout(r, 3000))
        if (!mounted) break
        
        // Stop polling after 2 minutes
        if (Date.now() - startTime > POLLING_TIMEOUT) {
          console.log("[persistent-poll] Timeout reached (2min), stopping polling for order:", orderResult.orderId)
          break
        }
        
        try {
          const res = await fetch(`/api/orders/${orderResult.orderId}/payment-status?token=${extractTrackingToken(orderResult.trackingUrl)}`, { signal: controller.signal })
          if (!res.ok) continue
          const data = await res.json()
          if (data.paymentStatus === "paid") {
            console.log("[persistent-poll] Payment confirmed:", orderResult.orderId)
            handlePaymentSuccess()
            break
          }
        } catch {}
      }
    }

    poll()
    return () => { mounted = false; controller.abort() }
  }, [orderResult?.paymentLink, orderResult?.paymentDone, orderResult?.orderId, establishment.slug, handlePaymentSuccess])

  // If success but has payment link, show only the payment modal (no success screen)
  if (orderResult?.success && orderResult?.paymentLink && !orderResult?.paymentDone && !paidOrderIdsRef.current.has(orderResult.orderId || "") && showPaymentModal) {
    console.log("[render] paymentLink existe, showPaymentModal:", showPaymentModal, "orderId:", orderResult.orderId)
    // If user closed modal, don't reopen - render normal UI
    if (!showPaymentModal && userClosedPaymentModalRef.current) {
      console.log("[render] User closed modal, not reopening - rendering normal UI")
      // Render normal UI (fall through)
    } else if (!showPaymentModal && !userClosedPaymentModalRef.current) {
      setTimeout(() => setShowPaymentModal(true), 100)
      return null
    }
    // Reset the flag when modal is shown
    if (showPaymentModal) {
      userClosedPaymentModalRef.current = false
    }
    return (
      <PaymentModal
        orderId={orderResult.orderId!}
        trackingToken={extractTrackingToken(orderResult.trackingUrl)}
        paymentLink={orderResult.paymentLink}
        total={orderResult.orderTotal ?? total}
        theme={theme}
        onClose={() => {
          // Only clear orderResult if payment was successful (paymentLink cleared) or error (no paymentLink).
          // If payment is still pending (has paymentLink), keep it so user can retry.
          userClosedPaymentModalRef.current = true
          setOrderResult(prev => {
            if (prev?.paymentLink === undefined) return null // Payment done → clear
            if (prev?.paymentLink) return prev // Pending → keep for retry
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
onPaymentConfirmed={handlePaymentSuccess}
        paymentProvider={establishment.paymentProvider}
        customerEmail={customerData?.email || ""}
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



  return (
    <div className="min-h-screen pb-24 transition-colors duration-300" style={{ backgroundColor: theme.bgPage, color: theme.text }}>
      <style>{`@keyframes hrBlink { 0%,100%{opacity:1;color:inherit} 50%{opacity:1;color:#FBBF24} } .animate-hr-blink { animation: hrBlink 1.5s ease-in-out infinite; } @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } } .animate-slide-up { animation: slideUp 0.3s ease-out; } @keyframes slideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } } .animate-slideDown { animation: slideDown 0.3s ease-out; }`}</style>
      {/* Background orb */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full blur-[150px] opacity-20" style={{ backgroundColor: theme.primary }} />
      </div>

      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-30 transition-colors duration-300" style={{ backgroundColor: theme.bgPage, paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="border-b backdrop-blur-xl" style={{ borderColor: theme.borderSubtle, backgroundColor: theme.bgHeader }}>
          <div className="mx-auto max-w-3xl px-4 py-3">
            <div className="flex items-center gap-3">
              {establishment.logo ? (
                <img src={establishment.logo} alt={establishment.name} className="h-[60px] w-[60px] rounded-xl object-cover shadow-sm shrink-0" />
              ) : (
                <FlowOSLogo size={60} variant="icon" className="h-[60px] w-[60px] shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                {sessionVerified && (customer.name || customerData?.name) ? (
                  <h1 className="text-[15px] font-bold truncate" style={{ color: theme.text }}>
                    {greeting}, {getFirstName(customer.name || customerData?.name || "")}! 👋
                  </h1>
                ) : (
                  <h1 className="text-[17px] font-extrabold truncate" style={{ color: theme.text }}>{establishment.name}</h1>
                )}
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${theme.primary}15`, color: theme.textMuted }}>
                    <Clock className="w-2.5 h-2.5" />
                    {establishment.estimatedDeliveryMin || 30}-{establishment.estimatedDeliveryMax || 45} min
                  </span>
                </div>
              </div>
              {sessionVerified && (customer.phone || customerData?.phone) ? (
                <div className="flex items-center shrink-0 rounded-full border px-2 py-1.5 gap-2" style={{ backgroundColor: "#ffffff", borderColor: "#e5e7eb" }}>
                  {/* Crown */}
                  <button onClick={() => setShowCustomerProfile(true)} className="flex items-center gap-1">
                    <span className="text-base leading-none">
                      {customerTier === "ouro" ? "👑" : customerTier === "prata" ? "🥈" : "🥉"}
                    </span>
                  </button>
                  {/* Points */}
                  <button onClick={() => setShowCustomerProfile(true)} className="flex items-center">
                    <span className="text-[12px] font-bold text-gray-800">
                      {customerData?.loyaltyPoints || customerLoyaltyPoints} pts
                    </span>
                  </button>
                  {/* Divider */}
                  <span className="w-px h-4 bg-gray-300" />
                  {/* Notification bell — toggles dropdown, or opens orders if no notifications */}
                  <button onClick={() => {
                    const unread = notifications.filter(n => !n.read).length
                    if (unread === 0) {
                      setShowOrdersList(true)
                    } else {
                      setShowNotifDropdown(prev => !prev)
                    }
                  }} className="relative flex items-center justify-center p-1">
                    <svg className="h-6 w-6" style={{ color: theme.text }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                    {notifications.filter(n => !n.read).length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white bg-red-500">
                        {notifications.filter(n => !n.read).length}
                      </span>
                    )}
                  </button>
                </div>
              ) : (
                <button onClick={() => openIdentifyModal()} className="flex h-9 w-9 items-center justify-center rounded-full shrink-0 animate-pulse" style={{ backgroundColor: theme.bgCard, borderWidth: 1, borderStyle: "solid", borderColor: theme.borderCard }}>
                  <User className="h-4 w-4" style={{ color: theme.textMutedMore }} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notification dropdown */}
      {showNotifDropdown && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[59]" onClick={() => {
            // Delete all unread notifications when closing
            setNotifications(prev => [])
            const phone = customer.phone || customerData?.phone
            if (phone) {
              fetch("/api/customers/notifications", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone, establishmentId: establishment.id, markAllRead: true }),
              }).catch(() => {})
            }
            setShowNotifDropdown(false)
          }} />
          <div className="fixed left-0 right-0 z-[60] px-4" style={{ top: "calc(88px + env(safe-area-inset-top, 0px))" }}>
            <div className="mx-auto max-w-3xl rounded-2xl border overflow-hidden" style={{ backgroundColor: theme.bgCard, borderColor: theme.borderCard, boxShadow: "0 12px 40px rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.15)" }}>
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: theme.borderCard }}>
                <span className="text-base font-bold" style={{ color: theme.text }}>Notificações</span>
                <button onClick={() => {
                  setNotifications(prev => [])
                  const phone = customer.phone || customerData?.phone
                  if (phone) {
                    fetch("/api/customers/notifications", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ phone, establishmentId: establishment.id, markAllRead: true }),
                    }).catch(() => {})
                  }
                  setShowNotifDropdown(false)
                }} className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: theme.bgPage, color: theme.textMuted }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              {notifications.filter(n => !n.read).length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm" style={{ color: theme.textMutedMore }}>Nenhuma notificação</p>
                </div>
              ) : (
                <div className="max-h-[50vh] overflow-y-auto">
                  {notifications.filter(n => !n.read).slice(0, 10).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        setShowNotifDropdown(false)
                        if (n.type === "order_status") {
                          setShowOrdersList(true)
                        }
                        // Delete this notification
                        setNotifications(prev => prev.filter(x => x.id !== n.id))
                        const phone = customer.phone || customerData?.phone
                        if (phone) {
                          fetch("/api/customers/notifications", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ phone, establishmentId: establishment.id, deleteId: n.id }),
                          }).catch(() => {})
                        }
                      }}
                      className="w-full flex items-start gap-3 px-4 py-3.5 text-left border-b last:border-b-0"
                      style={{ borderColor: theme.borderCard, backgroundColor: `${theme.primary}05` }}
                    >
                      <span className="text-xl shrink-0 mt-0.5">
                        {n.type === "order_status" ? "📦" : n.type === "cashback" ? "💰" : n.type === "promo" ? "🔥" : "📢"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate" style={{ color: theme.text }}>{n.title}</p>
                        <p className="text-xs mt-0.5 line-clamp-2" style={{ color: theme.textMuted }}>{n.message}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Spacer for fixed header */}
      <div style={{ height: "calc(92px + env(safe-area-inset-top, 0px))" }} />

      {/* Closed banner — configurable */}
      {!isOpen && closedMessage && (
        <div className="mx-auto max-w-3xl px-4 pt-2">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-center backdrop-blur-sm">
            <p className="text-sm font-medium text-amber-300">{closedMessage.title}</p>
            <p className="mt-1 text-xs text-amber-400/70">{closedMessage.sub}</p>
          </div>
        </div>
      )}

      {/* Destaques - full-width carousel, 1 card at a time */}
      {featuredSections.trending.length > 0 && (() => {
        return (
          <div className="mx-auto max-w-3xl px-4 pb-4">
            <div className="relative">
              <div className="overflow-hidden rounded-2xl">
                <div className="flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${destaqueSlide * 100}%)` }}>
                  {featuredSections.trending.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex-shrink-0 w-full text-left"
                    >
                      <div className="relative w-full rounded-2xl overflow-hidden animate-gradient-border" style={{ minHeight: "200px", backgroundColor: theme.bgCard }}>
                        {/* Image area — tap to advance slide */}
                        <button
                          onClick={() => setDestaqueSlide((prev) => (prev + 1) % featuredSections.trending.length)}
                          className="absolute inset-0 z-0"
                          aria-label="Próximo destaque"
                        >
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover active:scale-[0.99] transition-transform animate-ken-burns" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-6xl" style={{ backgroundColor: theme.bgCard }}>🍦</div>
                          )}
                        </button>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />
                        {item.badge && (
                          <div className="absolute top-3 left-3 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm pointer-events-none">{item.badge}</div>
                        )}
                        <div className="relative z-10 flex flex-col justify-end p-5 pointer-events-none" style={{ minHeight: "200px" }}>
                          <h2 className="text-2xl font-black text-white leading-tight uppercase drop-shadow-lg">
                            {item.name.length > 22 ? item.name.substring(0, 22) + "..." : item.name}
                          </h2>
                          <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center gap-2">
                              {item.originalPrice && (
                                <span className="text-sm line-through text-white/60">
                                  R$ {item.originalPrice.toFixed(2).replace(".", ",")}
                                </span>
                              )}
                              <p className="text-xl font-bold text-white drop-shadow">
                                R$ {item.price.toFixed(2).replace(".", ",")}
                              </p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                const product = sortedCategories.flatMap((c) => c.products).find((p) => p.id === item.id)
                                if (!product) return
                                setSelectedProduct(product)
                                setSelectedProductQty(1)
                                setSelectedProductOptions([])
                              }}
                              className="px-4 py-2 rounded-full text-sm font-bold text-white shadow-lg pointer-events-auto active:scale-95 transition-transform animate-float"
                              style={{ backgroundColor: theme.primary }}
                            >
                              Comprar Agora
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {featuredSections.trending.length > 1 && (
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                  {featuredSections.trending.map((_: any, i: number) => (
                    <button key={i} onClick={() => setDestaqueSlide(i)} className={`rounded-full transition-all duration-300 ${destaqueSlide === i ? "w-5 h-1.5" : "w-1.5 h-1.5"}`} style={{ backgroundColor: destaqueSlide === i ? "white" : "rgba(255,255,255,0.4)" }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Promoções + Último Pedido + Mais Pedidos — tabbed horizontal scroll */}
      {(featuredSections.promo.length > 0 || lastOrder?.items?.length || featuredSections.trending.length > 0) && (
        <div className="mx-auto max-w-3xl px-4 pb-4">
          {/* Tab strip */}
          <div className="flex gap-2 mb-3 overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {featuredSections.promo.length > 0 && (
              <button onClick={() => { setFeaturedTab("promo"); if (promoScrollRef.current) promoScrollRef.current.scrollTo({ left: 0 }) }} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all duration-300 shrink-0 ${featuredTab === "promo" ? "text-white shadow-lg" : "hover:opacity-80"}`} style={featuredTab === "promo" ? { backgroundColor: theme.primary, boxShadow: `0 0 12px ${theme.shadowPrimary}`, color: "#ffffff" } : { backgroundColor: theme.bgCard, color: theme.textSubtle, borderWidth: 1, borderStyle: "solid", borderColor: theme.borderCard }}>
                🔥 Promoção
              </button>
            )}
            {featuredSections.trending.length > 0 && (
              <button onClick={() => { setFeaturedTab("trending"); if (promoScrollRef.current) promoScrollRef.current.scrollTo({ left: 0 }) }} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all duration-300 shrink-0 ${featuredTab === "trending" ? "text-white shadow-lg" : "hover:opacity-80"}`} style={featuredTab === "trending" ? { backgroundColor: theme.primary, boxShadow: `0 0 12px ${theme.shadowPrimary}`, color: "#ffffff" } : { backgroundColor: theme.bgCard, color: theme.textSubtle, borderWidth: 1, borderStyle: "solid", borderColor: theme.borderCard }}>
                🏆 Mais Vendidos
              </button>
            )}
            {lastOrder?.items && lastOrder.items.length > 0 && (
              <button onClick={() => { setFeaturedTab("lastOrder"); if (promoScrollRef.current) promoScrollRef.current.scrollTo({ left: 0 }) }} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all duration-300 shrink-0 ${featuredTab === "lastOrder" ? "text-white shadow-lg" : "hover:opacity-80"}`} style={featuredTab === "lastOrder" ? { backgroundColor: theme.primary, boxShadow: `0 0 12px ${theme.shadowPrimary}`, color: "#ffffff" } : { backgroundColor: theme.bgCard, color: theme.textSubtle, borderWidth: 1, borderStyle: "solid", borderColor: theme.borderCard }}>
                🔄 Último Pedido
              </button>
            )}
          </div>

          <div
            ref={promoScrollRef}
            className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
            onTouchStart={() => { userInteractingRef.current = true }}
            onTouchEnd={() => { setTimeout(() => { userInteractingRef.current = false }, 500) }}
            onMouseDown={() => { userInteractingRef.current = true }}
            onMouseUp={() => { setTimeout(() => { userInteractingRef.current = false }, 500) }}
          >
            {/* Promoções */}
            {featuredTab === "promo" && featuredSections.promo.map((item, idx) => (
              <button
                key={`promo-${item.id}`}
                onClick={() => {
                  const product = sortedCategories.flatMap((c) => c.products).find((p) => p.id === item.id)
                  if (!product) return
                  setSelectedProduct(product)
                  setSelectedProductQty(1)
                  setSelectedProductOptions([])
                }}
                className="flex-shrink-0 active:scale-95 transition-transform snap-start rounded-xl overflow-hidden text-left animate-glow-promo animate-slide-in"
                style={{ width: "220px", backgroundColor: theme.bgCard, borderWidth: 1, borderStyle: "solid", borderColor: theme.borderCard, animationDelay: `${idx * 80}ms` }}
              >
                <div className="relative h-[90px] w-full">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-3xl" style={{ backgroundColor: theme.bgPage }}>🍦</div>
                  )}
                  {item.originalPrice && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-[11px] font-bold px-2 py-1 rounded-lg shadow overflow-hidden">
                      <span className="relative z-10">{Math.round((1 - item.price / item.originalPrice) * 100)}% OFF</span>
                      <div className="absolute inset-0 animate-shimmer" />
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <h3 className="font-semibold text-xs truncate" style={{ color: theme.text }}>{item.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {item.originalPrice && (
                      <span className="text-xs line-through" style={{ color: theme.textMutedMore }}>
                        R$ {item.originalPrice.toFixed(2).replace(".", ",")}
                      </span>
                    )}
                    <span className="text-sm font-bold" style={{ color: "#16a34a" }}>
                      R$ {item.price.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                </div>
              </button>
            ))}

            {/* Último Pedido */}
            {featuredTab === "lastOrder" && lastOrder?.items && lastOrder.items.map((item, idx) => (
              <button
                key={`last-${item.id}-${idx}`}
                onClick={() => {
                  const product = sortedCategories.flatMap((c) => c.products).find((p) => p.id === item.id)
                  if (!product) return
                  setSelectedProduct(product)
                  setSelectedProductQty(1)
                  setSelectedProductOptions([])
                }}
                className="flex-shrink-0 active:scale-95 transition-transform snap-start rounded-xl overflow-hidden text-left"
                style={{ width: "220px", backgroundColor: theme.bgCard, borderWidth: 1, borderStyle: "solid", borderColor: theme.borderCard }}
              >
                <div className="relative h-[90px] w-full">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-3xl" style={{ backgroundColor: theme.bgPage }}>🍦</div>
                  )}
                  <div className="absolute top-2 right-2 bg-blue-500 text-white text-[11px] font-bold px-2 py-1 rounded-lg shadow flex items-center gap-1">
                    🔄 Último pedido
                  </div>
                </div>
                <div className="p-2.5">
                  <h3 className="font-semibold text-xs truncate" style={{ color: theme.text }}>{item.name}</h3>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm font-bold" style={{ color: theme.text }}>
                      {formatCurrency(item.price)}
                    </span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${theme.primary}20`, color: theme.primary }}>
                      Pedir novamente
                    </span>
                  </div>
                </div>
              </button>
            ))}

            {/* Mais Pedidos */}
            {featuredTab === "trending" && featuredSections.trending.map((item, idx) => (
              <button
                key={`trend-${item.id}`}
                onClick={() => {
                  const product = sortedCategories.flatMap((c) => c.products).find((p) => p.id === item.id)
                  if (!product) return
                  setSelectedProduct(product)
                  setSelectedProductQty(1)
                  setSelectedProductOptions([])
                }}
                className="flex-shrink-0 active:scale-95 transition-transform snap-start rounded-xl overflow-hidden text-left animate-glow-featured animate-slide-in"
                style={{ width: "220px", backgroundColor: theme.bgCard, borderWidth: 1, borderStyle: "solid", borderColor: theme.borderCard, animationDelay: `${idx * 80}ms` }}
              >
                <div className="relative h-[90px] w-full">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-3xl" style={{ backgroundColor: theme.bgPage }}>🍦</div>
                  )}
                  <div className="absolute top-2 right-2 bg-orange-500 text-white text-[11px] font-bold px-2 py-1 rounded-lg shadow flex items-center gap-1">
                    🔥 Mais pedido
                  </div>
                </div>
                <div className="p-2.5">
                  <h3 className="font-semibold text-xs truncate" style={{ color: theme.text }}>{item.name}</h3>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-2">
                      {item.originalPrice && (
                        <span className="text-xs line-through" style={{ color: theme.textMutedMore }}>
                          R$ {item.originalPrice.toFixed(2).replace(".", ",")}
                        </span>
                      )}
                      <span className="text-sm font-bold" style={{ color: item.originalPrice ? "#16a34a" : theme.text }}>
                        R$ {item.price.toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium" style={{ color: theme.textMutedMore }}>
                      ⭐ {(item as any).rating || "4.8"}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sticky Category Filters - sticks below header when scrolling past destaques/promo */}
      <div className="z-20 transition-colors duration-300" style={{ position: "sticky", top: "calc(92px + env(safe-area-inset-top, 0px))", backgroundColor: theme.bgPage }}>
        <div className="mx-auto max-w-3xl px-4 py-3">
          {searchMode ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: theme.textMutedMore }} />
              <input type="text" placeholder="Buscar no cardápio..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus className="w-full rounded-xl py-2.5 pl-10 pr-10 text-sm backdrop-blur-sm transition-all focus:outline-none" style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }} />
              <button onClick={() => { setSearchQuery(""); setSearchMode(false) }} className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70" style={{ color: theme.textMutedMore }}>
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {sortedCategories.map((cat) => {
                const emoji = getCategoryEmoji(cat.name)
                const isHighlighted = visibleCategoryId === cat.id
                return (
                  <button key={cat.id} onClick={() => {
                    const el = document.getElementById(`cat-${cat.id}`)
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
                  }} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300 shrink-0 ${isHighlighted ? "text-white shadow-lg" : "hover:opacity-80"}`} style={isHighlighted ? { backgroundColor: theme.primary, boxShadow: `0 0 15px ${theme.shadowPrimary}`, color: "#ffffff" } : { backgroundColor: theme.bgCard, color: theme.textSubtle, borderWidth: 1, borderStyle: "solid", borderColor: theme.borderCard }}>
                    {emoji} {cat.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Categories & Products */}
      <div className="mx-auto max-w-3xl px-4 py-6 pb-24">
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
                  <div className="grid grid-cols-2 gap-3">
                    {filtered.map((product) => (
                      <ProductCard key={product.id} product={product} onAdd={addToCart} theme={theme} disabled={!isOpen} isAdded={addedItemId === product.id} onSelect={(p) => { setSelectedProduct(p); setSelectedProductQty(1); setSelectedProductOptions([]) }} />
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
            return (
              <div
                key={cat.id}
                id={`cat-${cat.id}`}
                className="mb-8"
              >
                <div className="grid grid-cols-2 gap-3">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} onAdd={addToCart} theme={theme} disabled={!isOpen} isAdded={addedItemId === product.id} onSelect={(p) => { setSelectedProduct(p); setSelectedProductQty(1); setSelectedProductOptions([]) }} />
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
              <img src={cartToast.image} alt="" loading="lazy" className="h-8 w-8 rounded-lg object-cover" />
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
      {!showCart && !showPaymentModal && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t transition-colors duration-300 rounded-b-2xl" style={{ backgroundColor: theme.bgPage, borderColor: theme.borderCard, paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="mx-auto max-w-3xl flex items-center justify-around px-2 py-2">
            <button
              onClick={() => setSearchMode(true)}
              className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors"
              style={{ color: theme.textMuted }}
            >
              <Search className="h-5 w-5" />
              <span className="text-[10px] font-medium">Buscar</span>
            </button>
            <button
              onClick={cart.length > 0 ? openCart : undefined}
              className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors relative"
              style={{ color: cart.length > 0 ? theme.primary : theme.textMuted }}
            >
              <div className="relative">
                <ShoppingBag className="h-5 w-5" />
                {cart.length > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white" style={{ backgroundColor: theme.primary }}>
                    {totalItems}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">Sacola</span>
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
                <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white shadow-sm" style={{ backgroundColor: theme.primary }}>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40" style={{ backgroundColor: theme.primary }} />
                  <span className="relative">{activeOrdersCount}</span>
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
                if (customer.phone && customer.name && sessionVerified) {
                  setShowCustomerProfile(true)
                } else if (customer.phone && customer.name) {
                  markVerifySessionStart()
                  setShowIdentifyModal(true)
                  setVerifyStep(2)
                  setVerifyError("")
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

      {/* Story Modal */}
      {activeStory && (() => {
        const currentStory = storiesData.stories.find((s: any) => s.id === activeStory)
        return currentStory ? (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: theme.bgPage }}>
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: theme.borderSubtle }}>
            <h2 className="text-lg font-bold" style={{ color: theme.text }}>
              {currentStory.emoji} {currentStory.name}
            </h2>
            <button onClick={() => { setActiveStory(null); setStoryProducts([]); setStoryCombos([]) }} className="p-2 rounded-full" style={{ backgroundColor: theme.bgCard }}>
              <X className="h-5 w-5" style={{ color: theme.text }} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {storyProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <span className="text-4xl mb-4">📭</span>
                <p className="text-sm" style={{ color: theme.textMuted }}>Nenhum produto encontrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {storyProducts.map((product) => (
                  <div key={product.id} className="rounded-2xl overflow-hidden shadow-lg" style={{ backgroundColor: theme.bgCard }}>
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-full h-32 object-cover" />
                    ) : (
                      <div className="w-full h-32 flex items-center justify-center" style={{ backgroundColor: theme.bgCard }}>
                        <Package className="h-10 w-10" style={{ color: theme.textMutedMore }} />
                      </div>
                    )}
                    <div className="p-3">
                      <p className="text-sm font-semibold truncate" style={{ color: theme.text }}>{product.name}</p>
                      {product.badge && (
                        <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${theme.primary}20`, color: theme.primary }}>
                          {product.badge}
                        </span>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1.5">
                          {(product as any).promoPrice && (product as any).onSale ? (
                            <>
                              <span className="text-sm text-zinc-400 line-through">{formatCurrency(product.price)}</span>
                              <span className="text-sm font-bold text-green-600">{formatCurrency((product as any).promoPrice)}</span>
                            </>
                          ) : (
                            <span className="text-sm font-bold" style={{ color: theme.primary }}>{formatCurrency(product.price)}</span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            addToCart({
                              id: product.id,
                              name: product.name,
                              price: (product as any).promoPrice && (product as any).onSale ? (product as any).promoPrice : product.price,
                              image: product.image,
                            } as any)
                          }}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                          style={{ backgroundColor: theme.primary }}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null})()}

      {/* Identify Modal */}
      {showIdentifyModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: theme.overlay }}>
          <div className="w-full max-w-lg rounded-t-2xl border-t p-6 backdrop-blur-xl" style={{ backgroundColor: theme.bgModal, borderColor: theme.borderCard }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold" style={{ color: theme.text }}>
                <Shield className="h-5 w-5" style={{ color: theme.accent }} />
                Confirmar WhatsApp
              </h2>
              <button onClick={() => { setShowIdentifyModal(false); setVerifyStep(1); setVerifyCode(""); setWhatsappSent(false); setVerifyDevCode(""); setVerifyError(""); }} style={{ color: theme.textMutedMore }} className="hover:opacity-70">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              {/* Telefone — sempre visível, fica readonly após envio do código */}
              <div>
                <label className="text-xs" style={{ color: theme.textMuted }}>WhatsApp</label>
                <input
                  placeholder="(47) 99999-9999"
                  value={phoneInput}
                  readOnly={!!(whatsappSent || verifyDevCode)}
                  onChange={(e) => {
                    if (whatsappSent || verifyDevCode) return
                    const raw = e.target.value.replace(/\D/g, "").slice(0, 11)
                    let formatted = raw
                    if (raw.length > 2) formatted = `(${raw.slice(0, 2)}) ${raw.slice(2)}`
                    if (raw.length > 7) formatted = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`
                    setPhoneInput(formatted)
                  }}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ backgroundColor: (whatsappSent || verifyDevCode) ? theme.bgCard : theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1, cursor: (whatsappSent || verifyDevCode) ? "not-allowed" : "text" }}
                />
              </div>

              {/* Nome — sempre visível, readonly se já tem dados */}
              <div>
                <label className="text-xs flex items-center justify-between" style={{ color: theme.textMuted }}>
                  <span>Seu nome</span>
                  {customerData?.name && (
                    <span className="text-[10px]" style={{ color: theme.textMutedMore }}>🔒 edite em &ldquo;Meus dados&rdquo;</span>
                  )}
                </label>
                <input
                  placeholder="Como quer ser chamado?"
                  value={customer.name || customerData?.name || ""}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  readOnly={!!customerData?.name}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{
                    backgroundColor: customerData?.name ? theme.bgCard : theme.bgInput,
                    color: theme.text,
                    borderColor: theme.borderInput,
                    borderWidth: 1,
                    cursor: customerData?.name ? "not-allowed" : "text",
                    opacity: customerData?.name ? 0.7 : 1,
                  }}
                />
              </div>

              {/* Botão enviar código — aparece quando o código ainda NÃO foi enviado */}
              {!whatsappSent && !verifyDevCode && (
                <>
                  <p className="text-[10px]" style={{ color: theme.textMutedMore }}>Verificaremos seu WhatsApp antes do primeiro pedido.</p>
                  <Button
                    onClick={async () => {
                      const finalName = customer.name || customerData?.name || ""
                      if (finalName && phoneInput.replace(/\D/g, "").length >= 11) {
                        setCustomer((prev) => ({ ...prev, name: finalName, phone: phoneInput.replace(/\D/g, "") }))
                        markVerifySessionStart()
                        await sendVerificationCode()
                      }
                    }}
                    className="w-full bg-gradient-to-r from-[#FF6B35] to-[#E55A2B] hover:opacity-90"
                    disabled={!(customer.name || customerData?.name) || phoneInput.replace(/\D/g, "").length < 11 || verifySending}
                  >
                    {verifySending ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Send className="mr-2 inline h-4 w-4" />}
                    Enviar código via WhatsApp
                  </Button>
                </>
              )}

              {/* Código OTP — aparece APÓS enviar o código (mesmo modal, sem troca de tela) */}
              {(whatsappSent || verifyDevCode) && (
                <>
                  {whatsappSent && (
                    <div className="rounded-lg border-2 p-3 text-center" style={{ borderColor: `${theme.success}50`, backgroundColor: `${theme.success}15` }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.success }}>✓ Código enviado no WhatsApp</p>
                      <p className="mt-1 text-xs" style={{ color: theme.textMuted }}>Verifique as mensagens do seu WhatsApp</p>
                    </div>
                  )}

                  {verifyDevCode && (
                    <div className="rounded-lg border-2 border-amber-500/50 bg-amber-500/15 p-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">⚠ WhatsApp não entregou — código visível</p>
                      <p className="mt-1 font-mono text-3xl font-bold tracking-widest text-amber-300">{verifyDevCode}</p>
                      <button
                        type="button"
                        onClick={() => setVerifyCode(verifyDevCode)}
                        className="mt-2 text-xs font-medium text-amber-400 underline hover:text-amber-300"
                      >
                        Usar este código
                      </button>
                    </div>
                  )}

                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="block text-xs uppercase tracking-wider" style={{ color: theme.textMutedMore }}>Código recebido</label>
                      <button
                        type="button"
                        onClick={pasteVerifyCode}
                        className="flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
                        style={{ color: theme.accent }}
                      >
                        <ClipboardList className="h-3.5 w-3.5" />
                        Colar
                      </button>
                    </div>
                    <div className="flex gap-2">
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <input
                          key={i}
                          ref={(el) => { otpInputsRef.current[i] = el }}
                          type="text"
                          inputMode="numeric"
                          autoComplete={i === 0 ? "one-time-code" : "off"}
                          maxLength={1}
                          value={verifyCode[i] || ""}
                          onChange={(e) => handleOtpChange(i, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(i, e)}
                          onPaste={handleOtpPaste}
                          aria-label={`Dígito ${i + 1} do código`}
                          className="h-14 w-full rounded-lg border text-center text-2xl font-bold focus:outline-none focus:ring-2"
                          style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }}
                        />
                      ))}
                    </div>
                    <p className="mt-2 text-center text-[10px]" style={{ color: theme.textMutedMore }}>
                      Copie o código no WhatsApp e volte aqui — ele é preenchido sozinho. Se não, toque em Colar.
                    </p>
                  </div>

                  {verifyError && (
                    <p className="text-sm text-red-400">{verifyError}</p>
                  )}

                  <button
                    type="button"
                    onClick={submitVerifyCode}
                    disabled={verifying || verifyCode.length < 6}
                    className="w-full rounded-lg py-3 text-sm font-medium text-white disabled:opacity-50"
                    style={{ backgroundColor: theme.accent }}
                  >
                    {verifying ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : null}
                    Confirmar e entrar
                  </button>

                  <button
                    type="button"
                    onClick={sendVerificationCode}
                    disabled={verifySending}
                    className="w-full text-center text-xs underline"
                    style={{ color: theme.textMutedMore }}
                  >
                    {verifySending ? "Reenviando..." : "Reenviar código"}
                  </button>
                </>
              )}

              {verifyError && !whatsappSent && !verifyDevCode && (
                <p className="text-sm text-red-400">{verifyError}</p>
              )}
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
          <div className="w-full max-w-lg rounded-t-2xl border-t backdrop-blur-xl overflow-hidden" style={{ backgroundColor: theme.bgModal, borderColor: theme.borderCard }}>
            {/* Close button */}
            <div className="absolute top-4 right-4 z-10">
              <button onClick={() => { setShowCustomerProfile(false); setExpandedProfileItem(null) }} className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: theme.bgCard }}>
                <X className="h-4 w-4" style={{ color: theme.textMuted }} />
              </button>
            </div>

            <div className="max-h-[85vh] overflow-y-auto pb-6">
                {/* Header with Avatar + Name + Tier */}
                <div className="px-5 pt-5 pb-4">
                  <div className="flex items-center gap-3.5">
                    <div className="relative shrink-0">
                      <div className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.primary}dd)` }}>
                        {(customer.name || customerData?.name || "C").charAt(0).toUpperCase()}
                      </div>
                      {parsedTierConfig?.enabled && (
                        <span className="absolute -bottom-0.5 -right-0.5 text-lg leading-none">
                          {customerTier === "ouro" ? "👑" : customerTier === "prata" ? "🥈" : "🥉"}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-bold truncate" style={{ color: theme.text }}>
                        {customer.name || customerData?.name || "Cliente"}
                      </h2>
                      <p className="text-xs mt-0.5" style={{ color: theme.textMutedMore }}>
                        Cliente desde 2024
                      </p>
                      {parsedTierConfig?.enabled && (
                        <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${theme.primary}15`, color: theme.primary }}>
                          {customerTier === "ouro" ? "⭐ Ouro" : customerTier === "prata" ? "🥈 Prata" : "🥉 Bronze"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Loyalty Card */}
                {parsedLoyalty?.enabled && (() => {
                  const currentPts = customerData?.loyaltyPoints || customerLoyaltyPoints || 0
                  const ptsToCurrency = pointsToCurrency(currentPts, parsedLoyalty?.redeemPoints, parsedLoyalty?.redeemDiscount)
                  const discountValue = parsedLoyalty?.redeemDiscount || 10
                  const ptsNeeded = parsedLoyalty?.redeemPoints || 100
                  const progressPct = Math.min(100, (currentPts / ptsNeeded) * 100)
                  return (
                    <div className="mx-4 mb-4 rounded-2xl p-4" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.primary}cc)`, boxShadow: `0 4px 20px ${theme.primary}40` }}>
                      <p className="text-[10px] font-medium text-white/60 uppercase tracking-wider">Seu saldo</p>
                      <p className="text-2xl font-bold text-white mt-1">{currentPts} pts</p>
                      <p className="text-xs text-white/70 mt-0.5">{formatCurrency(ptsToCurrency)}</p>
                      <div className="mt-3">
                        <div className="w-full h-1.5 rounded-full overflow-hidden bg-white/20">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #ffffffcc, #ffffff)" }} />
                        </div>
                        <p className="text-[10px] text-white/60 mt-1">
                          {currentPts >= ptsNeeded
                            ? `Pronto para resgatar! ${formatCurrency(discountValue)} de desconto`
                            : `Faltam ${ptsNeeded - currentPts} pts para ${formatCurrency(discountValue)} de desconto`
                          }
                        </p>
                      </div>
                    </div>
                  )
                })()}

                {/* Stats Row */}
                {customerData && (
                  <div className="mx-4 mb-4 flex items-center gap-4 rounded-xl px-4 py-3" style={{ backgroundColor: theme.bgCard }}>
                    <div className="flex items-center gap-2.5 flex-1">
                      <span className="text-2xl">📦</span>
                      <div>
                        <p className="text-lg font-bold" style={{ color: theme.text }}>{customerData.totalOrders || 0}</p>
                        <p className="text-[10px] uppercase tracking-wider" style={{ color: theme.textMutedMore }}>Pedidos realizados</p>
                      </div>
                    </div>
                    <div className="h-8 w-px" style={{ backgroundColor: theme.borderSubtle }} />
                    <div className="flex items-center gap-2.5 flex-1">
                      <span className="text-2xl">💰</span>
                      <div>
                        <p className="text-lg font-bold" style={{ color: theme.text }}>{formatCurrency((customerData?.realTotalSpent ?? customerData?.totalSpent) || 0)}</p>
                        <p className="text-[10px] uppercase tracking-wider" style={{ color: theme.textMutedMore }}>Economizados</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Menu Items — flat list, expandable */}
                <div className="mx-4 rounded-xl overflow-hidden" style={{ backgroundColor: theme.bgCard }}>

                  {/* Meus dados pessoais */}
                  <div>
                    <button
                      onClick={() => setExpandedProfileItem(expandedProfileItem === "dados" ? null : "dados")}
                      className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors active:opacity-70"
                    >
                      <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${theme.primary}10` }}>
                        <User className="h-4 w-4" style={{ color: theme.primary }} />
                      </div>
                      <span className="flex-1 text-left text-sm font-medium" style={{ color: theme.text }}>Meus dados pessoais</span>
                      <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${expandedProfileItem === "dados" ? "rotate-90" : ""}`} style={{ color: theme.textMutedMore }} />
                    </button>
                    {expandedProfileItem === "dados" && (
                      <div className="px-4 pb-4 space-y-3">
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
                            onChange={(e) => {
                              const raw = e.target.value.replace(/\D/g, "").slice(0, 11)
                              let formatted = raw
                              if (raw.length > 3) formatted = `${raw.slice(0, 3)}.${raw.slice(3)}`
                              if (raw.length > 6) formatted = `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6)}`
                              if (raw.length > 9) formatted = `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9)}`
                              setCustomer({ ...customer, cpf: formatted })
                            }}
                            placeholder="000.000.000-00"
                            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                            style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }}
                          />
                        </div>
                        <div>
                          <label className="text-xs" style={{ color: theme.textMuted }}>E-mail (para pagamento online)</label>
                          <input
                            type="email"
                            value={customer.email || ""}
                            onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                            placeholder="seu@email.com"
                            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                            style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }}
                          />
                        </div>
                        <div>
                          <label className="text-xs" style={{ color: theme.textMuted }}>Data de nascimento</label>
                          <input
                            type="date"
                            value={customer.birthDate || ""}
                            onChange={(e) => setCustomer({ ...customer, birthDate: e.target.value })}
                            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                            style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }}
                          />
                        </div>
                        <button
                          onClick={async () => {
                            const phoneRaw = phoneInput.replace(/\D/g, "")
                            if (!sessionVerified) {
                              setExpandedProfileItem(null)
                              setShowCustomerProfile(false)
                              markVerifySessionStart()
                              setShowIdentifyModal(true)
                              setVerifyStep(2)
                              setVerifyError("")
                              return
                            }
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
                                    birthDate: customer.birthDate,
                                    establishmentId: establishment.id,
                                  }),
                                })
                              } catch {}
                            }
                            localStorage.setItem(`pedefacil-customer-${establishment.slug}`, JSON.stringify({ ...customer, phone: phoneRaw }))
                            setExpandedProfileItem(null)
                          }}
                          className="w-full rounded-lg py-2.5 text-sm font-medium text-white hover:opacity-90"
                          style={{ backgroundColor: theme.primary }}
                        >
                          Salvar
                        </button>
                      </div>
                    )}
                    <div className="h-px mx-4" style={{ backgroundColor: theme.borderSubtle }} />
                  </div>

                  {/* Endereços */}
                  <div>
                    <button
                      onClick={() => setExpandedProfileItem(expandedProfileItem === "enderecos" ? null : "enderecos")}
                      className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors active:opacity-70"
                    >
                      <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${theme.primary}10` }}>
                        <MapPin className="h-4 w-4" style={{ color: theme.primary }} />
                      </div>
                      <span className="flex-1 text-left text-sm font-medium" style={{ color: theme.text }}>Meus endereços</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${theme.primary}20`, color: theme.primary }}>
                        {addresses.length}/3
                      </span>
                      <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${expandedProfileItem === "enderecos" ? "rotate-90" : ""}`} style={{ color: theme.textMutedMore }} />
                    </button>
                    {expandedProfileItem === "enderecos" && (
                      <div className="px-4 pb-4 space-y-3">
                        {/* Address list */}
                        {addresses.map((addr) => (
                          <div key={addr.id} className="rounded-lg p-3 space-y-2" style={{ backgroundColor: theme.bgInput, border: addr.isDefault ? `1px solid ${theme.primary}40` : "none" }}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Home className="h-3.5 w-3.5" style={{ color: theme.textMuted }} />
                                  <span className="text-xs font-semibold" style={{ color: theme.text }}>{addr.label || "Endereço"}</span>
                                  {addr.isDefault && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${theme.primary}20`, color: theme.primary }}>
                                      Principal
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm" style={{ color: theme.text }}>{addr.street}, {addr.number}</p>
                                {addr.neighborhood && <p className="text-xs" style={{ color: theme.textMuted }}>{addr.neighborhood}</p>}
                                <p className="text-xs" style={{ color: theme.textMuted }}>{addr.city} - {addr.state}</p>
                                <p className="text-xs" style={{ color: theme.textMuted }}>CEP: {addr.cep.replace(/(\d{5})(\d{3})/, "$1-$2")}</p>
                                {addr.complement && <p className="text-xs" style={{ color: theme.textMuted }}>{addr.complement}</p>}
                              </div>
                              <button
                                onClick={() => {
                                  if (confirm("Excluir este endereço?")) {
                                    deleteAddress(addr.id)
                                  }
                                }}
                                className="p-2 rounded-full transition-colors"
                                style={{ color: "#ef4444" }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}

                        {addresses.length === 0 && (
                          <p className="text-sm text-center py-2" style={{ color: theme.textMutedMore }}>Nenhum endereço cadastrado</p>
                        )}

                        {/* Add new address button (always shown, limit checked on save) */}
                        {addresses.length < 3 && (
                          <button
                            onClick={() => setShowAddressForm(true)}
                            className="w-full rounded-lg border-2 border-dashed py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                            style={{ borderColor: `${theme.primary}40`, color: theme.primary }}
                          >
                            <Plus className="h-4 w-4" />
                            Adicionar novo endereço
                          </button>
                        )}

                        {addresses.length >= 3 && (
                          <p className="text-xs text-center" style={{ color: theme.textMutedMore }}>Limite de 3 endereços atingido. Exclua um para adicionar outro.</p>
                        )}
                      </div>
                    )}
                    <div className="h-px mx-4" style={{ backgroundColor: theme.borderSubtle }} />
                  </div>

                  {/* Formas de pagamento */}
                  <div>
                    <button
                      onClick={() => setExpandedProfileItem(expandedProfileItem === "pagamento" ? null : "pagamento")}
                      className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors active:opacity-70"
                    >
                      <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${theme.primary}10` }}>
                        <CreditCard className="h-4 w-4" style={{ color: theme.primary }} />
                      </div>
                      <span className="flex-1 text-left text-sm font-medium" style={{ color: theme.text }}>Formas de pagamento</span>
                      <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${expandedProfileItem === "pagamento" ? "rotate-90" : ""}`} style={{ color: theme.textMutedMore }} />
                    </button>
                    {expandedProfileItem === "pagamento" && (
                      <div className="px-4 pb-4">
                        <p className="text-sm" style={{ color: theme.textMutedMore }}>Em breve você poderá cadastrar seus cartões aqui.</p>
                      </div>
                    )}
                    <div className="h-px mx-4" style={{ backgroundColor: theme.borderSubtle }} />
                  </div>

                  {/* Histórico de pedidos */}
                  <div>
                    <button
                      onClick={() => { setExpandedProfileItem(null); setShowCustomerProfile(false); setShowOrdersList(true) }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors active:opacity-70"
                    >
                      <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${theme.primary}10` }}>
                        <Clock className="h-4 w-4" style={{ color: theme.primary }} />
                      </div>
                      <span className="flex-1 text-left text-sm font-medium" style={{ color: theme.text }}>Histórico de pedidos</span>
                      <ChevronRight className="h-4 w-4" style={{ color: theme.textMutedMore }} />
                    </button>
                    <div className="h-px mx-4" style={{ backgroundColor: theme.borderSubtle }} />
                  </div>

                  {/* Cupons de desconto */}
                  <div>
                    <button
                      onClick={() => setExpandedProfileItem(expandedProfileItem === "cupons" ? null : "cupons")}
                      className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors active:opacity-70"
                    >
                      <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${theme.primary}10` }}>
                        <Tag className="h-4 w-4" style={{ color: theme.primary }} />
                      </div>
                      <span className="flex-1 text-left text-sm font-medium" style={{ color: theme.text }}>Cupons de desconto</span>
                      <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${expandedProfileItem === "cupons" ? "rotate-90" : ""}`} style={{ color: theme.textMutedMore }} />
                    </button>
                    {expandedProfileItem === "cupons" && (
                      <div className="px-4 pb-4">
                        <p className="text-sm" style={{ color: theme.textMutedMore }}>Nenhum cupom disponível no momento.</p>
                      </div>
                    )}
                    <div className="h-px mx-4" style={{ backgroundColor: theme.borderSubtle }} />
                  </div>

                  {/* Notificações — texto + toggle */}
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${theme.primary}10` }}>
                      <Bell className="h-4 w-4" style={{ color: theme.primary }} />
                    </div>
                    <span className="flex-1 text-left text-sm font-medium" style={{ color: theme.text }}>Notificações</span>
                    <PushSubscribe establishmentId={establishment.id} customerKey={customer.phone || customerData?.phone || "anonymous"} />
                  </div>
                  <div className="h-px mx-4" style={{ backgroundColor: theme.borderSubtle }} />

                  {/* Ajuda e suporte */}
                  <div>
                    <button
                      onClick={() => setExpandedProfileItem(expandedProfileItem === "ajuda" ? null : "ajuda")}
                      className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors active:opacity-70"
                    >
                      <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${theme.primary}10` }}>
                        <HelpCircle className="h-4 w-4" style={{ color: theme.primary }} />
                      </div>
                      <span className="flex-1 text-left text-sm font-medium" style={{ color: theme.text }}>Ajuda e suporte</span>
                      <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${expandedProfileItem === "ajuda" ? "rotate-90" : ""}`} style={{ color: theme.textMutedMore }} />
                    </button>
                    {expandedProfileItem === "ajuda" && (
                      <div className="px-4 pb-4">
                        <p className="text-sm" style={{ color: theme.textMutedMore }}>Em caso de dúvidas, entre em contato pelo WhatsApp do estabelecimento.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Install App */}
                <div className="mx-4 mt-4">
                  <InstallButton />
                </div>

                {/* Logout */}
                {(customer.phone || customerData?.phone) && (
                  <div className="mx-4 mt-3">
                    <button
                      onClick={() => setShowLogoutConfirm(true)}
                      className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-colors border"
                      style={{ color: "#ef4444", backgroundColor: "#fef2f2", borderColor: "#fecaca" }}
                    >
                      <LogOut className="h-4 w-4" />
                      Sair da conta
                    </button>
                  </div>
                )}
              </div>
          </div>
        </div>
      )}

      {/* Address form modal — independent (works from cart too) */}
      {showAddressForm && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="w-full max-w-lg rounded-t-2xl p-4 space-y-3 max-h-[85vh] overflow-y-auto" style={{ backgroundColor: theme.bgCard }}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold" style={{ color: theme.text }}>Novo endereço</h3>
              <button onClick={() => { setShowAddressForm(false); setAddressFormError("") }} className="p-1">
                <X className="h-5 w-5" style={{ color: theme.textMuted }} />
              </button>
            </div>

            {addressFormError && (
              <p className="text-xs text-center py-2 rounded-lg" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444" }}>{addressFormError}</p>
            )}

            {/* Label */}
            <div>
              <label className="text-xs" style={{ color: theme.textMuted }}>Nome (opcional)</label>
              <input
                value={addressForm.label}
                onChange={(e) => setAddressForm(prev => ({ ...prev, label: e.target.value }))}
                placeholder="Ex: Casa, Trabalho"
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }}
              />
            </div>

            {/* CEP */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs" style={{ color: theme.textMuted }}>CEP</label>
                <input
                  value={addressForm.cep}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, cep: e.target.value.replace(/\D/g, "").slice(0, 8) }))}
                  placeholder="00000-000"
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }}
                />
              </div>
              {addressForm.cep.length === 8 && (
                <button
                  onClick={lookupAddressCep}
                  className="mt-5 text-xs hover:underline"
                  style={{ color: theme.primary }}
                >
                  Buscar
                </button>
              )}
            </div>

            {/* Street */}
            <div>
              <label className="text-xs" style={{ color: theme.textMuted }}>Rua</label>
              <input
                value={addressForm.street}
                onChange={(e) => setAddressForm(prev => ({ ...prev, street: e.target.value }))}
                placeholder="Rua, Avenida..."
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }}
              />
            </div>

            {/* Number + Complement */}
            <div className="flex gap-2">
              <div className="w-1/3">
                <label className="text-xs" style={{ color: theme.textMuted }}>Número</label>
                <input
                  value={addressForm.number}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, number: e.target.value }))}
                  placeholder="123"
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs" style={{ color: theme.textMuted }}>Complemento</label>
                <input
                  value={addressForm.complement}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, complement: e.target.value }))}
                  placeholder="Apt 4, Bloco B..."
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }}
                />
              </div>
            </div>

            {/* Neighborhood */}
            <div>
              <label className="text-xs" style={{ color: theme.textMuted }}>Bairro</label>
              <input
                value={addressForm.neighborhood}
                onChange={(e) => setAddressForm(prev => ({ ...prev, neighborhood: e.target.value }))}
                placeholder="Bairro"
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }}
              />
            </div>

            {/* City + State */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs" style={{ color: theme.textMuted }}>Cidade</label>
                <input
                  value={addressForm.city}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="Cidade"
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }}
                />
              </div>
              <div className="w-16">
                <label className="text-xs" style={{ color: theme.textMuted }}>UF</label>
                <input
                  value={addressForm.state}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, state: e.target.value.toUpperCase().slice(0, 2) }))}
                  placeholder="SC"
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }}
                />
              </div>
            </div>

            <button
              onClick={saveNewAddress}
              disabled={addressFormLoading || !addressForm.street || !addressForm.number || !addressForm.city || !addressForm.state || !addressForm.cep}
              className="w-full rounded-lg py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: theme.primary }}
            >
              {addressFormLoading ? "Salvando..." : "Salvar endereço"}
            </button>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: theme.overlay }}>
          <div className="w-full max-w-sm rounded-2xl p-6 backdrop-blur-xl" style={{ backgroundColor: theme.bgModal, border: `1px solid ${theme.borderCard}` }}>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 h-14 w-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "#fef2f2" }}>
                <svg className="h-7 w-7 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </div>
              <h3 className="text-lg font-bold" style={{ color: theme.text }}>Sair da conta?</h3>
              <p className="mt-2 text-sm" style={{ color: theme.textMuted }}>
                Você precisará informar seu número novamente para acessar seus dados e cashback.
              </p>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 rounded-xl py-3 text-sm font-medium border transition-colors hover:opacity-80"
                style={{ backgroundColor: theme.bgCard, color: theme.text, borderColor: theme.borderCard }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setCustomerData(null)
                  setPhoneInput("")
                  setCustomer({ name: "", phone: "", address: "", notes: "" })
                  setCep("")
                  setCepAddress(null)
                  clearSessionVerified()
                  localStorage.removeItem(`pedefacil-customer-${establishment.slug}`)
                  localStorage.removeItem(`pedefacil-cart-${establishment.slug}`)
                  setShowCustomerProfile(false)
                  setShowLogoutConfirm(false)
                }}
                className="flex-1 rounded-xl py-3 text-sm font-medium text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: "#ef4444" }}
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* First Purchase Bonus Screen */}
      {showFirstPurchaseBonus && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: theme.overlay }}>
          <div className="w-full max-w-lg rounded-t-2xl border-t p-6 backdrop-blur-xl" style={{ backgroundColor: theme.bgModal, borderColor: theme.borderCard }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold" style={{ color: theme.text }}>
                <Sparkles className="h-5 w-5" style={{ color: theme.success }} />
                Parabéns!
              </h2>
              <button onClick={() => setShowFirstPurchaseBonus(false)} style={{ color: theme.textMutedMore }} className="hover:opacity-70">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: `${theme.success}20` }}>
                <Sparkles className="h-8 w-8" style={{ color: theme.success }} />
              </div>
              <p className="text-sm" style={{ color: theme.textMuted }}>Você ganhou na sua primeira compra:</p>
            </div>

            <div className="space-y-3">
              {firstPurchaseDiscountValue > 0 && (
                <div className="flex items-center justify-between rounded-xl p-4" style={{ backgroundColor: `${theme.success}15`, border: `1px solid ${theme.success}30` }}>
                  <div className="flex items-center gap-3">
                    <Tag className="h-5 w-5" style={{ color: theme.success }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: theme.text }}>Desconto</p>
                      <p className="text-xs" style={{ color: theme.textMuted }}>Aplicado automaticamente</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold" style={{ color: theme.success }}>-{formatCurrency(firstPurchaseDiscountValue)}</span>
                </div>
              )}
              {establishment.firstPurchaseBonus > 0 && (
                <div className="flex items-center justify-between rounded-xl p-4" style={{ backgroundColor: `${theme.success}15`, border: `1px solid ${theme.success}30` }}>
                  <div className="flex items-center gap-3">
                    <Star className="h-5 w-5" style={{ color: theme.success }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: theme.text }}>Cash de bônus</p>
                      <p className="text-xs" style={{ color: theme.textMuted }}>Adicionado ao seu saldo</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold" style={{ color: theme.success }}>+{establishment.firstPurchaseBonus}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowFirstPurchaseBonus(false)}
              className="mt-6 w-full rounded-lg py-3 text-sm font-medium text-white"
              style={{ backgroundColor: theme.primary }}
            >
              Continuar comprando
            </button>
          </div>
        </div>
      )}

      <PushHeal establishmentId={establishment.id} customerKey={customer.phone || customerData?.phone || "anonymous"} />

      {/* Unified Cart/Checkout Full-Screen Flow */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: theme.bgPage, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

          {/* Header */}
          <div className="flex-shrink-0 max-w-lg mx-auto w-full flex items-center justify-between px-4 py-3">
            <h2 className="text-lg font-bold" style={{ color: theme.text }}>
              {cartStep === "cart" ? "Seu pedido" : cartStep === "payment" ? "Finalizar pedido" : "Pedido confirmado!"}
            </h2>
            <div className="flex items-center gap-2">
              {pendingOrderNumber && canCancelPending && (
                <button onClick={() => { setCancelModalOrderId(lastOrder?.orderId || orderResult?.orderId || ""); setCancelModalTotal(total) }}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                  style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <X className="h-3 w-3" /> Cancelar
                </button>
              )}
              <button onClick={() => { setShowCart(false); setCartStep("cart"); setEditingAddress(false) }} style={{ color: theme.textMutedMore }} className="hover:opacity-70">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto px-4">
            {cartStep === "cart" && (
              <div className="max-w-lg mx-auto space-y-3 pb-4">
                {/* Order type toggle */}
                {(orderConfig.delivery || orderConfig.pickup) && (
                  <div className="flex gap-2">
                    {orderConfig.delivery && (
                      <button type="button" onClick={() => handleOrderTypeChange("delivery")}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-all"
                        style={orderType === "delivery" ? { borderColor: theme.primary, backgroundColor: `${theme.primary}14`, color: theme.primary } : { borderColor: theme.borderCard, color: theme.textSubtle }}>
                        <Bike className="h-4 w-4" /> Entrega
                      </button>
                    )}
                    {orderConfig.pickup && (
                      <button type="button" onClick={() => handleOrderTypeChange("pickup")}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-all"
                        style={orderType === "pickup" ? { borderColor: theme.primary, backgroundColor: `${theme.primary}14`, color: theme.primary } : { borderColor: theme.borderCard, color: theme.textSubtle }}>
                        <StoreIcon className="h-4 w-4" /> Retirada
                      </button>
                    )}
                  </div>
                )}

                {/* Pickup address */}
                {orderType === "pickup" && establishment.address && (
                  <div className="rounded-xl border p-3" style={{ backgroundColor: theme.accentLight, borderColor: theme.accentLight }}>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: theme.accent }} />
                      <div className="flex-1">
                        <p className="text-sm font-medium" style={{ color: theme.accent }}>Retirada em:</p>
                        <p className="text-semibold" style={{ color: theme.text }}>{establishment.address}</p>
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(establishment.address || "")}`} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline mt-1 inline-block" style={{ color: theme.accent }}>
                          Abrir no Maps
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Delivery fee / free */}
                {orderType === "delivery" && deliveryFee > 0 && (
                  <div className="rounded-xl p-3 text-sm" style={{ backgroundColor: `${theme.primary}10`, color: theme.primary }}>
                    <p className="font-medium">Taxa de entrega: {formatCurrency(deliveryFee)}</p>
                    {establishment.deliveryFeeType === "free_above" && subtotal < (establishment.deliveryFreeAbove || 0) && (
                      <p className="text-xs mt-1 opacity-70">Faltam {formatCurrency((establishment.deliveryFreeAbove || 0) - subtotal)} para frete grátis!</p>
                    )}
                  </div>
                )}
                {orderType === "delivery" && deliveryFee === 0 && (
                  <div className="rounded-xl p-3 text-sm" style={{ backgroundColor: `${theme.accent}15`, color: theme.accent }}>
                    <p className="font-medium">Entrega grátis! 🎉</p>
                  </div>
                )}

                {/* Address selection (delivery) — Tela 1 */}
                {orderType === "delivery" && cart.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium" style={{ color: theme.textSubtle }}>MEUS ENDEREÇOS</p>
                      {addresses.length > 0 && addresses.length < 3 && (
                        <button type="button" onClick={() => setShowAddressForm(true)} className="text-xs font-medium" style={{ color: theme.primary }}>
                          + Novo endereço
                        </button>
                      )}
                    </div>

                    {/* Address cards */}
                    {addresses.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                        {addresses.map((addr) => (
                          <button
                            key={addr.id}
                            type="button"
                            onClick={() => {
                              setSelectedAddressId(addr.id)
                              setCustomer(prev => ({ ...prev, address: addr.number }))
                              setCep(addr.cep)
                              setAddressSaved(true)
                            }}
                            className="flex-shrink-0 rounded-xl p-3 text-left transition-all min-w-[140px] max-w-[180px]"
                            style={{
                              backgroundColor: selectedAddressId === addr.id ? `${theme.primary}14` : theme.bgCard,
                              border: `2px solid ${selectedAddressId === addr.id ? theme.primary : theme.borderCard}`,
                            }}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Home className="h-3.5 w-3.5" style={{ color: selectedAddressId === addr.id ? theme.primary : theme.textMuted }} />
                              <span className="text-xs font-semibold truncate" style={{ color: selectedAddressId === addr.id ? theme.primary : theme.text }}>
                                {addr.label || "Endereço"}
                              </span>
                              {addr.isDefault && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${theme.primary}20`, color: theme.primary }}>
                                  Principal
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] leading-tight truncate" style={{ color: theme.textMuted }}>
                              {addr.street}, {addr.number} - {addr.city}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* No addresses — show CEP input */}
                    {addresses.length === 0 && (
                      <>
                        <GeolocationButton establishmentId={establishment.id} orderTotal={subtotal} onResult={(info) => setGeoDeliveryInfo(info)} />
                        <div className="flex gap-2">
                          <div className="space-y-1">
                            <label className="block text-sm font-medium" style={{ color: theme.textSubtle }}>CEP</label>
                            <input placeholder="00000-000" value={cep} onChange={(e) => setCep(e.target.value.replace(/\D/g, "").slice(0, 8))}
                              className="w-32 h-10 rounded-xl border px-3 py-2 text-sm placeholder:opacity-40 focus:outline-none"
                              style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }} disabled={addressSaved && !!cepAddress} />
                          </div>
                          {cep.length === 8 && !cepLoading && (
                            <button type="button" onClick={lookupCep} className="mt-6 text-xs hover:underline self-start" style={{ color: theme.accent }}>Buscar</button>
                          )}
                          {cepLoading && <Loader2 className="mt-7 h-4 w-4 animate-spin" style={{ color: theme.textMutedMore }} />}
                        </div>
                        {cepError && <p className="text-xs text-red-400">{cepError}</p>}
                        {cepAddress && <p className="text-xs" style={{ color: theme.textMuted }}>{cepAddress.logradouro} - {cepAddress.bairro}, {cepAddress.localidade} - {cepAddress.uf}</p>}
                        <div className="space-y-1">
                          <label className="block text-sm font-medium" style={{ color: theme.textSubtle }}>Número</label>
                          <input placeholder="Ex: 123" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                            className="w-full h-10 rounded-xl border px-3 py-2 text-sm placeholder:opacity-40 focus:outline-none"
                            style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput, borderWidth: 1 }} disabled={addressSaved} />
                        </div>
                        {cepAddress && customer.address && (
                          <button type="button" onClick={() => { setAddressSaved(true); setEditingAddress(false) }}
                            className="w-full rounded-xl px-4 py-2 text-sm font-medium text-white hover:opacity-90" style={{ backgroundColor: theme.primary }}>
                            Salvar endereço
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Pending order notice */}
                {pendingOrderNumber && (
                  <div className="rounded-xl p-2 text-center" style={{ backgroundColor: `${theme.primary}15`, border: `1px solid ${theme.primary}30` }}>
                    <p className="text-xs font-medium" style={{ color: theme.primary }}>Pedido #{pendingOrderNumber} - Aguardando pagamento</p>
                  </div>
                )}

                {/* Cart items */}
                {cart.length === 0 && !pendingOrderNumber ? (
                  <p className="py-12 text-center" style={{ color: theme.textMuted }}>Carrinho vazio</p>
                ) : (
                  <div className="space-y-2">
                    {(pendingOrderNumber ? pendingOrderItems : cart).map((item) => {
                      const isFromPendingOrder = !!pendingOrderNumber
                      const productOptions = getProductOptions(item.id)
                      const hasOptions = productOptions.length > 0
                      const selectedOpts = (item.additionalOptions || [])
                      return (
                        <div key={item.id} className="rounded-xl p-3" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderCard}` }}>
                          <div className="flex items-center gap-3">
                            {item.image && <img src={item.image} alt="" loading="lazy" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate text-sm" style={{ color: theme.text }}>{item.name}</p>
                              <p className="text-xs" style={{ color: theme.textMuted }}>{formatCurrency((item as any).basePrice || item.price)}</p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {!isFromPendingOrder && hasOptions && (
                                <button onClick={() => {
                                  const product = sortedCategories.flatMap(c => c.products).find(p => p.id === item.id)
                                  if (!product) return
                                  setSelectedProduct(product)
                                  setSelectedProductQty(item.quantity)
                                  setSelectedProductOptions(item.additionalOptions || [])
                                  setEditingCartItemId(item.id)
                                  setShowCart(false)
                                }} className="p-1 rounded" style={{ color: theme.textMutedMore }}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {!isFromPendingOrder && (
                                <>
                                  <button onClick={() => setCart(prev => prev.map(ci => ci.id === item.id ? { ...ci, quantity: Math.max(1, ci.quantity - 1) } : ci))}
                                    className="w-7 h-7 rounded-full border flex items-center justify-center" style={{ borderColor: theme.borderInputColor }}>
                                    <Minus className="h-3 w-3" style={{ color: theme.text }} />
                                  </button>
                                  <span className="w-5 text-center text-xs font-medium" style={{ color: theme.text }}>{item.quantity}</span>
                                  <button onClick={() => setCart(prev => prev.map(ci => ci.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci))}
                                    className="w-7 h-7 rounded-full border flex items-center justify-center text-white" style={{ borderColor: theme.primary, backgroundColor: theme.primary }}>
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </>
                              )}
                              {!isFromPendingOrder && (
                                <button onClick={() => setCart(prev => prev.filter(ci => ci.id !== item.id))} className="p-1 ml-1" style={{ color: theme.textMutedMore }}>
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          {selectedOpts.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {selectedOpts.map((opt: any, i: number) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${theme.primary}15`, color: theme.primary }}>
                                  {opt.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Empty cart button */}
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="text-xs font-medium" style={{ color: "#EF4444" }}>Esvaziar carrinho</button>
                )}

                {/* First purchase bonus banner */}
                {cart.length > 0 && isFirstPurchase && (
                  <div className="rounded-xl p-3 flex items-center gap-3" style={{ backgroundColor: `${theme.success}15`, border: `1px solid ${theme.success}30` }}>
                    <Sparkles className="h-5 w-5 flex-shrink-0" style={{ color: theme.success }} />
                    <div>
                      <p className="text-xs font-semibold" style={{ color: theme.success }}>Bônus de Primeira Compra!</p>
                      {firstPurchaseDiscountValue > 0 && (
                        <p className="text-[10px]" style={{ color: `${theme.success}cc` }}>Desconto de {formatCurrency(firstPurchaseDiscountValue)} aplicado</p>
                      )}
                      {establishment.firstPurchaseBonus > 0 && (
                        <p className="text-[10px]" style={{ color: `${theme.success}cc` }}>+{establishment.firstPurchaseBonus} cash de bônus</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Coupon */}
                {cart.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-2">
                      <input placeholder="Cupom de desconto" value={couponCode} onChange={(e) => setCouponCode(e.target.value)}
                        className="flex-1 px-3 py-2.5 rounded-xl text-sm border" style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput }} />
                      <button onClick={validateCoupon} disabled={couponLoading}
                        className="px-4 py-2.5 rounded-xl text-xs font-medium border" style={{ borderColor: theme.borderCard, color: theme.textSubtle }}>
                        {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
                      </button>
                    </div>
                    {couponError && <p className="text-xs text-red-400">{couponError}</p>}
                    {couponData && (
                      <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: `${theme.success}15`, border: `1px solid ${theme.success}30` }}>
                        <div className="flex items-center gap-2">
                          <Tag className="h-3.5 w-3.5" style={{ color: theme.success }} />
                          <span className="text-xs font-medium" style={{ color: theme.success }}>{couponData.code}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold" style={{ color: theme.success }}>-{formatCurrency(couponDiscount)}</span>
                          <button onClick={removeCoupon} className="p-0.5"><X className="h-3.5 w-3.5" style={{ color: theme.success }} /></button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Loyalty/cashback */}
                {parsedLoyalty?.enabled && customerLoyaltyPoints > 0 && (
                  <div className="rounded-xl p-3 flex items-center justify-between" style={{ backgroundColor: `${theme.primary}10`, border: `1px solid ${theme.primary}20` }}>
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4" style={{ color: theme.primary }} />
                      <div>
                        <div className="text-xs font-semibold" style={{ color: theme.primary }}>Usar meus pontos</div>
                        <div className="text-[12px] font-semibold" style={{ color: theme.text }}>{customerLoyaltyPoints} pts = {formatCurrency(pointsToCurrency(customerLoyaltyPoints, parsedLoyalty?.redeemPoints, parsedLoyalty?.redeemDiscount))}</div>
                        {parsedLoyalty?.redeemPoints && parsedLoyalty?.redeemDiscount && (
                          <div className="text-[10px]" style={{ color: theme.textMutedMore }}>Máx. {parsedLoyalty.redeemPoints} pts/pedido = {formatCurrency(parsedLoyalty.redeemDiscount)} de desconto</div>
                        )}
                      </div>
                    </div>
                    <button onClick={() => { const next = !useLoyalty; console.log("[loyalty] toggle clicked:", { next, customerLoyaltyPoints, parsedLoyalty, subtotal }); setUseLoyalty(next); }}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${useLoyalty ? "" : ""}`}
                      style={{ borderColor: useLoyalty ? theme.primary : theme.borderInputColor, backgroundColor: useLoyalty ? theme.primary : "transparent" }}>
                      {useLoyalty && <Check className="h-3 w-3 text-white" />}
                    </button>
                  </div>
                )}

                {/* Price summary */}
                {cart.length > 0 && (
                  <div className="pt-2 space-y-1">
                    <div className="flex justify-between text-sm" style={{ color: theme.textSubtle }}>
                      <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
                    </div>
                    {deliveryFee > 0 && (
                      <div className="flex justify-between text-sm" style={{ color: theme.textSubtle }}>
                        <span>Taxa de entrega</span><span>{formatCurrency(deliveryFee)}</span>
                      </div>
                    )}
                    {couponDiscount > 0 && (
                      <div className="flex justify-between text-sm" style={{ color: theme.accent }}>
                        <span>Desconto (cupom)</span><span>-{formatCurrency(couponDiscount)}</span>
                      </div>
                    )}
                    {loyaltyDiscount > 0 && (
                      <div className="flex justify-between text-sm text-amber-400">
                        <span>Desconto (cash)</span><span>-{formatCurrency(loyaltyDiscount)}</span>
                      </div>
                    )}
                    {firstPurchaseDiscountValue > 0 && (
                      <div className="flex justify-between text-sm text-green-400">
                        <span>Desconto (1ª compra)</span><span>-{formatCurrency(firstPurchaseDiscountValue)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-2 text-lg font-bold" style={{ borderColor: theme.borderCard }}>
                      <span style={{ color: theme.text }}>Total</span>
                      <span style={{ color: theme.accent }}>{formatCurrency(total)}</span>
                    </div>
                    {parsedLoyalty?.enabled && parsedLoyalty?.pointsPerReal && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <Gift className="h-3.5 w-3.5" style={{ color: theme.success }} />
                        <span className="text-xs font-medium" style={{ color: theme.success }}>
                          Você ganhará +{Math.floor(total / parsedLoyalty.pointsPerReal) * tierMultiplier} pontos
                        </span>
                      </div>
                    )}
                  </div>
                )}

               
                
              </div>
            )}

            {cartStep === "payment" && (
              <div className="max-w-lg mx-auto space-y-4 pb-4">
                {/* Selected address — compact display with alterar */}
                {orderType === "delivery" && (
                  <div className="space-y-3">
                    {/* Address cards — expandable */}
                    {showPaymentAddressPicker && addresses.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                        {addresses.map((addr) => (
                          <button
                            key={addr.id}
                            type="button"
                            onClick={() => {
                              setSelectedAddressId(addr.id)
                              setCustomer(prev => ({ ...prev, address: addr.number }))
                              setCep(addr.cep)
                              setAddressSaved(true)
                              setShowPaymentAddressPicker(false)
                            }}
                            className="flex-shrink-0 rounded-xl p-3 text-left transition-all min-w-[140px] max-w-[180px]"
                            style={{
                              backgroundColor: selectedAddressId === addr.id ? `${theme.primary}14` : theme.bgCard,
                              border: `2px solid ${selectedAddressId === addr.id ? theme.primary : theme.borderCard}`,
                            }}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Home className="h-3.5 w-3.5" style={{ color: selectedAddressId === addr.id ? theme.primary : theme.textMuted }} />
                              <span className="text-xs font-semibold truncate" style={{ color: selectedAddressId === addr.id ? theme.primary : theme.text }}>
                                {addr.label || "Endereço"}
                              </span>
                              {addr.isDefault && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${theme.primary}20`, color: theme.primary }}>
                                  Principal
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] leading-tight truncate" style={{ color: theme.textMuted }}>
                              {addr.street}, {addr.number} - {addr.city}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Selected address info card */}
                    <div className="rounded-xl p-3" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderCard}` }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" style={{ color: theme.primary }} />
                          <span className="text-xs font-medium" style={{ color: theme.textSubtle }}>Entregando em:</span>
                        </div>
                        <button type="button" onClick={() => setShowPaymentAddressPicker(!showPaymentAddressPicker)} className="text-xs hover:underline" style={{ color: theme.accent }}>
                          {showPaymentAddressPicker ? "Fechar" : "Alterar"}
                        </button>
                      </div>
                      {selectedAddressId && addresses.find(a => a.id === selectedAddressId) ? (
                        (() => {
                          const selected = addresses.find(a => a.id === selectedAddressId)!
                          return (
                            <p className="text-sm mt-1" style={{ color: theme.text }}>
                              {selected.label ? `${selected.label} — ` : ``}{selected.street}, {selected.number}{selected.neighborhood ? ` - ${selected.neighborhood}` : ``}, {selected.city} - {selected.state}
                            </p>
                          )
                        })()
                      ) : fullAddress ? (
                        <p className="text-sm mt-1" style={{ color: theme.text }}>{fullAddress}</p>
                      ) : (
                        <p className="text-sm mt-1" style={{ color: theme.textMutedMore }}>Nenhum endereço selecionado</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Pickup address — compact display */}
                                        {orderType === "pickup" && establishment.address && (
                                          <div className="rounded-xl border p-3" style={{ backgroundColor: theme.accentLight, borderColor: theme.accentLight }}>
                                            <div className="flex items-start gap-2">
                                              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: theme.accent }} />
                                              <div className="flex-1">
                                                <p className="text-sm font-medium" style={{ color: theme.accent }}>Retirada em:</p>
                                                <p className="text-semibold" style={{ color: theme.text }}>{establishment.address}</p>
                                                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(establishment.address || "")}`} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline mt-1 inline-block" style={{ color: theme.accent }}>
                                                  Abrir no Maps
                                                </a>
                                              </div>
                                            </div>
                                          </div>
                )}

                {/* Notes */}
                <div className="space-y-1">
                  <label className="block text-sm font-medium" style={{ color: theme.textSubtle }}>Observações</label>
                  <textarea placeholder="Ex: Sem cebola, ponto da carne..." value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })}
                    style={{ backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.borderInput }}
                    className="flex min-h-[70px] w-full rounded-xl border px-3 py-2 text-sm placeholder:opacity-40 focus:outline-none" />
                </div>

                {/* Payment method */}
                <div>
                  <p className="mb-2 text-sm font-medium" style={{ color: theme.textSubtle }}>Pagamento</p>
                  {customerOrders.length > 0 && customerOrders.some((o: any) =>
                    ["pending", "confirmed", "preparing", "ready"].includes(o.status) &&
                    ["cash", "delivery", "pickup", "card_delivery", "card_pickup"].includes(o.paymentMethod)
                  ) && (
                    <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                      <Shield className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div>
                        <p className="font-semibold">Você tem um pedido na entrega em andamento.</p>
                        <p className="mt-0.5">Este novo pedido será pago online (Pix ou Cartão) automaticamente.</p>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    {availablePayments.map((p) => {
                      const isDeliveryOption = p.key === "delivery" || p.key === "pickup"
                      const blockedByOpenDelivery = isDeliveryOption && customerOrders.length > 0 && customerOrders.some((o: any) =>
                        ["pending", "confirmed", "preparing", "ready"].includes(o.status) &&
                        ["cash", "delivery", "pickup", "card_delivery", "card_pickup"].includes(o.paymentMethod)
                      )
                      return (
                        <button key={p.key} type="button" disabled={blockedByOpenDelivery}
                          onClick={() => {
                            const switchingToDelivery = p.key === "delivery" || p.key === "pickup"
                            if (switchingToDelivery && customerOrders.length > 0) {
                              const pendingOnline = customerOrders.find((o: any) => o.paymentStatus === "pending" && ["online", "asaas", "inter", "pix"].includes(o.paymentMethod))
                              if (pendingOnline) {
                                if (!window.confirm(`Você tem o pedido #${pendingOnline.orderNumber} com pagamento online pendente. Se mudar para pagamento na entrega, esse pedido será cancelado. Deseja continuar?`)) return
                              }
                            }
                            setPaymentMethod(p.key as any)
                            setCashSubMethod(null)
                            setChangeFor("")
                          }}
                          className="flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          style={paymentMethod === p.key ? { borderColor: theme.primary, backgroundColor: `${theme.primary}14`, color: theme.primary } : { borderColor: theme.borderCard, color: theme.textSubtle }}>
                          {p.icon}
                          {p.label}
                        </button>
                      )
                    })}
                  </div>
                  {(paymentMethod === "delivery" || paymentMethod === "pickup") && (
                    <div className="mt-2 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => { setCashSubMethod("cash"); setChangeFor("") }}
                          className="flex items-center gap-2 rounded-xl border p-2.5 text-sm"
                          style={cashSubMethod === "cash" ? { borderColor: theme.primary, backgroundColor: `${theme.primary}14`, color: theme.primary } : { borderColor: theme.borderCard, color: theme.textSubtle }}>
                          <Banknote className="h-4 w-4" /> Dinheiro
                        </button>
                        <button type="button" onClick={() => { setCashSubMethod("card"); setChangeFor("") }}
                          className="flex items-center gap-2 rounded-xl border p-2.5 text-sm"
                          style={cashSubMethod === "card" ? { borderColor: theme.primary, backgroundColor: `${theme.primary}14`, color: theme.primary } : { borderColor: theme.borderCard, color: theme.textSubtle }}>
                          <CreditCard className="h-4 w-4" /> Cartão
                        </button>
                      </div>
                      {cashSubMethod === "cash" && (
                        <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: theme.borderCard, backgroundColor: theme.bgInput }}>
                          <p className="text-xs font-medium" style={{ color: theme.textSubtle }}>Precisa de troco?</p>
                          <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setChangeFor("")}
                              className="rounded-xl border px-3 py-1.5 text-xs font-medium"
                              style={changeFor === "" ? { borderColor: theme.primary, backgroundColor: `${theme.primary}14`, color: theme.primary } : { borderColor: theme.borderCard, color: theme.textSubtle }}>
                              Pagamento exato
                            </button>
                            <button type="button" onClick={() => setChangeFor(total.toFixed(2))}
                              className="rounded-xl border px-3 py-1.5 text-xs font-medium"
                              style={changeFor === total.toFixed(2) && changeFor !== "" ? { borderColor: theme.primary, backgroundColor: `${theme.primary}14`, color: theme.primary } : { borderColor: theme.borderCard, color: theme.textSubtle }}>
                              Valor exato {formatCurrency(total)}
                            </button>
                          </div>
                          <div>
                            <label className="text-xs" style={{ color: theme.textMuted }}>Ou troco para</label>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-sm" style={{ color: theme.text }}>R$</span>
                              <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0,00" value={changeFor} onChange={(e) => setChangeFor(e.target.value)}
                                className="flex h-9 w-full rounded-xl border px-2 text-sm focus:outline-none" style={{ backgroundColor: theme.bgCard, color: theme.text, borderColor: theme.borderInput }} />
                            </div>
                            {changeFor && Number(changeFor) > 0 && Number(changeFor) >= total && (
                              <p className="mt-1 text-[11px]" style={{ color: theme.textMuted }}>Troco de R$ {(Number(changeFor) - total).toFixed(2).replace(".", ",")}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Error */}
                {orderError && <div className="rounded-xl p-3 text-sm text-red-400 border border-red-500/20" style={{ backgroundColor: "rgba(239,68,68,0.06)" }}>{orderError}</div>}

                {/* Order summary */}
                <div className="rounded-xl p-3" style={{ backgroundColor: theme.bgCard }}>
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
                      <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
                    </div>
                    {deliveryFee > 0 && (
                      <div className="flex justify-between text-sm" style={{ color: theme.textSubtle }}>
                        <span>Taxa de entrega</span><span>{formatCurrency(deliveryFee)}</span>
                      </div>
                    )}
                    {couponDiscount > 0 && (
                      <div className="flex justify-between text-sm" style={{ color: theme.accent }}>
                        <span>Desconto ({couponData?.code})</span><span>-{formatCurrency(couponDiscount)}</span>
                      </div>
                    )}
                    {firstPurchaseDiscountValue > 0 && (
                      <div className="flex justify-between text-sm" style={{ color: theme.success }}>
                        <span>Desconto (1ª compra)</span><span>-{formatCurrency(firstPurchaseDiscountValue)}</span>
                      </div>
                    )}
                    {useLoyalty && loyaltyDiscount > 0 && (
                      <div className="flex justify-between text-sm" style={{ color: theme.success }}>
                        <span>Desconto (pontos)</span><span>-{formatCurrency(loyaltyDiscount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold" style={{ color: theme.text }}>
                      <span>Total</span>
                      <span style={{ color: theme.accent }}>{formatCurrency(total)}</span>
                    </div>
                    {parsedLoyalty?.enabled && parsedLoyalty?.pointsPerReal && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <Gift className="h-3.5 w-3.5" style={{ color: theme.success }} />
                        <span className="text-xs font-medium" style={{ color: theme.success }}>
                          Você ganhará +{Math.floor(total / parsedLoyalty.pointsPerReal) * tierMultiplier} pontos
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {cartStep === "confirmation" && orderResult?.success && (
              <OrderConfirmationScreen
                theme={theme}
                title={establishment.confirmationTitle || "Pedido enviado!"}
                logo={establishment.logo || undefined}
                establishmentName={establishment.name || "Pedefacil"}
                orderNumber={orderResult?.orderNumber}
                items={confirmationItems.map((item) => ({ name: item.name, quantity: item.quantity, price: item.price, additionalOptions: item.additionalOptions }))}
                subtotal={confirmationSubtotal}
                deliveryFee={deliveryFee}
                couponDiscount={couponDiscount}
                firstPurchaseDiscount={firstPurchaseDiscountValue}
                firstPurchaseBonus={isFirstPurchase ? (establishment.firstPurchaseBonus || 0) : 0}
                loyaltyDiscount={useLoyalty && loyaltyDiscount > 0 ? loyaltyDiscount : 0}
                total={orderResult?.orderTotal ?? total}
                showLoyalty={parsedLoyalty?.enabled}
                cashEarned={parsedLoyalty?.pointsPerReal ? Math.floor(total / parsedLoyalty.pointsPerReal) * tierMultiplier : 0}
                loyaltyBalance={customerData?.loyaltyPoints || customerLoyaltyPoints}
                redeemPoints={parsedLoyalty?.redeemPoints}
                redeemDiscount={parsedLoyalty?.redeemDiscount}
                orderType={orderResult?.orderType}
                deliveryCode={orderResult?.deliveryCode}
                deliveryAddress={orderType === "delivery" ? fullAddress : null}
                establishmentAddress={establishment.address || null}
                onTrack={() => { setShowOrdersList(true); setShowCart(false); setCartStep("cart"); setConfirmationItems([]); setOrderResult(null); setUseLoyalty(false); setCustomer(prev => { const updated = { ...prev, notes: "" }; localStorage.setItem(`pedefacil-customer-${establishment.slug}`, JSON.stringify(updated)); return updated }) }}
                onContinue={() => { setShowCart(false); setCartStep("cart"); setConfirmationItems([]); setOrderResult(null); setUseLoyalty(false); setCustomer(prev => { const updated = { ...prev, notes: "" }; localStorage.setItem(`pedefacil-customer-${establishment.slug}`, JSON.stringify(updated)); return updated }) }}
              />
            )}
          </div>

          {/* Fixed bottom buttons — always in same position */}
          <div className="flex-shrink-0 max-w-lg mx-auto w-full px-4 pb-4 pt-3 space-y-2" style={{ borderTop: `1px solid ${theme.borderCard}`, paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
            {cartStep === "cart" && (
              <>
                {isBelowMinimum && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-center">
                    <p className="text-xs font-medium text-red-600">Pedido mínimo: {formatCurrency(minimumOrder.value)}</p>
                  </div>
                )}
                <button onClick={() => { setShowCheckout(true); setCartStep("payment") }} disabled={!isOpen || cart.length === 0 || isBelowMinimum || (orderType === "delivery" && !selectedAddressId && addresses.length > 0)}
                  className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-opacity whitespace-nowrap"
                  style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent || theme.primary})` }}>
                  <ShoppingBag className="h-4 w-4 shrink-0" />
                  {!isOpen ? "Estabelecimento fechado" : isBelowMinimum ? `Pedido mínimo: ${formatCurrency(minimumOrder.value)}` : (orderType === "delivery" && !selectedAddressId && addresses.length > 0) ? "Selecione um endereço" : "Finalizar pedido"}
                </button>
                {!lastOrder?.paymentLink && !pendingOrderNumber && (
                  <button onClick={() => { setShowCart(false); setCartStep("cart") }}
                    className="w-full py-2.5 text-xs font-medium flex items-center justify-center gap-1" style={{ color: theme.textMutedMore }}>
                    <ArrowLeft className="h-4 w-4" /> Continuar comprando
                  </button>
                )}
                {lastOrder?.paymentLink && (
                  <button onClick={() => checkAndOpenPayment(lastOrder.orderId, extractTrackingToken(lastOrder.trackingUrl))}
                    className="w-full py-3 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2" style={{ backgroundColor: theme.primary }}>
                    <CreditCard className="h-4 w-4" /> Pagar pedido
                  </button>
                )}
              </>
            )}
            {cartStep === "payment" && (
              <>
                <button onClick={(e) => { e.preventDefault(); handleSiteOrder(e as any) }} disabled={ordering}
                  className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-opacity whitespace-nowrap overflow-hidden min-h-[50px]"
                  style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent || theme.primary})` }}>
                  {ordering ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Shield className="h-4 w-4 shrink-0" />}
                  {ordering ? "Enviando..." : "Confirmar pedido"}
                </button>
                <button onClick={() => setCartStep("cart")}
                  className="w-full py-2.5 text-xs font-medium flex items-center justify-center gap-1" style={{ color: theme.textMutedMore }}>
                  <ArrowLeft className="h-4 w-4" /> Voltar ao carrinho
                </button>
              </>
            )}
            {cartStep === "confirmation" && !(orderResult?.success && !orderResult?.paymentLink) && (
              <>
                {orderResult?.orderId && (
                  <button onClick={() => {
                    setOrderResult(null); setShowCart(false); setCartStep("cart"); setEditingAddress(false); openTracking(); setUseLoyalty(false); setCustomer(prev => { const updated = { ...prev, notes: "" }; localStorage.setItem(`pedefacil-customer-${establishment.slug}`, JSON.stringify(updated)); return updated })
                  }} className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent || theme.primary})` }}>
                    <ExternalLink className="h-4 w-4" /> Acompanhar pedido
                  </button>
                )}
                <button onClick={() => {
                  setOrderResult(null); setShowCart(false); setCartStep("cart"); setEditingAddress(false); setUseLoyalty(false)
                  setCart([]); localStorage.removeItem(`pedefacil-cart-${establishment.slug}`)
                  setCustomer(prev => { const updated = { ...prev, notes: "" }; localStorage.setItem(`pedefacil-customer-${establishment.slug}`, JSON.stringify(updated)); return updated })
                }} className="w-full py-2.5 text-xs font-medium flex items-center justify-center" style={{ color: theme.textMutedMore }}>
                  Fechar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Orders list modal */}
      {showOrdersList && (
        <OrdersScreen
          theme={theme}
          orders={customerOrders}
          loading={loadingOrders}
          onClose={() => setShowOrdersList(false)}
          onOpenTracking={(orderId, trackingUrl) => { setShowOrdersList(false); openTracking(orderId, trackingUrl) }}
          onReorder={(order) => {
            const items = typeof order.items === "string" ? JSON.parse(order.items) : order.items
            setCart(items.map((i: any) => ({ id: i.id || i.productId || i.name, name: i.name, price: i.price, image: i.image, quantity: i.quantity })))
            setShowOrdersList(false)
            openCart()
          }}
          onOpenIdentify={() => { setShowOrdersList(false); openIdentifyModal() }}
          onRefresh={loadCustomerOrders}
          hasPhone={!!(customer.phone || customerData?.phone)}
          establishmentSlug={establishment.slug}
          loyaltyConfig={parsedLoyalty}
        />
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
              {trackingOrder && (() => {
                const isPickup = trackingOrder.orderType === "pickup"
                const allSteps = ["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered"]
                const flowSteps = isPickup
                  ? ["pending", "confirmed", "preparing", "ready"]
                  : allSteps
                const flowIdx = flowSteps.indexOf(trackingOrder.status)
                const cancelled = trackingOrder.status === "cancelled"
                const createdAt = trackingOrder.createdAt ? new Date(trackingOrder.createdAt) : null
                const elapsedMin = createdAt ? (Date.now() - createdAt.getTime()) / 60000 : 0
                const baseTime = trackingOrder.orderType === "delivery" ? 45 : 25
                const remainingMin = Math.max(0, baseTime - elapsedMin)
                const estimatedTime = cancelled || trackingOrder.status === "delivered" ? null
                  : remainingMin === 0 ? "A qualquer momento"
                  : remainingMin <= 5 ? "Pronto!" : `~${Math.ceil(remainingMin)} min`
                const items: any[] = Array.isArray(trackingOrder.items) ? trackingOrder.items : []
                const paymentLabels: Record<string, string> = { online: "Pago online", delivery: "Pagar na entrega", pickup: "Pagar na retirada" }

                return (
                  <>
                    {/* Status header */}
                    <div className="text-center">
                      <p className="text-3xl mb-1">{statusIcons[trackingOrder.status] || "📋"}</p>
                      <h3 className="text-lg font-bold" style={{ color: theme.text }}>{(isPickup ? statusLabels : statusLabelsDelivery)[trackingOrder.status] || trackingOrder.status}</h3>
                      <p className="text-xs" style={{ color: theme.textMutedMore }}>Pedido Nº {trackingOrder.orderNumber || trackingOrder.id?.slice(0, 8)}</p>
                    </div>

                    {/* Order summary */}
                    <div className="rounded-xl p-3" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderCard}` }}>
                      <div className="space-y-1.5">
                        {items.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span style={{ color: theme.text }}>{item.quantity}x {item.name}</span>
                            <span className="font-medium" style={{ color: theme.text }}>{formatCurrency(item.price * item.quantity)}</span>
                          </div>
                        ))}
                        {trackingOrder.deliveryFee > 0 && (
                          <div className="flex justify-between text-sm" style={{ color: theme.textMuted }}>
                            <span>Taxa de entrega</span>
                            <span>{formatCurrency(trackingOrder.deliveryFee)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-bold pt-1" style={{ borderTop: `1px solid ${theme.borderSubtle}`, color: theme.text }}>
                          <span>Total</span>
                          <span style={{ color: theme.primary }}>{formatCurrency(trackingOrder.total)}</span>
                        </div>
                        {trackingOrder.notes && (
                          <p className="text-[11px] italic pt-1" style={{ color: theme.textMutedMore, borderTop: `1px solid ${theme.borderSubtle}` }}>Obs: {trackingOrder.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: `1px solid ${theme.borderSubtle}` }}>
                        {trackingOrder.orderType && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${theme.primary}12`, color: theme.primary }}>
                            {trackingOrder.orderType === "delivery" ? "🛵 Entrega" : "🏪 Retirada"}
                          </span>
                        )}
                        {trackingOrder.paymentMethod && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${theme.accent || theme.primary}12`, color: theme.accent || theme.primary }}>
                            {paymentLabels[trackingOrder.paymentMethod] || trackingOrder.paymentMethod}
                          </span>
                        )}
                        {estimatedTime && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${theme.success}15`, color: theme.success }}>
                            ⏱ {estimatedTime}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Delivery Code */}
                    {trackingOrder.deliveryCode && trackingOrder.status !== "delivered" && trackingOrder.status !== "cancelled" && (
                      <div className="rounded-lg px-3 py-2 text-center" style={{ backgroundColor: `${theme.primary}10` }}>
                        <p className="text-xs font-medium" style={{ color: theme.primary }}>
                          Código entrega: <span className="font-bold tracking-wider">{trackingOrder.deliveryCode}</span>
                        </p>
                      </div>
                    )}

                    {/* Pickup address with Maps link */}
                    {isPickup && establishment.address && (
                      <div className="rounded-xl p-3" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderCard}` }}>
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="h-4 w-4" style={{ color: theme.primary }} />
                          <span className="text-xs font-medium" style={{ color: theme.textSubtle }}>Local de retirada</span>
                        </div>
                        <p className="text-sm" style={{ color: theme.text }}>{establishment.address}</p>
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(establishment.address || "")}`} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline mt-1 inline-block" style={{ color: theme.primary }}>
                          Abrir no Maps
                        </a>
                      </div>
                    )}

                    {/* Timeline */}
                    <div className="relative pl-4">
                      {flowSteps.map((step, i) => {
                        const isCompleted = !cancelled && i <= flowIdx
                        const isCurrent = !cancelled && i === flowIdx
                        const isLast = i === flowSteps.length - 1
                        const showPayButton = step === "pending" && trackingOrder.paymentStatus === "pending" && trackingOrder.paymentLink
                        return (
                          <div key={step} className="flex items-start gap-3 relative">
                            {/* Vertical line */}
                            {!isLast && (
                              <div
                                className="absolute left-[13px] top-[28px] w-0.5 h-[calc(100%-4px)]"
                                style={{ backgroundColor: isCompleted && !isCurrent ? theme.primary : theme.borderCard }}
                              />
                            )}
                            {/* Circle */}
                            <div
                              className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs shrink-0"
                              style={isCompleted
                                ? { backgroundColor: theme.primary, color: "#ffffff", ...(isCurrent ? { boxShadow: `0 0 0 3px ${theme.bgPage}, 0 0 0 5px ${theme.primary}` } : {}) }
                                : { backgroundColor: theme.bgCard, color: theme.textMutedMore, border: `2px solid ${theme.borderCard}` }
                              }
                            >
                              {isCompleted && !isCurrent ? "✓" : statusIcons[step]}
                            </div>
                            {/* Label */}
                            <div className="pt-0.5 pb-4 min-w-0 flex-1">
                              <span className="text-sm font-medium" style={{ color: isCompleted ? theme.text : theme.textMutedMore }}>
                                {(isPickup ? statusLabels : statusLabelsDelivery)[step]}
                              </span>
                              {isCurrent && estimatedTime && (
                                <span className="ml-2 text-[11px] font-medium" style={{ color: theme.primary }}>{estimatedTime}</span>
                              )}
                              {showPayButton && (
                                <button
                                  onClick={() => {
                                    setOrderResult({
                                      success: true,
                                      orderId: trackingOrder.id,
                                      paymentLink: trackingOrder.paymentLink,
                                      paymentMethod: trackingOrder.paymentMethod || "pix",
                                      orderTotal: trackingOrder.total,
                                    })
                                    setTimeout(() => { setShowTracking(false); setShowPaymentModal(true) }, 300)
                                  }}
                                  className="ml-2 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
                                  style={{ backgroundColor: theme.primary }}
                                >
                                  <CreditCard className="h-3 w-3" /> Pagar
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )
              })()}

              {/* Chat section */}
              <div className="border-t pt-3" style={{ borderColor: theme.borderCard }}>
                <h3 className="text-sm font-semibold mb-2" style={{ color: theme.textSubtle }}>Mensagens</h3>
                <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
                  {trackingMessages.length === 0 && (
                    <p className="text-center text-xs py-2" style={{ color: theme.textMutedMore }}>Envie uma mensagem ao estabelecimento</p>
                  )}
                  {trackingMessages.map((msg: any) => (
                    <div key={msg.id} className={`flex ${msg.sender === "customer" ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[80%] rounded-lg px-3 py-1.5 text-sm" style={msg.sender === "customer" ? { backgroundColor: theme.primary, color: "#ffffff" } : { backgroundColor: theme.bgCard, color: theme.textSubtle }}>
                        <p>{msg.sender === "customer" ? "Você: " : "Estabelecimento: "}{msg.message}</p>
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
                  // TODO: track token is not stored on pendingOrderModal; look up
                  // via customerOrders before calling checkAndOpenPayment.
                  checkAndOpenPayment(pendingOrderModal.orderId, "")
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
              {(() => {
                const pendingOrderStatus =
                  customerOrders.find((o: any) => o.id === pendingOrderAction.orderId)?.status ||
                  "pending"
                return canCancelByCustomer(pendingOrderStatus) ? (
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
                ) : (
                  <p className="text-center text-xs text-zinc-500 pt-1">
                    Este pedido já está em produção. Solicite cancelamento pelo chat.
                  </p>
                )
              })()}
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
            <p className="mb-4 text-center text-sm" style={{ color: theme.textMuted }}>
              Tem certeza que deseja cancelar este pedido de <strong style={{ color: theme.accent }}>R$ {cancelModalTotal.toFixed(2)}</strong>? O pagamento não será processado.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Motivo do cancelamento (opcional)"
              maxLength={500}
              rows={3}
              className="mb-4 w-full resize-none rounded-xl border p-3 text-sm"
              style={{ borderColor: theme.borderCard, backgroundColor: theme.bgInput, color: theme.text }}
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setCancelModalOrderId(null); setCancelReason("") }}
                className="flex-1 rounded-xl border py-3 text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ borderColor: theme.borderCard, color: theme.text }}
              >
                Voltar
              </button>
              <button
                onClick={() => cancelOrder(cancelModalOrderId, cancelReason)}
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

      <InstallPromptToast show={showInstallPrompt} />

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setSelectedProduct(null); setEditingCartItemId(null) }} />
          <div className="absolute inset-x-0 bottom-0 top-12 flex justify-center">
          <div className="w-full max-w-lg rounded-t-3xl flex flex-col overflow-hidden" style={{ animation: "slideUp 0.3s ease-out", backgroundColor: theme.bgPage }}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: theme.borderSubtle }}></div>
            </div>

            {/* Close button */}
            <button onClick={() => { setSelectedProduct(null); setEditingCartItemId(null) }} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white">
              <X className="h-4 w-4" />
            </button>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {/* Image */}
              {selectedProduct.image ? (
                <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-56 object-cover" />
              ) : (
                <div className="w-full h-56 flex items-center justify-center" style={{ backgroundColor: theme.bgCardHover }}>
                  <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                </div>
              )}

              {/* Product Info */}
              <div className="px-5 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="font-bold text-lg" style={{ color: theme.text }}>{selectedProduct.name}</h2>
                    {selectedProduct.description && (
                      <p className="text-sm mt-1" style={{ color: theme.textMuted }}>{selectedProduct.description}</p>
                    )}
                  </div>
                  {selectedProduct.badge && (
                    <span className="badge-fire text-[10px] font-bold text-white px-2.5 py-1 rounded-full ml-2">
                      {selectedProduct.badge === "mais_vendido" && "🔥 Mais Pedido"}
                      {selectedProduct.badge === "novo" && "🆕 Novo"}
                      {selectedProduct.badge === "promocao" && "🏷️ OFF"}
                    </span>
                  )}
                </div>
                {/* Ratings + Prep time row */}
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ backgroundColor: `${theme.primary}15`, border: `1px solid ${theme.primary}30` }}>
                    <Star className="h-3.5 w-3.5" style={{ color: theme.primary }} />
                    <span className="text-xs font-bold" style={{ color: theme.primary }}>4.7</span>
                    <span className="text-[10px]" style={{ color: theme.textMutedMore }}>(127)</span>
                  </div>
                  <div className="flex items-center gap-1" style={{ color: theme.textMutedMore }}>
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-xs">~15 min</span>
                  </div>
                  <button className="flex items-center gap-1 text-xs transition-colors" style={{ color: theme.textMutedMore }}>
                    <Heart className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  {(selectedProduct as any).promoPrice && (selectedProduct as any).onSale ? (
                    <>
                      <span className="text-sm line-through text-zinc-400">{formatCurrency(selectedProduct.price)}</span>
                      <p className="font-bold text-xl" style={{ color: "#16a34a" }}>{formatCurrency((selectedProduct as any).promoPrice)}</p>
                    </>
                  ) : (
                    <p className="font-bold text-xl" style={{ color: theme.primary }}>{formatCurrency(selectedProduct.price)}</p>
                  )}
                </div>

              </div>

              {/* Quantity */}
              <div className="px-5 pb-4">
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: theme.textMutedMore }}>Quantidade</p>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => setSelectedProductQty(Math.max(1, selectedProductQty - 1))}
                    className="w-10 h-10 rounded-full border-2 flex items-center justify-center transition-colors"
                    style={{ borderColor: theme.borderInputColor, color: theme.text }}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center text-lg font-bold" style={{ color: theme.text }}>{selectedProductQty}</span>
                  <button
                    onClick={() => setSelectedProductQty(selectedProductQty + 1)}
                    className="w-10 h-10 rounded-full border-2 flex items-center justify-center text-white transition-colors"
                    style={{ borderColor: theme.primary, backgroundColor: theme.primary }}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Additional Options */}
              {(() => {
                const options = (selectedProduct as any).additionalOptions || []
                if (options.length === 0) return null
                const groups: Record<string, any[]> = {}
                options.forEach((opt: any) => {
                  const group = opt.groupName || "default"
                  if (!groups[group]) groups[group] = []
                  groups[group].push(opt)
                })
                return (
                  <div className="px-5 pb-4">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: theme.textMutedMore }}>Adicionais</p>
                    {Object.entries(groups).map(([groupName, groupOptions], groupIdx) => {
                      const firstOpt = groupOptions[0]
                      const isRequired = firstOpt?.selectionType === "required"
                      return (
                        <div key={groupIdx} className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="text-sm font-semibold" style={{ color: theme.text }}>{groupName !== "default" ? groupName : "Opções"}</p>
                              {firstOpt?.headerText && <p className="text-[10px]" style={{ color: theme.textMuted }}>{firstOpt.headerText}</p>}
                            </div>
                            {isRequired && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: theme.primary }}>OBRIGATÓRIO</span>}
                          </div>
                          <div className="border rounded-xl overflow-hidden" style={{ borderColor: theme.borderInputColor }}>
                            {groupOptions.map((opt: any, optIdx: number) => {
                              const selectedOpt = selectedProductOptions.find((o) => o.name === opt.name)
                              const isSelected = !!selectedOpt
                              const qty = selectedOpt?.quantity || 0

                              if (opt.inputType === "quantity") {
                                return (
                                  <div key={optIdx} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0" style={{ borderColor: theme.borderInputColor }}>
                                    <div className="flex-1">
                                      <span className="text-sm" style={{ color: theme.text }}>{opt.name}</span>
                                      {opt.price > 0 && <span className="text-[10px] ml-1" style={{ color: theme.primary }}>+{formatCurrency(opt.price)}</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {qty > 0 && (
                                        <>
                                          <button onClick={() => {
                                            const newQty = qty - 1
                                            if (newQty <= 0) setSelectedProductOptions(selectedProductOptions.filter((o) => o.name !== opt.name))
                                            else setSelectedProductOptions(selectedProductOptions.map((o) => o.name === opt.name ? { ...o, quantity: newQty } : o))
                                          }} className="w-7 h-7 rounded-full border flex items-center justify-center" style={{ borderColor: theme.borderInputColor }}>
                                            <Minus className="w-3 h-3" style={{ color: theme.text }} />
                                          </button>
                                          <span className="w-5 text-center text-xs font-medium" style={{ color: theme.text }}>{qty}</span>
                                        </>
                                      )}
                                      <button onClick={() => {
                                        if (isSelected) setSelectedProductOptions(selectedProductOptions.map((o) => o.name === opt.name ? { ...o, quantity: o.quantity + 1 } : o))
                                        else setSelectedProductOptions([...selectedProductOptions, { name: opt.name, price: opt.price, quantity: 1 }])
                                      }} className="w-7 h-7 rounded-full border flex items-center justify-center text-white" style={{ borderColor: theme.primary, backgroundColor: theme.primary }}>
                                        <Plus className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                )
                              }
                              return (
                                <label key={optIdx} onClick={() => {
                                  if (isSelected) setSelectedProductOptions(selectedProductOptions.filter((o) => o.name !== opt.name))
                                  else setSelectedProductOptions([...selectedProductOptions, { name: opt.name, price: opt.price, quantity: 1 }])
                                }} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0 cursor-pointer transition-colors" style={{ borderColor: theme.borderInputColor, backgroundColor: isSelected ? `${theme.primary}10` : "transparent" }}>
                                  <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? "border-green-500 bg-green-500" : ""}`} style={!isSelected ? { borderColor: theme.borderInputColor } : {}}>
                                      {isSelected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                    </div>
                                    <span className="text-sm" style={{ color: theme.text }}>{opt.name}</span>
                                  </div>
                                  {opt.price > 0 && <span className="text-xs font-medium" style={{ color: theme.primary }}>+{formatCurrency(opt.price)}</span>}
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}

              {/* Cross-sell: "Quem pediu, também pediu" */}
              {selectedProduct.additionalOptions && selectedProduct.additionalOptions.length > 0 && (
                <div className="px-5 pb-4">
                  <div className="p-3 rounded-xl" style={{ backgroundColor: `${theme.primary}10`, border: `1px solid ${theme.primary}20` }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="h-4 w-4" style={{ color: theme.primary }} />
                      <span className="text-xs font-bold" style={{ color: theme.primary }}>Quem pediu, também pediu</span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                      {selectedProduct.additionalOptions.slice(0, 3).map((opt: any, i: number) => (
                        <button
                          key={i}
                          onClick={() => {
                            const existing = selectedProductOptions.find((o) => o.name === opt.name)
                            if (existing) setSelectedProductOptions(selectedProductOptions.map((o) => o.name === opt.name ? { ...o, quantity: o.quantity + 1 } : o))
                            else setSelectedProductOptions([...selectedProductOptions, { name: opt.name, price: opt.price, quantity: 1 }])
                          }}
                          className="flex-shrink-0 p-2 rounded-lg flex items-center gap-2"
                          style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.primary}15` }}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ backgroundColor: `${theme.primary}15` }}>🍫</div>
                          <div className="text-left">
                            <div className="text-[10px] font-medium" style={{ color: theme.text }}>{opt.name}</div>
                            <div className="text-[10px] font-bold" style={{ color: theme.primary }}>+{formatCurrency(opt.price)}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Fixed bottom button */}
            <div className="px-5 pb-6 pt-3 border-t flex-shrink-0" style={{ borderColor: theme.borderInputColor }}>
              <button
                onClick={() => {
                  const optionsPrice = selectedProductOptions.reduce((sum, o) => sum + (o.price * o.quantity), 0)
                  const basePrice = (selectedProduct as any).promoPrice && (selectedProduct as any).onSale ? (selectedProduct as any).promoPrice : selectedProduct.price
                  const unitPrice = basePrice + optionsPrice
                  setCart((prev) => {
                    if (editingCartItemId) {
                      return prev.map((item) => item.id === editingCartItemId ? { ...item, quantity: selectedProductQty, additionalOptions: selectedProductOptions, price: unitPrice } : item)
                    }
                    const existing = prev.find((item) => item.id === selectedProduct.id)
                    if (existing) {
                      return prev.map((item) => item.id === selectedProduct.id ? { ...item, quantity: item.quantity + selectedProductQty, additionalOptions: [...(item.additionalOptions || []), ...selectedProductOptions] } : item)
                    }
                    return [...prev, { id: selectedProduct.id, name: selectedProduct.name, price: unitPrice, image: selectedProduct.image, quantity: selectedProductQty, additionalOptions: selectedProductOptions } as CartItem]
                  })
                  setEditingCartItemId(null)
                  setSelectedProduct(null)
                  setAddedItemId(selectedProduct.id)
                  setTimeout(() => setAddedItemId(null), 800)
                  setCartToast({ name: selectedProduct.name, image: selectedProduct.image || undefined })
                  setTimeout(() => setCartToast(null), 3000)
                }}
                className="w-full text-white font-bold py-3.5 rounded-xl text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                style={{ backgroundColor: theme.primary }}
              >
                <Plus className="w-5 h-5" />
                {editingCartItemId ? "Salvar" : "Adicionar"} · {formatCurrency((((selectedProduct as any).promoPrice && (selectedProduct as any).onSale ? (selectedProduct as any).promoPrice : selectedProduct.price) + selectedProductOptions.reduce((sum, o) => sum + (o.price * o.quantity), 0)) * selectedProductQty)}
              </button>
            </div>
          </div>
          </div>
        </div>
      )}
      {bottomSheetProduct && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setBottomSheetProduct(null)} />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl max-h-[80vh] flex flex-col" style={{ animation: "slideUp 0.3s ease-out", backgroundColor: theme.bgPage }}>
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: theme.borderSubtle }}></div>
            </div>
            <div className="px-5 pb-4 border-b" style={{ borderColor: theme.borderSubtle }}>
              <div className="flex items-center gap-3">
                {bottomSheetProduct.image ? (
                  <img src={bottomSheetProduct.image} alt={bottomSheetProduct.name} className="w-16 h-16 rounded-xl object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center" style={{ backgroundColor: theme.bgCardHover }}>
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: theme.textMuted }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                  </div>
                )}
                <div>
                  <h2 className="font-bold text-gray-900">{bottomSheetProduct.name}</h2>
                  {bottomSheetProduct.description && <p className="text-xs text-gray-500">{bottomSheetProduct.description}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    {(bottomSheetProduct as any).promoPrice && (bottomSheetProduct as any).onSale ? (
                      <>
                        <span className="text-sm text-zinc-400 line-through">{formatCurrency(bottomSheetProduct.price)}</span>
                        <p className="font-bold text-sm text-green-600">{formatCurrency((bottomSheetProduct as any).promoPrice)}</p>
                      </>
                    ) : (
                      <p className="font-bold text-sm" style={{ color: theme.primary }}>{formatCurrency(bottomSheetProduct.price)}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 overflow-y-auto flex-1">
              {(() => {
                const options = bottomSheetProduct.additionalOptions || []
                const groups: Record<string, any[]> = {}
                options.forEach((opt: any) => {
                  const group = opt.groupName || "default"
                  if (!groups[group]) groups[group] = []
                  groups[group].push(opt)
                })
                return Object.entries(groups).map(([groupName, groupOptions], groupIdx) => {
                  const firstOpt = groupOptions[0]
                  const isRequired = firstOpt?.selectionType === "required"
                  return (
                    <div key={groupIdx} className="mb-5">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-sm" style={{ color: theme.text }}>{groupName !== "default" ? groupName : "Opções"}</h3>
                          {firstOpt?.headerText && <p className="text-[10px]" style={{ color: theme.textMuted }}>{firstOpt.headerText}</p>}
                        </div>
                        {isRequired && <span className="text-white text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: theme.primary }}>OBRIGATÓRIO</span>}
                      </div>
                      <div className="border rounded-xl overflow-hidden" style={{ borderColor: theme.borderInputColor }}>
                        {groupOptions.map((opt: any, optIdx: number) => {
                          if (opt.inputType === "quantity") {
                            return (
                              <div key={optIdx} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0" style={{ borderColor: theme.borderInputColor }}>
                                <div className="flex-1">
                                  <span className="text-sm" style={{ color: theme.text }}>{opt.name}</span>
                                  {opt.price > 0 && <span className="text-[10px] ml-1" style={{ color: theme.primary }}>+{formatCurrency(opt.price)}</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button className="w-7 h-7 rounded-full border flex items-center justify-center" style={{ borderColor: theme.borderInputColor, color: theme.textMuted }}><Minus className="w-3 h-3" /></button>
                                  <span className="w-5 text-center text-sm font-medium" style={{ color: theme.text }}>0</span>
                                  <button className="w-7 h-7 rounded-full border text-white flex items-center justify-center" style={{ borderColor: theme.primary, backgroundColor: theme.primary }}><Plus className="w-3 h-3" /></button>
                                </div>
                              </div>
                            )
                          }
                          return (
                            <label key={optIdx} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0 cursor-pointer" style={{ borderColor: theme.borderInputColor }}>
                              <div className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: theme.borderInputColor }}></div>
                                <span className="text-sm" style={{ color: theme.text }}>{opt.name}</span>
                              </div>
                              {opt.price > 0 && <span className="text-xs font-medium" style={{ color: theme.primary }}>+{formatCurrency(opt.price)}</span>}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
            <div className="px-5 pb-6 pt-2 border-t" style={{ borderColor: theme.borderInputColor }}>
              <button
                onClick={() => {
                  setCart((prev) => {
                    const existing = prev.find((item) => item.id === bottomSheetProduct.id)
                    if (existing) return prev.map((item) => item.id === bottomSheetProduct.id ? { ...item, quantity: item.quantity + 1 } : item)
                    return [...prev, { id: bottomSheetProduct.id, name: bottomSheetProduct.name, price: (bottomSheetProduct as any).promoPrice && (bottomSheetProduct as any).onSale ? (bottomSheetProduct as any).promoPrice : bottomSheetProduct.price, image: bottomSheetProduct.image, quantity: 1, additionalOptions: [] } as CartItem]
                  })
                  setBottomSheetProduct(null)
                  setAddedItemId(bottomSheetProduct.id)
                  setTimeout(() => setAddedItemId(null), 800)
                  setCartToast({ name: bottomSheetProduct.name, image: bottomSheetProduct.image || undefined })
                  setTimeout(() => setCartToast(null), 3000)
                }}
                className="w-full text-white font-bold py-3.5 rounded-xl text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                style={{ backgroundColor: theme.primary }}
              >
                <Plus className="w-5 h-5" />
                Adicionar ao pedido — {formatCurrency((bottomSheetProduct as any).promoPrice && (bottomSheetProduct as any).onSale ? (bottomSheetProduct as any).promoPrice : bottomSheetProduct.price)}
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
  trackingToken,
  paymentLink,
  total,
  theme,
  onClose,
  establishmentId,
  establishmentSlug,
  initialTab,
  mode,
  onPaymentSuccess,
  onPaymentConfirmed,
  paymentProvider,
  customerEmail,
}: {
  orderId: string
  trackingToken: string
  paymentLink: string
  total: number
  theme: any
  onClose: () => void
  establishmentId: string
  establishmentSlug: string
  initialTab?: "pix" | "card"
  mode?: "pix" | "card"
  onPaymentSuccess?: () => void
  onPaymentConfirmed?: () => void
  paymentProvider?: string
  customerEmail?: string
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
  const [cardEmail, setCardEmail] = useState(customerEmail || "")

  // Prefill email from customer data when modal opens
  useEffect(() => {
    if (customerEmail && !cardEmail) {
      setCardEmail(customerEmail)
    }
  }, [customerEmail])
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
          let qrEndpoint = "/api/payments/asaas/qr-code"
          if (paymentProvider === "inter") {
            qrEndpoint = "/api/payments/inter/qr-code"
          } else if (paymentProvider === "pagarme") {
            qrEndpoint = "/api/payments/pagarme/qr-code"
          }
          const res = await fetch(qrEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId, establishmentId }),
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
  }, [tab, orderId, paymentProvider])

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
          const res = await fetch(`/api/orders/${orderId}/payment-status?token=${trackingToken}`, { signal: controller.signal })
          if (res.ok) {
            const data = await res.json()
            if (data.paymentStatus === "paid") {
              console.log("[PaymentModal] Polling detected paid status, calling onPaymentConfirmed")
              setPaymentSuccess(true)
              setCardPending(false)
              onPaymentConfirmed?.()
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
      let cardEndpoint = "/api/payments/asaas/card"
      if (paymentProvider === "pagarme") {
        cardEndpoint = "/api/payments/pagarme/card"
      }
      const res = await fetch(cardEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          establishmentId,
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
        console.log("[Card] Payment confirmed, calling onPaymentConfirmed")
        setPaymentSuccess(true)
        onPaymentConfirmed?.()
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

function ProductCard({ product, onAdd, theme, disabled, isAdded, onSelect }: { product: Product; onAdd: (p: Product) => void; theme: { primary: string; bgCard: string; bgCardHover: string; borderCard: string; borderCardHover: string; text: string; textMuted: string; shadowPrimary: string }; disabled?: boolean; isAdded?: boolean; onSelect?: (p: Product) => void }) {
  const hasPromo = (product as any).promoPrice && (product as any).onSale
  const hasFeaturedDiscount = (product as any).featured && (product as any).featuredDiscountPrice && !(product as any).onSale
  const hasDiscount = hasPromo || hasFeaturedDiscount
  const discountPrice = hasPromo ? (product as any).promoPrice : hasFeaturedDiscount ? (product as any).featuredDiscountPrice : null
  const discountPct = hasDiscount && discountPrice ? Math.round((1 - discountPrice / product.price) * 100) : 0
  const isCustomBadge = (product as any).badge && !["mais_vendido", "novo", "promoção"].includes((product as any).badge)
  return (
    <div
      className={`rounded-2xl overflow-hidden transition-all duration-300 ${disabled ? "opacity-50" : ""}`}
      style={{ backgroundColor: theme.bgCard, borderWidth: 1, borderStyle: "solid", borderColor: isAdded ? theme.primary : theme.borderCard, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
      onClick={() => onSelect?.(product)}
    >
      <div className="relative">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className={`w-full h-32 object-cover transition-transform duration-300 ${isAdded ? "scale-105" : ""}`}
            onMouseEnter={(e) => ((product as any).zoomEnabled ? e.currentTarget.style.transform = "scale(1.1)" : null)}
            onMouseLeave={(e) => (e.currentTarget.style.transform = isAdded ? "scale(1.05)" : "scale(1)")}
          />
        ) : (
          <div className={`w-full h-32 flex items-center justify-center transition-transform duration-300 ${isAdded ? "scale-105" : ""}`} style={{ backgroundColor: theme.bgCardHover }}>
            <svg className="h-8 w-8" style={{ color: theme.textMuted }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          </div>
        )}
        {isCustomBadge && (
          <span className="absolute top-2 left-2 badge-fire text-[10px] font-bold text-white px-2.5 py-1 rounded-lg shadow-md flex items-center gap-1">
            <span>⭐</span><span>{(product as any).badge}</span>
          </span>
        )}
        {!isCustomBadge && product.badge && product.badge === "mais_vendido" && (
          <span className="absolute top-2 left-2 badge-fire text-[10px] font-bold text-white px-2.5 py-1 rounded-lg shadow-md flex items-center gap-1">
            <span>🔥</span><span>Mais Pedido</span>
          </span>
        )}
        {!isCustomBadge && product.badge && product.badge === "novo" && (
          <span className="absolute top-2 left-2 badge-fire text-[10px] font-bold text-white px-2.5 py-1 rounded-lg shadow-md flex items-center gap-1">
            <span>✨</span><span>Novo</span>
          </span>
        )}
        {hasDiscount && discountPct > 0 && (
          <span className="absolute top-2 right-2 text-[11px] font-bold text-white px-2 py-1 rounded-lg shadow-md bg-green-500">
            {discountPct}% OFF
          </span>
        )}
      </div>
      <div className="p-2.5">
        <h3 className="font-semibold text-xs leading-tight" style={{ color: theme.text }}>{product.name}</h3>
        {product.description && (
          <p className="mt-0.5 text-[10px] line-clamp-1" style={{ color: theme.textMuted }}>{product.description}</p>
        )}
        <div className="flex items-end justify-between mt-2">
          <div className="flex flex-col">
            {hasDiscount && (
              <span className="text-xs line-through" style={{ color: theme.textMuted }}>{formatCurrency(product.price)}</span>
            )}
            <p className="font-bold text-sm" style={{ color: hasDiscount ? "#22c55e" : theme.primary }}>
              {hasDiscount ? formatCurrency(discountPrice) : formatCurrency(product.price)}
            </p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(product); }}
            aria-label={`Adicionar ${product.name} ao carrinho`}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-white transition-all duration-200 active:scale-90 ${isAdded ? "animate-bounce-once" : ""}`}
            style={{
              backgroundColor: isAdded ? "#22c55e" : theme.primary,
              boxShadow: isAdded ? "0 0 20px rgba(34,197,94,0.5)" : `0 2px 8px ${theme.shadowPrimary}`,
            }}
            disabled={disabled}
          >
            {isAdded ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
