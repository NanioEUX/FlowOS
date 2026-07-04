"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, X, Minus, Plus, Trash2, Banknote, CreditCard, DollarSign, CheckCircle, LogOut, TrendingUp, Clock, Store, ShoppingBag, ArrowLeft, Package, Bike, MapPin, MessageCircle, ExternalLink, Printer, Sun, Moon, Users, MinusCircle, Eye, EyeOff, PlusCircle } from "lucide-react"
import { fetchAuth } from "@/lib/fetch-auth"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { useToast } from "@/components/toast"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { FlowOSLogo } from "@/components/flowos-logo"
import QRCode from "qrcode"

const ALL_PERMISSIONS = [
  { value: "dashboard", label: "Dashboard" },
  { value: "caixa", label: "Caixa" },
  { value: "pedidos", label: "Pedidos" },
  { value: "clientes", label: "Clientes" },
  { value: "cardapio", label: "Cardápio" },
  { value: "estoque", label: "Estoque" },
  { value: "entregas", label: "Entregas" },
  { value: "relatorios", label: "Relatórios" },
  { value: "config", label: "Configurações" },
  { value: "usuarios", label: "Usuários" },
]

interface UserData {
  id: string
  name: string
  email: string
  role: string
  permissions: string[]
  canCloseRegister?: boolean
  establishmentId: string
  establishment?: { id: string; name: string; slug: string; logo: string | null; description: string | null }
}

interface Product {
  id: string
  name: string
  price: number
  image: string | null
  categoryId: string
  categoryName?: string
  sendToPrep?: boolean
}

interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
}

interface TableData {
  cart: CartItem[]
  name?: string
  participants?: any[]
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

export default function CaixaPOSPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState<UserData | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [activeCategory, setActiveCategory] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [stagingCart, setStagingCart] = useState<CartItem[]>([])
  const [payment, setPayment] = useState("cash")
  const [closing, setClosing] = useState(false)
  const [todayStats, setTodayStats] = useState({ count: 0, total: 0 })
  const [currentTime, setCurrentTime] = useState("")
  const [customName, setCustomName] = useState("")
  const [customPrice, setCustomPrice] = useState("")
  const [showCustomItemModal, setShowCustomItemModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cashRegister, setCashRegister] = useState<any>(null)
  const [printReceipt, setPrintReceipt] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pedefacil-print-receipt") !== "false"
    }
    return true
  })
  const [lastOrder, setLastOrder] = useState<any>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [activeTab, setActiveTab] = useState<"caixa" | "mesas" | "balcao" | "pedidos">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("pedefacil-caixa-tab") as any) || "caixa"
    }
    return "caixa"
  })
  const [orders, setOrders] = useState<any[]>([])
  const [deliveryPeople, setDeliveryPeople] = useState<any[]>([])
  const [activeTable, setActiveTable] = useState<number | null>(null)
  const [tableData, setTableData] = useState<Record<number, TableData>>({})
  const [showCashRegisterModal, setShowCashRegisterModal] = useState(false)
  const [cashRegisterAction, setCashRegisterAction] = useState<"open" | "close" | "transfer">("open")
  const [openingAmount, setOpeningAmount] = useState("")
  const [closingAmount, setClosingAmount] = useState("")
  const [transferUserId, setTransferUserId] = useState("")
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [closingTableModal, setClosingTableModal] = useState(false)
  const [closingTableNumber, setClosingTableNumber] = useState<number | null>(null)
  const [closingTablePayment, setClosingTablePayment] = useState("cash")
  const [closingTableCart, setClosingTableCart] = useState<any[]>([])
  const [allTableItems, setAllTableItems] = useState<any[]>([])
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pedefacil-caixa-theme") !== "light"
    }
    return true
  })
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void; confirmed: boolean; successTitle: string; successMessage: string }>({ open: false, title: "", message: "", onConfirm: () => {}, confirmed: false, successTitle: "", successMessage: "" })
  const [tableCount, setTableCount] = useState(10)
  const [serviceTaxConfig, setServiceTaxConfig] = useState<{ enabled: boolean; type: string; value: number; presencial: boolean }>({ enabled: false, type: "percent", value: 10, presencial: true })
  const [lastClosedOrder, setLastClosedOrder] = useState<{ cart: any[]; tableLabel: string; total: number; orderNumber?: number; createdAt?: string } | null>(null)

  // Close table modal states
  const [closeTableMode, setCloseTableMode] = useState<"single" | "split" | "custom">("single")
  const [splitCount, setSplitCount] = useState("")
  const [customPayments, setCustomPayments] = useState<{ amount: string; method: string }[]>([{ amount: "", method: "cash" }])
  // Abater (partial payment without closing)
  const [abaterModal, setAbaterModal] = useState<number | null>(null)
  const [abaterAmount, setAbaterAmount] = useState("")
  const [abaterMethod, setAbaterMethod] = useState("cash")
  const [tablePartialPaid, setTablePartialPaid] = useState<Record<number, number>>({})
  const [paymentRequests, setPaymentRequests] = useState<any[]>([])
  const [showStaffQr, setShowStaffQr] = useState(false)
  const [staffQrImage, setStaffQrImage] = useState<string | null>(null)
  // "Cada um paga" states
  const [eachPersonStep, setEachPersonStep] = useState(0)
  const [eachPersonSelections, setEachPersonSelections] = useState<Record<number, Record<number, number>>>({})
  const [eachPersonPixUrl, setEachPersonPixUrl] = useState<string | null>(null)
  const [eachPersonGenerating, setEachPersonGenerating] = useState(false)
  // "Dividir" sequential states
  const [splitPersonStep, setSplitPersonStep] = useState(0)

  useEffect(() => {
    localStorage.setItem("pedefacil-caixa-theme", darkMode ? "dark" : "light")
  }, [darkMode])

  // Load table state from localStorage
  useEffect(() => {
    if (!user?.establishmentId) return
    const saved = localStorage.getItem(`pedefacil-tables-${user.establishmentId}`)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Ensure every table entry has participants array (guard against old data)
        const rawTableData: Record<number, TableData> = parsed.tableData || {}
        const sanitizedTableData: Record<number, TableData> = {}
        for (const key of Object.keys(rawTableData)) {
          const entry = rawTableData[Number(key)]
          sanitizedTableData[Number(key)] = {
            ...entry,
            cart: entry.cart || [],
            participants: entry.participants || [],
          }
        }
        setTableData(sanitizedTableData)
        setActiveTable(parsed.activeTable || null)
        setCart(parsed.activeCart || [])
        setStagingCart(parsed.stagingCart || [])
      } catch {}
    }
  }, [user?.establishmentId])

  // Save table state to localStorage
  useEffect(() => {
    if (!user?.establishmentId) return
    localStorage.setItem(`pedefacil-tables-${user.establishmentId}`, JSON.stringify({
      tableData,
      activeTable,
      activeCart: cart,
      stagingCart,
    }))
  }, [tableData, activeTable, cart, stagingCart, user?.establishmentId])

  useEffect(() => {
    localStorage.setItem("pedefacil-caixa-tab", activeTab)
  }, [activeTab])

  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
        " " +
        now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      )
    }
    updateClock()
    const interval = setInterval(updateClock, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem("pedefacil-user")
    if (!stored) {
      router.push("/login")
      return
    }
    const userData = JSON.parse(stored)
    if (!userData.permissions?.includes("caixa")) {
      router.push("/dashboard/pedidos")
      return
    }
    setUser(userData)
    loadData(userData.establishmentId)

    const refreshInterval = setInterval(() => {
      refreshOrders(userData.establishmentId)
    }, 10000)

    function handleStorage(e: StorageEvent) {
      if (e.key === "pedefacil-last-action" && e.newValue) {
        loadData(userData.establishmentId)
      }
    }
    window.addEventListener("storage", handleStorage)
    return () => {
      clearInterval(refreshInterval)
      window.removeEventListener("storage", handleStorage)
    }
  }, [router])

  async function generateStaffQr() {
    if (!user?.establishment?.slug) return
    const url = `${window.location.origin}/${user.establishment.slug}/staff`
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: "#000000", light: "#ffffff" } })
      setStaffQrImage(dataUrl)
      setShowStaffQr(true)
    } catch {}
  }

  async function refreshOrders(establishmentId: string) {
    try {
      const [ordersRes, paymentRes] = await Promise.all([
        fetchAuth(`/api/orders?establishmentId=${establishmentId}`),
        fetchAuth(`/api/payment-request?establishmentId=${establishmentId}`),
      ])
      if (ordersRes.ok) {
        const allOrders = await ordersRes.json()
        setOrders(allOrders)
        const today = new Date().toDateString()
        const todayOrders = allOrders.filter((o: any) => {
          const d = new Date(o.createdAt)
          return d.toDateString() === today && o.status !== "cancelled" && o.orderType === "presencial"
        })
        setTodayStats({
          count: todayOrders.length,
          total: todayOrders.reduce((s: number, o: any) => s + o.total, 0),
        })
      }
      if (paymentRes.ok) {
        const requests = await paymentRes.json()
        setPaymentRequests(requests)
      }
    } catch {}
  }

  async function loadData(establishmentId: string) {
    const promises: Promise<any>[] = [
      fetchAuth(`/api/categories?establishmentId=${establishmentId}`),
      fetchAuth(`/api/orders?establishmentId=${establishmentId}`),
      fetchAuth(`/api/cash-register?establishmentId=${establishmentId}`),
      fetchAuth(`/api/users?establishmentId=${establishmentId}`),
      fetchAuth(`/api/establishments/${establishmentId}`),
    ]
    if (user?.permissions?.includes("pedidos") || user?.permissions?.includes("entregas")) {
      promises.push(fetchAuth(`/api/delivery-persons?establishmentId=${establishmentId}`))
    }
    const results = await Promise.all(promises)
    const [catRes, orderRes, regRes, usersRes, estRes] = results
    const dpRes = results[5]
    const regData = await regRes.json()
    setCashRegister(regData)
    if (usersRes.ok) {
      setAllUsers(await usersRes.json())
    }
    if (catRes.ok) {
      const cats = await catRes.json()
      const allProducts: Product[] = []
      const catsList: { id: string; name: string }[] = []
      for (const cat of cats) {
        catsList.push({ id: cat.id, name: cat.name })
        for (const p of cat.products) {
          allProducts.push({ ...p, categoryName: cat.name })
        }
      }
      setProducts(allProducts)
      setCategories(catsList)
    }
    if (orderRes.ok) {
      const allOrders = await orderRes.json()
      setOrders(allOrders)
      const today = new Date().toDateString()
      const todayOrders = allOrders.filter((o: any) => {
        const d = new Date(o.createdAt)
        return d.toDateString() === today && o.status !== "cancelled" && o.orderType === "presencial"
      })
      setTodayStats({
        count: todayOrders.length,
        total: todayOrders.reduce((s: number, o: any) => s + o.total, 0),
      })
    }
    if (dpRes?.ok) {
      setDeliveryPeople(await dpRes.json())
    }
    if (estRes?.ok) {
      const est = await estRes.json()
      if (est.tableCount) setTableCount(est.tableCount)
      if (est.orderConfig) {
        try {
          const oc = JSON.parse(est.orderConfig)
          setServiceTaxConfig({
            enabled: oc.serviceTaxEnabled || false,
            type: oc.serviceTaxType || "percent",
            value: oc.serviceTaxValue || 10,
            presencial: oc.serviceTaxPresencial !== false,
          })
        } catch {}
      }
    }
    // Load partial payments from API
    try {
      const ppRes = await fetchAuth(`/api/partial-payment?establishmentId=${establishmentId}`)
      if (ppRes.ok) {
        const ppData = await ppRes.json()
        const ppMap: Record<number, number> = {}
        for (const pp of ppData) {
          ppMap[pp.tableNumber] = (ppMap[pp.tableNumber] || 0) + pp.amount
        }
        setTablePartialPaid(ppMap)
      }
    } catch {}
    setLoading(false)
  }

  const filteredProducts = products.filter((p) => {
    if (searchQuery) {
      return p.name.toLowerCase().includes(searchQuery.toLowerCase())
    }
    if (activeCategory === "all") return true
    return p.categoryId === activeCategory
  })

  function addToCart(product: Product) {
    setStagingCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) {
        return prev.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1 }]
    })
    setLastClosedOrder(null)
  }

  function addCustomItem() {
    if (!customName || !customPrice) return
    setStagingCart((prev) => [...prev, { productId: "custom-" + Date.now(), name: customName, price: Number(customPrice), quantity: 1 }])
    setCustomName("")
    setCustomPrice("")
  }

  function updateQuantity(productId: string, delta: number) {
    setStagingCart((prev) => prev.map((i) => {
      if (i.productId !== productId) return i
      const newQty = i.quantity + delta
      return newQty > 0 ? { ...i, quantity: newQty } : i
    }).filter((i) => i.quantity > 0))
  }

  function removeItem(productId: string) {
    setStagingCart((prev) => prev.filter((i) => i.productId !== productId))
  }

  function selectTable(num: number) {
    if (activeTable !== null && activeTable !== num) {
      setTableData((prev) => ({ ...prev, [activeTable]: { ...prev[activeTable], cart } }))
    }
    setActiveTable(num)
    setCart(tableData[num]?.cart || [])
    setStagingCart([])
    setLastClosedOrder(null)
  }

  function getNextAvailableTable(): number {
    const usedNums = Object.keys(tableData).map(Number)
    for (let i = 1; i <= tableCount; i++) {
      if (!usedNums.includes(i)) return i
    }
    return 1
  }

  function closeTable(num: number, gridCart?: any[]) {
    const tableOrders = orders.filter((o: any) => o.tableNumber === num && o.orderType === "presencial" && !["delivered", "cancelled"].includes(o.status))
    const currentCart = gridCart || tableData[num]?.cart || []
    
    const cartTotal = currentCart.reduce((s, i) => s + i.price * i.quantity, 0)
    const ordersTotal = tableOrders.reduce((s: number, o: any) => s + o.total, 0)
    const total = cartTotal + ordersTotal

    if (tableOrders.length > 0 || currentCart.length > 0) {
      // closingTableCart = only local cart items (for creating order at close)
      setClosingTableCart(currentCart)
      // allTableItems = order items + cart items (for display & "Cada um paga" selection)
      const orderItems: any[] = []
      for (const o of tableOrders) {
        try {
          const items = typeof o.items === "string" ? JSON.parse(o.items) : o.items
          for (const item of items) {
            orderItems.push({ ...item, orderId: o.id })
          }
        } catch {}
      }
      setAllTableItems([...orderItems, ...currentCart])
      setClosingTableNumber(num)
      setClosingTablePayment("cash")
      setClosingTableModal(true)
      return
    }
    
    // Empty table - just clear it
    setTableData((prev) => {
      const next = { ...prev }
      delete next[num]
      return next
    })
    if (activeTable === num) {
      setActiveTable(null)
      setCart([])
    }
  }

  async function handleCloseTable() {
    if (!closingTableNumber || !user?.establishmentId) return
    // Determine effective payment method for the API
    let paymentMethod = closingTablePayment
    if (closeTableMode === "custom" && customPayments.length > 0) {
      paymentMethod = customPayments[0].method
    }
    // Calculate service tax
    const subtotal = closingTableCart.reduce((s, i) => s + i.price * i.quantity, 0)
    const ordersTotal = orders
      .filter((o: any) => o.tableNumber === closingTableNumber && o.orderType === "presencial" && !["delivered", "cancelled"].includes(o.status))
      .reduce((s: number, o: any) => s + o.total, 0)
    const combinedSubtotal = subtotal + ordersTotal
    const serviceTaxAmount = serviceTaxConfig.enabled && serviceTaxConfig.presencial
      ? serviceTaxConfig.type === "percent"
        ? combinedSubtotal * (serviceTaxConfig.value / 100)
        : serviceTaxConfig.value
      : 0
    try {
      const res = await fetchAuth("/api/cash-register/close-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber: closingTableNumber,
          establishmentId: user.establishmentId,
          paymentMethod,
          cartItems: closingTableCart,
          customerName: `Mesa ${closingTableNumber}`,
          serviceTax: serviceTaxAmount,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        // Delete partial payments from API for this table
        try {
          await fetchAuth(`/api/partial-payment?establishmentId=${user!.establishmentId}&tableNumber=${closingTableNumber}`, {
            method: "DELETE",
          })
        } catch {}
        // Clear partial paid record for this table
        setTablePartialPaid(prev => {
          const next = { ...prev }
          delete next[closingTableNumber!]
          return next
        })
        setTableData((prev) => {
          const next = { ...prev }
          delete next[closingTableNumber!]
          return next
        })
        if (activeTable === closingTableNumber) {
          setActiveTable(null)
          setCart([])
        }
        setClosingTableModal(false)
        setClosingTableNumber(null)
        setClosingTableCart([])
        setCloseTableMode("single")
        setSplitCount("")
        setCustomPayments([{ amount: "", method: "cash" }])
        toast(`Mesa fechada! ${data.ordersClosed} pedido(s) — ${formatCurrency(data.total)}`, "success")
        loadData(user.establishmentId)
      } else {
        toast(data.error || "Erro ao fechar mesa", "error")
      }
    } catch (err) {
      console.error(err)
      toast("Erro ao fechar mesa", "error")
    }
  }

  function deselectTable() {
    if (activeTable !== null) {
      setTableData((prev) => ({ ...prev, [activeTable]: { ...prev[activeTable], cart } }))
    }
    setActiveTable(null)
    setLastClosedOrder(null)
    setCart([])
    setStagingCart([])
  }

  // ========== ABATER / CLOSE TABLE HELPERS ==========

  function openAbater(tableNum: number) {
    setAbaterModal(tableNum)
    setAbaterAmount("")
    setAbaterMethod("cash")
  }

  async function processAbater() {
    if (!abaterModal || !user?.establishmentId) return
    const amount = parseFloat(abaterAmount)
    if (isNaN(amount) || amount <= 0) return
    const tableTotal = getTableTotal(abaterModal)
    const alreadyPaid = tablePartialPaid[abaterModal] || 0
    if (amount > tableTotal - alreadyPaid) {
      toast("Valor excede o restante da conta", "error")
      return
    }
    try {
      // Save to API
      await fetchAuth("/api/partial-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          establishmentId: user.establishmentId,
          tableNumber: abaterModal,
          amount,
          paymentMethod: abaterMethod,
        }),
      })
      // Record cash movement
      if (cashRegister) {
        await fetchAuth(`/api/cash-register/${cashRegister.id}/movements`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "sale",
            amount,
            description: `Abatimento - Mesa ${abaterModal}`,
            paymentMethod: abaterMethod,
          }),
        })
      }
      const updated = { ...tablePartialPaid, [abaterModal]: (tablePartialPaid[abaterModal] || 0) + amount }
      setTablePartialPaid(updated)
      toast(`Abatimento de ${formatCurrency(amount)} registrado`, "success")
      setAbaterModal(null)
      setAbaterAmount("")
    } catch (err) {
      console.error(err)
      toast("Erro ao registrar abatimento", "error")
    }
  }

  function getTableTotal(tableNum: number): number {
    const data = tableData[tableNum] || { cart: [], participants: [] }
    const cartTotal = data.cart.reduce((s, i) => s + i.price * i.quantity, 0)
    const ordersTotal = orders
      .filter((o: any) => o.tableNumber === tableNum && o.orderType === "presencial" && !["delivered", "cancelled"].includes(o.status))
      .reduce((s: number, o: any) => s + o.total, 0)
    const subtotal = cartTotal + ordersTotal
    const serviceTax = serviceTaxConfig.enabled && serviceTaxConfig.presencial
      ? serviceTaxConfig.type === "percent"
        ? subtotal * (serviceTaxConfig.value / 100)
        : serviceTaxConfig.value
      : 0
    return subtotal + serviceTax
  }

  function getTableRemaining(tableNum: number): number {
    return getTableTotal(tableNum) - (tablePartialPaid[tableNum] || 0)
  }

  const cartTotal = stagingCart.reduce((s, i) => s + i.price * i.quantity, 0)
  const committedTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)

  function mergeStagingIntoCart(): CartItem[] {
    const merged = [...cart]
    for (const item of stagingCart) {
      const existing = merged.find((i) => i.productId === item.productId)
      if (existing) {
        merged.push({ ...item, quantity: existing.quantity + item.quantity })
        merged.splice(merged.indexOf(existing), 1)
      } else {
        merged.push(item)
      }
    }
    return merged
  }

  const needsPrep = (() => {
    const allItems = activeTable ? mergeStagingIntoCart() : stagingCart
    return allItems.some((item) => {
      const product = products.find((p) => p.id === item.productId)
      return product?.sendToPrep === true
    })
  })()

  async function finalizeSale() {
    if (!user?.establishmentId || stagingCart.length === 0) return
    const establishmentId = user.establishmentId
    const isMesa = activeTable !== null
    const tableLabel = isMesa ? `Mesa ${activeTable}` : "Balcão"
    const mergedCart = isMesa ? mergeStagingIntoCart() : stagingCart
    const total = mergedCart.reduce((s, i) => s + i.price * i.quantity, 0)

    if (isMesa) {
      setConfirmDialog({
        open: true,
        title: `Adicionar pedido à ${tableLabel}`,
        message: `${mergedCart.length} itens — ${formatCurrency(total)}`,
        onConfirm: () => { setConfirmDialog((prev) => ({ ...prev, confirmed: true })); executeSale(isMesa, tableLabel, mergedCart, total) },
        confirmed: false,
        successTitle: "",
        successMessage: "",
      })
    } else {
      setConfirmDialog({
        open: true,
        title: `Finalizar venda ${tableLabel}`,
        message: `Total: ${formatCurrency(total)}`,
        onConfirm: () => { setConfirmDialog((prev) => ({ ...prev, confirmed: true })); executeSale(isMesa, tableLabel, mergedCart, total) },
        confirmed: false,
        successTitle: "",
        successMessage: "",
      })
    }
  }

  async function executeSale(isMesa: boolean, tableLabel: string, saleCart: CartItem[], saleTotal: number) {
    if (!user?.establishmentId) return
    const establishmentId = user.establishmentId
    setClosing(true)
    try {
      const savedCart = [...saleCart]
      const savedTotal = saleTotal
      const savedNeedsPrep = saleCart.some((item) => {
        const product = products.find((p) => p.id === item.productId)
        return product?.sendToPrep === true
      })

      // For mesa: clear tableData cart (order is now in orders via API)
      if (isMesa && activeTable !== null) {
        setTableData((prev) => ({ ...prev, [activeTable]: { ...prev[activeTable], cart: [] } }))
      }
      setCart([])
      setStagingCart([])

      const tempId = `temp-${Date.now()}`
      const tempOrder = {
        id: tempId,
        orderNumber: Math.floor(Math.random() * 9000) + 1000,
        establishmentId: establishmentId,
        customerName: tableLabel,
        items: JSON.stringify(savedCart),
        total: savedTotal,
        orderType: "presencial",
        paymentMethod: isMesa ? "pending" : payment,
        method: "caixa",
        status: savedNeedsPrep ? "preparing" : (isMesa ? "new" : "delivered"),
        tableNumber: activeTable,
        createdAt: new Date().toISOString(),
        deliveredAt: savedNeedsPrep ? null : (isMesa ? null : new Date().toISOString()),
      }
      if (savedNeedsPrep || isMesa) {
        setOrders((prev) => [tempOrder, ...prev])
      }

      const res = await fetchAuth("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          establishmentId: establishmentId,
          customerName: tableLabel,
          items: JSON.stringify(savedCart),
          total: savedTotal,
          orderType: "presencial",
          paymentMethod: isMesa ? "pending" : payment,
          method: "caixa",
          status: savedNeedsPrep ? "preparing" : (isMesa ? "new" : "delivered"),
          tableNumber: activeTable,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        console.error("Erro ao criar pedido:", data)
        setOrders((prev) => prev.filter((o) => o.id !== tempId))
        if (isMesa) setCart(savedCart)
        else setStagingCart(savedCart)
        alert(data.error || "Erro ao criar pedido")
        return
      }

      if (!isMesa && cashRegister) {
        await fetchAuth(`/api/cash-register/${cashRegister.id}/movements`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "sale",
            amount: savedTotal,
            description: `Venda Balcão - ${payment === "cash" ? "Dinheiro" : payment === "card" ? "Cartão" : "Pix"}`,
            paymentMethod: payment,
          }),
        })
      }

      const orderData = data.order
      if (!orderData) {
        console.error("Pedido criado mas dados não retornados:", data)
        alert("Pedido registrado, mas houve um erro ao exibir. Atualize a página.")
      loadData(establishmentId)
      window.dispatchEvent(new Event("stock-updated"))

      if (data.lowStockItems && data.lowStockItems.length > 0) {
        const names = data.lowStockItems.map((i: any) => `${i.name} (${i.quantity <= 0 ? "zerado" : i.quantity + " " + (i.quantity === 1 ? "un" : "un")})`).join(", ")
        setTimeout(() => {
          toast(`Estoque baixo: ${names}`, "warning")
        }, 3000)
      }
        setCart([])
        if (!isMesa) setActiveTable(null)
        return
      }

      setLastOrder({ ...orderData, items: savedCart, establishmentName: user?.establishment?.name })

      setOrders((prev) => prev.map((o) => o.id === tempId ? orderData : o))
      if (!savedNeedsPrep && !isMesa) {
        setOrders((prev) => [orderData, ...prev])
      }

      localStorage.setItem("pedefacil-last-action", JSON.stringify({ type: "order-created", ts: Date.now() }))

      // Save cart before clearing for "view closed order" feature (only for balcão)
      if (!isMesa) {
        setLastClosedOrder({
          cart: savedCart,
          tableLabel,
          total: savedTotal,
          orderNumber: orderData.orderNumber,
          createdAt: orderData.createdAt,
        })
      }

      if (!isMesa) {
        setActiveTable(null)
      }

      const successMsg = isMesa
        ? (savedNeedsPrep ? "Pedido adicionado e enviado para preparo!" : "Pedido adicionado à mesa!")
        : (savedNeedsPrep ? "Pedido enviado para preparo!" : "Venda registrada!")
      const successSub = isMesa && savedNeedsPrep ? "Acompanhe no módulo Pedidos" : `Pedido #${orderData.orderNumber || orderData.id?.slice(0, 8)}`

      setConfirmDialog((prev) => ({
        ...prev,
        confirmed: true,
        successTitle: successMsg,
        successMessage: successSub,
      }))

      setTimeout(() => {
        setConfirmDialog({ open: false, title: "", message: "", onConfirm: () => {}, confirmed: false, successTitle: "", successMessage: "" })
        if (!isMesa && printReceipt && orderData) {
          setShowReceipt(true)
        }
      }, 2500)

      loadData(establishmentId)
    } catch (err) {
      console.error(err)
    } finally {
      setClosing(false)
    }
  }

  function printReceiptPopup(order: any) {
    const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`
    const paymentLabels: Record<string, string> = { cash: "Dinheiro", card: "Cartão", pix: "Pix" }
    const win = window.open("", "_blank")
    if (!win) return
    win.document.write(`
      <html>
      <head>
        <title>Pedido #${order.orderNumber || order.id.slice(0, 8)}</title>
        <style>
          @page { margin: 0; }
          body { font-family: 'Courier New', monospace; font-size: 12px; padding: 20px; color: #000; max-width: 300px; margin: 0 auto; }
          h1 { font-size: 16px; text-align: center; margin: 0 0 4px; }
          h2 { font-size: 14px; text-align: center; margin: 0 0 12px; font-weight: normal; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 2px 0; }
          .right { text-align: right; }
          .total { font-size: 14px; font-weight: bold; }
          .footer { text-align: center; margin-top: 12px; font-size: 10px; }
          .order-number { font-size: 24px; font-weight: bold; text-align: center; margin: 8px 0; }
        </style>
      </head>
      <body>
        <h1>${order.establishmentName || "Estabelecimento"}</h1>
        <h2>--- CUPOM ---</h2>
        <div class="order-number">Pedido #${order.orderNumber || order.id.slice(0, 8)}</div>
        <p>${new Date(order.createdAt).toLocaleString("pt-BR")}</p>
        <div class="divider"></div>
        <p><strong>Pagamento:</strong> ${paymentLabels[order.paymentMethod] || order.paymentMethod}</p>
        <div class="divider"></div>
        <table>
          <tr><td><strong>Item</strong></td><td class="right"><strong>Qtd</strong></td><td class="right"><strong>Valor</strong></td></tr>
          ${order.items.map((item: any) => `<tr><td>${item.name}</td><td class="right">${item.quantity}x</td><td class="right">${fmt(item.price * item.quantity)}</td></tr>`).join("")}
        </table>
        <div class="divider"></div>
        <p class="total right">Total: ${fmt(order.total)}</p>
        <div class="divider"></div>
        <p class="footer">Obrigado pela preferência!</p>
      </body>
      </html>
    `)
    win.document.close()
    win.focus()
    win.print()
    win.close()
  }

  async function openCashRegister() {
    if (!user?.establishmentId) return
    try {
      const res = await fetchAuth("/api/cash-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          establishmentId: user.establishmentId,
          openingAmount: parseFloat(openingAmount) || 0,
          notes: `Aberto por ${user.name}`,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setCashRegister(data)
        setShowCashRegisterModal(false)
        setOpeningAmount("")
        loadData(user.establishmentId)
        toast("Caixa aberto com sucesso", "success")
      } else {
        const data = await res.json()
        toast(data.error || "Erro ao abrir caixa", "error")
      }
    } catch (err) {
      console.error(err)
      toast("Erro ao abrir caixa", "error")
    }
  }

  async function closeCashRegister() {
    if (!cashRegister || !user?.establishmentId) return
    try {
      const movements = cashRegister.movements || []
      const totalMovements = movements.reduce((sum: number, m: any) => sum + m.amount, 0)
      const expected = cashRegister.openingAmount + totalMovements
      await fetchAuth(`/api/cash-register/${cashRegister.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closingAmount: parseFloat(closingAmount) || expected,
          notes: `Fechado por ${user.name}`,
        }),
      })
      setCashRegister(null)
      setShowCashRegisterModal(false)
      setClosingAmount("")
      loadData(user.establishmentId)
      toast("Caixa fechado com sucesso", "success")
    } catch (err) {
      console.error(err)
      toast("Erro ao fechar caixa", "error")
    }
  }

  async function transferCashRegister() {
    if (!cashRegister || !transferUserId || !user?.establishmentId) return
    const toUser = allUsers.find((u: any) => u.id === transferUserId)
    setConfirmDialog({
      open: true,
      title: "Transferir caixa",
      message: `Transferir caixa para ${toUser?.name || "outro atendente"}? Você será desconectado.`,
      confirmed: false,
      successTitle: "",
      successMessage: "",
      onConfirm: async () => {
        setConfirmDialog({ open: false, title: "", message: "", onConfirm: () => {}, confirmed: false, successTitle: "", successMessage: "" })
        try {
          await fetchAuth(`/api/cash-register/${cashRegister.id}/transfer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              toUserId: transferUserId,
              amount: 0,
              notes: `Transferência de ${user.name}`,
            }),
          })
          setShowCashRegisterModal(false)
          setTransferUserId("")
          toast("Caixa transferido com sucesso", "success")
          handleLogout()
        } catch (err) {
          console.error(err)
          toast("Erro ao transferir caixa", "error")
        }
      }
    })
  }

  function handleLogout() {
    localStorage.removeItem("pedefacil-user")
    router.push("/login")
  }

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-100">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    )
  }

  const hasPedidos = user?.permissions?.includes("pedidos")
  const showTabs = hasPedidos

  const balcaoOrders = orders.filter((o: any) => o.orderType === "presencial" && ["preparing", "ready"].includes(o.status))
  const balcaoReadyCount = orders.filter((o: any) => o.orderType === "presencial" && o.status === "ready").length
  const externalOrders = orders.filter((o: any) => o.orderType !== "presencial" && ["preparing", "ready", "out_for_delivery"].includes(o.status))

  return (
    <div className={`flex h-screen flex-col overflow-hidden ${darkMode ? "bg-[#0d2137]" : "bg-zinc-100"}`}>
      {/* Header */}
      <div className={`flex h-14 items-center justify-between border-b px-4 lg:h-16 lg:px-8 ${darkMode ? "border-white/[.1] bg-[#1a3a5c]" : "border-zinc-200 bg-white"}`}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard/home")} className={`rounded-lg p-1 lg:hidden ${darkMode ? "hover:bg-[#1a3a5c]" : "hover:bg-zinc-100"}`}>
            <ArrowLeft className={`h-5 w-5 ${darkMode ? "text-white/70" : "text-zinc-600"}`} />
          </button>
          {user.establishment ? (
            <>
              {user.establishment.logo ? (
                <img src={user.establishment.logo} alt={user.establishment.name} className="h-8 w-8 rounded-lg object-cover" />
              ) : (
                <FlowOSLogo size={32} variant="icon" className="h-8 w-8" />
              )}
              <div className="min-w-0">
                <span className={`text-sm font-semibold ${darkMode ? "text-white" : "text-zinc-900"}`}>{user.establishment.name}</span>
                {user.establishment.description && (
                  <p className={`text-[10px] leading-tight ${darkMode ? "text-white/40" : "text-zinc-400"}`}>{user.establishment.description}</p>
                )}
              </div>
            </>
          ) : (
            <span className={`text-sm font-semibold ${darkMode ? "text-white" : "text-zinc-900"}`}>Caixa</span>
          )}
        </div>

        {cashRegister && (
          <div className="hidden items-center gap-3 lg:flex">
            <span className={`text-lg font-bold ${darkMode ? "text-white" : "text-zinc-900"}`}>{todayStats.count} vendas</span>
            <span className={`text-sm ${darkMode ? "text-white/40" : "text-white/50"}`}>·</span>
            <span className="text-lg font-bold text-green-500">{formatCurrency(todayStats.total)}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          {cashRegister ? (
            <>
              <span className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium lg:flex ${darkMode ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700"}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Caixa Aberto
              </span>
              <button
                onClick={() => { setCashRegisterAction("transfer"); setShowCashRegisterModal(true) }}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium ${darkMode ? "border-white/[.08] bg-[#1a3a5c] text-white/70 hover:bg-[#162e4a]" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"}`}
              >
                Transferir
              </button>
              {user?.canCloseRegister && (
                <button
                  onClick={() => { setCashRegisterAction("close"); setShowCashRegisterModal(true) }}
                  className="rounded-lg bg-red-500 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-red-600"
                >
                  Fechar Caixa
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => { setCashRegisterAction("open"); setShowCashRegisterModal(true) }}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-green-700"
            >
              Abrir Caixa
            </button>
          )}

          <div className={`h-4 w-px hidden lg:block ${darkMode ? "bg-[#162e4a]" : "bg-zinc-200"}`} />

          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`rounded-lg p-1.5 ${darkMode ? "text-white/50 hover:bg-[#1a3a5c] hover:text-white/90" : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"}`}
            title={darkMode ? "Tema claro" : "Tema escuro"}
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <span className={`hidden text-sm lg:block ${darkMode ? "text-white/50" : "text-white/40"}`}>{currentTime}</span>
          <div className="hidden items-center gap-1.5 lg:flex">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${darkMode ? "bg-green-900/40 text-green-400" : "bg-green-100 text-green-700"}`}>
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <span className={`font-medium ${darkMode ? "text-white/70" : "text-zinc-700"}`}>{user?.name}</span>
          </div>
          <button onClick={handleLogout} className={`rounded-lg p-1.5 ${darkMode ? "text-white/50 hover:bg-[#1a3a5c] hover:text-white/90" : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"}`}>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      {showTabs && (
        <div className={`flex border-b ${darkMode ? "border-white/[.1] bg-[#1a3a5c]" : "border-zinc-200 bg-white"}`}>
          <button
            onClick={() => setActiveTab("caixa")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "caixa"
                ? "border-b-2 border-green-500 text-green-600"
                : darkMode ? "text-white/50 hover:text-white/90" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <ShoppingBag className="h-5 w-5" />
              Caixa
            </div>
          </button>
          <button
            onClick={() => setActiveTab("mesas")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "mesas"
                ? "border-b-2 border-green-500 text-green-600"
                : darkMode ? "text-white/50 hover:text-white/90" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Users className="h-5 w-5" />
              Mesas
              {paymentRequests.length > 0 && (
                <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {paymentRequests.length}
                </span>
              )}
            </div>
          </button>
          {hasPedidos && (
            <button
              onClick={() => setActiveTab("balcao")}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "balcao"
                  ? "border-b-2 border-green-500 text-green-600"
                  : darkMode ? "text-white/50 hover:text-white/90" : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Store className="h-5 w-5" />
                Pedidos Balcão
                {balcaoReadyCount > 0 && (
                  <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white animate-pulse">
                    {balcaoReadyCount}
                  </span>
                )}
              </div>
            </button>
          )}
          {hasPedidos && (
            <button
              onClick={() => setActiveTab("pedidos")}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "pedidos"
                  ? "border-b-2 border-green-500 text-green-600"
                  : darkMode ? "text-white/50 hover:text-white/90" : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Package className="h-5 w-5" />
                Pedidos Externos
                {externalOrders.length > 0 && (
                  <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                    {externalOrders.length}
                  </span>
                )}
              </div>
            </button>
          )}
        </div>
      )}

      {/* Caixa Tab */}
      {activeTab === "caixa" && (
        <>
          {/* Search + Categories */}
          <div className={`px-4 py-2 shadow-sm ${darkMode ? "bg-[#1a3a5c]" : "bg-white"}`}>
            <div className="mb-2 flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${darkMode ? "text-white/40" : "text-zinc-400"}`} />
                <input
                  type="text"
                  placeholder="Buscar produto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full rounded-lg border py-2 pl-9 pr-8 text-sm focus:border-green-500 focus:outline-none ${darkMode ? "border-white/[.08] bg-[#0f2942] text-white placeholder:text-white/40" : "border-zinc-200 bg-zinc-50"}`}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className={`absolute right-3 top-1/2 -translate-y-1/2 ${darkMode ? "text-white/40" : "text-zinc-400"}`}>
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowCustomItemModal(true)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  darkMode ? "border-white/[.08] bg-[#0f2942] text-white/70 hover:bg-[#1a3a5c]" : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                <Plus className="h-4 w-4" />
                Avulso
              </button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
              <button
                onClick={() => setActiveCategory("all")}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  activeCategory === "all" ? "bg-green-600 text-white" : darkMode ? "bg-[#1a3a5c] text-white/70" : "bg-zinc-100 text-zinc-600"
                }`}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    activeCategory === cat.id ? "bg-green-600 text-white" : darkMode ? "bg-[#1a3a5c] text-white/70" : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto p-3">
              {!cashRegister && (
                <div className="mb-3 rounded-xl border-2 border-dashed border-yellow-400 bg-yellow-50 px-6 py-8 text-center">
                  <Banknote className="mx-auto mb-3 h-10 w-10 text-yellow-500" />
                  <p className="text-sm font-semibold text-yellow-800">Nenhum caixa aberto</p>
                  <p className="mt-1 text-xs text-yellow-600">Abra o caixa para começar a vender</p>
                  <button
                    onClick={() => { setCashRegisterAction("open"); setShowCashRegisterModal(true) }}
                    className="mt-4 rounded-xl bg-green-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-green-700 shadow-lg shadow-green-600/20"
                  >
                    Abrir Caixa
                  </button>
                </div>
              )}
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                  className={`flex flex-col items-center rounded-xl border p-4 transition-all hover:border-green-400 hover:shadow-md active:scale-95 ${darkMode ? "border-white/[.1] bg-[#1a3a5c]" : "border-zinc-200 bg-white"}`}
                >
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="mb-2 h-20 w-20 rounded-xl object-cover" />
                  ) : (
                    <div className={`mb-2 flex h-20 w-20 items-center justify-center rounded-xl text-3xl ${darkMode ? "bg-[#1a3a5c]" : "bg-zinc-100"}`}>🍕</div>
                    )}
                    <p className={`w-full truncate text-center text-sm font-medium ${darkMode ? "text-white/90" : "text-zinc-800"}`}>{product.name}</p>
                    <p className="text-sm font-bold text-green-600">{formatCurrency(product.price)}</p>
                  </button>
                ))}
                {filteredProducts.length === 0 && (
                  <div className={`col-span-full py-12 text-center text-sm ${darkMode ? "text-white/40" : "text-white/50"}`}>
                    Nenhum produto encontrado
                  </div>
                )}
              </div>

            </div>

            {/* Cart + Summary */}
            <div className={`flex w-80 flex-col border-l ${darkMode ? "border-white/[.1] bg-[#1a3a5c]" : "border-zinc-200 bg-white"}`}>
              {/* Cart Header */}
              <div className={`border-b px-4 py-2 ${
                activeTable
                  ? darkMode ? "border-amber-700 bg-amber-900/30" : "border-amber-200 bg-amber-50"
                  : darkMode ? "border-white/[.1] bg-[#1a3a5c]" : "border-zinc-100 bg-white"
              }`}>
                <div className="flex items-center justify-between">
                  <h2 className={`text-sm font-semibold ${
                    activeTable
                      ? darkMode ? "text-amber-200" : "text-amber-700"
                      : darkMode ? "text-green-200" : "text-green-700"
                  }`}>
                    {activeTable ? `Mesa ${activeTable}` : "Venda Balcão"}
                  </h2>
                  {activeTable !== null && (
                    <button
                      onClick={deselectTable}
                      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium ${darkMode ? "bg-[#1a3a5c] text-white/70 hover:bg-[#162e4a]" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
                    >
                      Venda Balcão
                    </button>
                  )}
                </div>
              </div>

              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto px-4 py-2">
                {(cart.length === 0 && stagingCart.length === 0) && lastClosedOrder ? (
                  <div className="space-y-3 py-3">
                    <button
                      onClick={() => printReceiptPopup({
                        orderNumber: lastClosedOrder.orderNumber,
                        id: lastClosedOrder.orderNumber?.toString() || "closed",
                        items: lastClosedOrder.cart,
                        total: lastClosedOrder.total,
                        customerName: lastClosedOrder.tableLabel,
                        createdAt: lastClosedOrder.createdAt,
                        paymentMethod: "cash",
                        establishmentName: user?.establishment?.name,
                      })}
                      className={`w-full rounded-lg border px-3 py-2 text-center transition-colors cursor-pointer ${darkMode ? "border-white/[.08] bg-[#1a3a5c]/50 hover:bg-[#1a3a5c] hover:border-zinc-500" : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100 hover:border-zinc-300"}`}
                    >
                      <CheckCircle className="mx-auto mb-1 h-5 w-5 text-green-500" />
                      <p className={`text-xs font-medium ${darkMode ? "text-white/90" : "text-zinc-700"}`}>
                        Pedido #{lastClosedOrder.orderNumber || "—"} enviado!
                      </p>
                      <p className={`text-[10px] ${darkMode ? "text-white/50" : "text-white/40"}`}>
                        {lastClosedOrder.tableLabel} • {formatCurrency(lastClosedOrder.total)}
                      </p>
                      <p className={`mt-1 text-[10px] ${darkMode ? "text-white/40" : "text-white/50"}`}>
                        Toque para reimprimir
                      </p>
                    </button>
                  </div>
                ) : stagingCart.length === 0 ? (
                  <div className={`flex flex-col items-center justify-center py-12 ${darkMode ? "text-white/40" : "text-white/50"}`}>
                    <ShoppingBag className="mb-2 h-8 w-8" />
                    <p className="text-xs">Toque nos produtos para adicionar</p>
                    {activeTable && committedTotal > 0 && (
                      <p className="mt-2 text-[10px] text-amber-500">Itens já adicionados à mesa. Toque no card da mesa para enviar mais.</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stagingCart.map((item) => (
                      <div key={item.productId} className={`flex items-center gap-2 rounded-lg p-2 ${darkMode ? "bg-[#1a3a5c]" : "bg-zinc-50"}`}>
                        <div className="flex-1 min-w-0">
                          <p className={`truncate text-xs font-medium ${darkMode ? "text-white" : "text-zinc-800"}`}>{item.name}</p>
                          <p className={`text-[10px] ${darkMode ? "text-white/50" : "text-white/40"}`}>{formatCurrency(item.price)} x {item.quantity}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateQuantity(item.productId, -1)}
                            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${darkMode ? "bg-[#162e4a] hover:bg-zinc-500" : "bg-zinc-200 hover:bg-zinc-300"}`}
                          >
                            <Minus className="h-2.5 w-2.5" />
                          </button>
                          <span className={`w-5 text-center text-xs font-medium ${darkMode ? "text-white/90" : ""}`}>{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.productId, 1)}
                            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${darkMode ? "bg-[#162e4a] hover:bg-zinc-500" : "bg-zinc-200 hover:bg-zinc-300"}`}
                          >
                            <Plus className="h-2.5 w-2.5" />
                          </button>
                          <button
                            onClick={() => removeItem(item.productId)}
                            className="ml-1 text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className={`border-t px-4 py-3 ${darkMode ? "border-white/[.1] bg-[#1a3a5c]" : "border-zinc-200 bg-zinc-50"}`}>
                <div className="mb-3 flex items-center justify-between">
                  <span className={`text-sm font-medium ${darkMode ? "text-white/70" : "text-zinc-700"}`}>Total</span>
                  <span className="text-xl font-bold text-green-500">{formatCurrency(cartTotal)}</span>
                </div>

                {/* Auto prep indicator */}
                {needsPrep && (
                  <div className={`mb-2 flex items-center gap-2 rounded-lg border px-3 py-2 ${darkMode ? "border-amber-800 bg-amber-900/20" : "border-amber-200 bg-amber-50"}`}>
                    <span className="text-sm">👨‍🍳</span>
                    <p className={`text-xs font-medium ${darkMode ? "text-amber-400" : "text-amber-800"}`}>Enviado para preparo automaticamente</p>
                  </div>
                )}

                {/* Print receipt */}
                <label className={`mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer select-none ${darkMode ? "border-blue-800 bg-blue-900/20" : "border-blue-200 bg-blue-50"}`}>
                  <input
                    type="checkbox"
                    checked={printReceipt}
                    onChange={(e) => {
                      setPrintReceipt(e.target.checked)
                      localStorage.setItem("pedefacil-print-receipt", String(e.target.checked))
                    }}
                    className="h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <p className={`text-xs font-medium ${darkMode ? "text-blue-400" : "text-blue-800"}`}>Gerar cupom</p>
                    <p className={`text-[10px] ${darkMode ? "text-blue-500" : "text-blue-600"}`}>Imprimir após venda</p>
                  </div>
                </label>

                {/* Payment */}
                <div className="mb-3 flex gap-1.5">
                  {[
                    { value: "cash", icon: Banknote, label: "Dinheiro", activeColor: "border-green-500 bg-green-50 text-green-700" },
                    { value: "card", icon: CreditCard, label: "Cartão", activeColor: "border-blue-500 bg-blue-50 text-blue-700" },
                    { value: "pix", icon: DollarSign, label: "Pix", activeColor: "border-purple-500 bg-purple-50 text-purple-700" },
                  ].map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setPayment(p.value)}
                      className={`flex flex-1 items-center justify-center gap-1 rounded-lg border p-2 text-[10px] font-medium transition-colors ${
                        payment === p.value
                          ? p.activeColor
                          : darkMode ? "border-white/[.08] text-white/50" : "border-zinc-200 text-white/40"
                      }`}
                    >
                      <p.icon className="h-3 w-3" />
                      {p.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={finalizeSale}
                  disabled={closing || stagingCart.length === 0 || (!cashRegister && !activeTable)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-base font-bold text-white transition-colors hover:bg-green-700 disabled:opacity-50 active:scale-[0.98]"
                >
                  {closing ? (
                    "Registrando..."
                  ) : !cashRegister && !activeTable ? (
                    "Abra o caixa no financeiro antes de vender"
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      {activeTable ? `ADICIONAR À MESA ${activeTable}` : "FINALIZAR VENDA"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Mesas Tab */}
      {activeTab === "mesas" && (
        <>
          <div className={`flex flex-1 overflow-hidden`}>
            {/* Tables Grid */}
            <div className={`flex-1 overflow-auto p-4 ${darkMode ? "bg-[#0f2942]" : "bg-zinc-50"}`}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className={`text-lg font-bold ${darkMode ? "text-white" : "text-zinc-900"}`}>Mesas</h2>
                <div className="flex items-center gap-3">
                  <button onClick={generateStaffQr} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${darkMode ? "bg-[#1a3a5c] text-white/70 hover:bg-[#162e4a]" : "bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200"}`}>
                    QR Garcom
                  </button>
                  <p className={`text-xs ${darkMode ? "text-white/40" : "text-zinc-400"}`}>Toque na mesa para atender</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: tableCount }, (_, i) => i + 1).map((num) => {
                  const data = tableData[num] || { cart: [], participants: [] }
                  const tableOrdersTotal = orders
                    .filter((o: any) => o.tableNumber === num && o.orderType === "presencial" && !["delivered", "cancelled"].includes(o.status))
                    .reduce((s: number, o: any) => s + o.total, 0)
                  const isActive = activeTable === num
                  const committedCartTotal = data.cart.reduce((s, i) => s + i.price * i.quantity, 0)
                  const total = committedCartTotal + tableOrdersTotal
                  const partialPaid = tablePartialPaid[num] || 0
                  const remaining = total - partialPaid
                  const isFullyPaid = total > 0 && remaining <= 0.01
                  const isOccupied = total > 0 || committedCartTotal > 0
                  const hasBillRequest = paymentRequests.some((r: any) => r.tableNumber === num)
                  const itemCount = data.cart.reduce((s: number, i: any) => s + i.quantity, 0) + orders.filter((o: any) => o.tableNumber === num && o.orderType === "presencial" && !["delivered", "cancelled"].includes(o.status)).reduce((s: number, o: any) => { try { const items = typeof o.items === "string" ? JSON.parse(o.items) : o.items; return s + items.reduce((a: number, b: any) => a + b.quantity, 0) } catch { return s } }, 0)

                  return (
                    <div
                      key={num}
                      className={`relative flex flex-col rounded-2xl border-2 transition-all cursor-pointer overflow-hidden ${
                        hasBillRequest
                          ? "border-red-500 bg-red-50 shadow-lg dark:border-red-500 dark:bg-red-950"
                          : isActive
                          ? "border-green-500 bg-green-50 shadow-lg dark:border-green-400 dark:bg-green-950"
                          : isFullyPaid
                          ? "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950"
                          : isOccupied
                          ? darkMode ? "border-amber-500 bg-amber-950/50 hover:border-amber-400" : "border-amber-300 bg-amber-50 hover:border-amber-400"
                          : darkMode ? "border-white/[.08] bg-[#1a3a5c] hover:border-green-500" : "border-zinc-200 bg-white hover:border-green-400"
                      }`}
                      onClick={() => selectTable(num)}
                    >
                      <div className="flex flex-1 flex-col items-center justify-center py-4 px-2">
                        <span className={`text-3xl font-extrabold leading-none ${
                          hasBillRequest ? "text-red-600 dark:text-red-400"
                          : isActive ? "text-green-700 dark:text-green-300"
                          : isOccupied ? "text-amber-700 dark:text-amber-300"
                          : darkMode ? "text-white/40" : "text-zinc-400"
                        }`}>{num}</span>
                        {hasBillRequest ? (
                          <span className="mt-2 rounded-full bg-red-100 px-3 py-1 text-xs font-extrabold text-red-700 dark:bg-red-900 dark:text-red-300">Pediu a conta</span>
                        ) : isOccupied && total > 0 ? (
                          <span className={`mt-2 text-sm font-bold ${isFullyPaid ? "text-green-600 dark:text-green-400" : "text-amber-700 dark:text-amber-300"}`}>
                            {isFullyPaid ? "Paga" : formatCurrency(total)}
                          </span>
                        ) : (
                          <span className={`mt-2 text-xs ${darkMode ? "text-white/30" : "text-zinc-400"}`}>Livre</span>
                        )}
                        {isOccupied && !hasBillRequest && itemCount > 0 && (
                          <span className={`mt-1 text-[10px] ${darkMode ? "text-white/40" : "text-zinc-400"}`}>{itemCount} {itemCount === 1 ? "item" : "itens"}</span>
                        )}
                        {partialPaid > 0 && remaining > 0.01 && (
                          <span className="mt-1 text-[10px] font-medium text-blue-600">Pago: {formatCurrency(partialPaid)}</span>
                        )}
                      </div>

                      {isOccupied && (
                        <div className={`flex border-t ${darkMode ? "border-white/[.08]" : "border-zinc-200"}`}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setActiveTable(num); setActiveTab("caixa") }}
                            className={`flex flex-1 flex-col items-center justify-center py-2.5 text-xs font-semibold transition-colors border-r ${
                              darkMode ? "text-green-400 hover:bg-green-950 active:bg-green-900 border-white/[.08]" : "text-green-600 hover:bg-green-50 active:bg-green-100 border-zinc-200"
                            }`}
                          >
                            <PlusCircle className="h-5 w-5 mb-1" />
                            Adicionar
                          </button>
                          {total > 0 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); openAbater(num) }}
                              className={`flex flex-1 flex-col items-center justify-center py-2.5 text-xs font-semibold transition-colors border-r ${
                                darkMode ? "text-blue-400 hover:bg-blue-950 active:bg-blue-900 border-white/[.08]" : "text-blue-600 hover:bg-blue-50 active:bg-blue-100 border-zinc-200"
                              }`}
                            >
                              <MinusCircle className="h-5 w-5 mb-1" />
                              Abater
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); closeTable(num, [...data.cart, ...(isActive ? stagingCart : [])]) }}
                            className={`flex flex-1 flex-col items-center justify-center py-2.5 text-xs font-semibold transition-colors ${
                              darkMode ? "text-red-400 hover:bg-red-950 active:bg-red-900" : "text-red-600 hover:bg-red-50 active:bg-red-100"
                            }`}
                          >
                            <X className="h-5 w-5 mb-1" />
                            Fechar
                          </button>
                        </div>
                      )}
                      {!isOccupied && (
                        <div className={`flex border-t ${darkMode ? "border-white/[.08]" : "border-zinc-200"}`}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setActiveTable(num); setActiveTab("caixa") }}
                            className={`flex flex-1 flex-col items-center justify-center py-2.5 text-xs font-semibold transition-colors ${
                              darkMode ? "text-green-400 hover:bg-green-950 active:bg-green-900" : "text-green-600 hover:bg-green-50 active:bg-green-100"
                            }`}
                          >
                            <PlusCircle className="h-5 w-5 mb-1" />
                            Adicionar
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Cart Sidebar */}
            <div className={`flex w-80 flex-col border-l ${darkMode ? "border-white/[.1] bg-[#1a3a5c]" : "border-zinc-200 bg-white"}`}>
              <div className={`border-b px-4 py-2 ${
                activeTable
                  ? darkMode ? "border-amber-700 bg-amber-900/30" : "border-amber-200 bg-amber-50"
                  : darkMode ? "border-white/[.1] bg-[#1a3a5c]" : "border-zinc-100 bg-white"
              }`}>
                <div className="flex items-center justify-between">
                  <h2 className={`text-sm font-semibold ${
                    activeTable
                      ? darkMode ? "text-amber-200" : "text-amber-700"
                      : darkMode ? "text-white/50" : "text-zinc-400"
                  }`}>
                    {activeTable ? `Mesa ${activeTable}` : "Selecione uma mesa"}
                  </h2>
                  {activeTable !== null && (
                    <button
                      onClick={deselectTable}
                      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium ${darkMode ? "bg-[#1a3a5c] text-white/70 hover:bg-[#162e4a]" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
                    >
                      Trocar mesa
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-2">
                {!activeTable ? (
                  <div className={`flex flex-col items-center justify-center py-12 ${darkMode ? "text-white/40" : "text-zinc-400"}`}>
                    <ShoppingBag className="mb-2 h-8 w-8" />
                    <p className="text-xs">Selecione uma mesa para ver os itens</p>
                  </div>
                ) : (cart.length === 0 && stagingCart.length === 0) ? (
                  <div className={`flex flex-col items-center justify-center py-12 ${darkMode ? "text-white/40" : "text-zinc-400"}`}>
                    <ShoppingBag className="mb-2 h-8 w-8" />
                    <p className="text-xs">Nenhum item nesta mesa</p>
                    <p className={`mt-1 text-[10px] ${darkMode ? "text-white/30" : "text-zinc-400"}`}>Adicione itens pelo card da mesa</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[...cart, ...stagingCart].map((item) => (
                      <div key={item.productId} className={`flex items-center gap-2 rounded-lg p-2 ${darkMode ? "bg-[#0f2942]" : "bg-zinc-50"}`}>
                        <div className="flex-1 min-w-0">
                          <p className={`truncate text-xs font-medium ${darkMode ? "text-white" : "text-zinc-800"}`}>{item.name}</p>
                          <p className={`text-[10px] ${darkMode ? "text-white/50" : "text-zinc-400"}`}>{formatCurrency(item.price)} x {item.quantity}</p>
                        </div>
                        <span className={`text-xs font-bold ${darkMode ? "text-white/90" : "text-zinc-700"}`}>{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {activeTable && (
                <div className={`border-t px-4 py-3 ${darkMode ? "border-white/[.1] bg-[#1a3a5c]" : "border-zinc-200 bg-zinc-50"}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <span className={`text-sm font-medium ${darkMode ? "text-white/70" : "text-zinc-700"}`}>Total</span>
                    <span className="text-xl font-bold text-green-500">{formatCurrency(cartTotal)}</span>
                  </div>
                  {(() => { const pp = activeTable ? (tablePartialPaid[activeTable] || 0) : 0; const rem = cartTotal - pp; return pp > 0 && rem > 0.01 ? (
                    <div className="mb-2 flex items-center justify-between">
                      <span className={`text-xs ${darkMode ? "text-white/50" : "text-zinc-500"}`}>Pago</span>
                      <span className="text-sm font-bold text-blue-500">{formatCurrency(pp)}</span>
                    </div>
                  ) : null })()}
                  <button
                    onClick={() => closeTable(activeTable, [...cart, ...stagingCart])}
                    disabled={closing}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-base font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50 active:scale-[0.98]"
                  >
                    {closing ? "Fechando..." : (
                      <>
                        <X className="h-5 w-5" />
                        FECHAR CONTA
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Pedidos Balcão Tab */}
      {activeTab === "balcao" && (
        <BalcaoTab orders={orders} establishmentId={user?.establishmentId || ""} onRefresh={() => loadData(user?.establishmentId || "")} darkMode={darkMode} />
      )}

      {/* Pedidos Externos Tab */}
      {activeTab === "pedidos" && (
        <PedidosTab orders={orders} deliveryPeople={deliveryPeople} establishmentId={user?.establishmentId || ""} onRefresh={() => loadData(user?.establishmentId || "")} darkMode={darkMode} />
      )}

      {/* Custom Item Modal */}
      {showCustomItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) setShowCustomItemModal(false) }}>
          <div className={`w-full max-w-sm rounded-2xl p-5 shadow-2xl ${darkMode ? "bg-[#1a3a5c]" : "bg-white"}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className={`text-sm font-bold ${darkMode ? "text-white" : "text-zinc-900"}`}>Item Avulso</h3>
              <button onClick={() => setShowCustomItemModal(false)}><X className="h-4 w-4 text-zinc-400" /></button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Nome do item"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                autoFocus
                className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none ${darkMode ? "border-white/[.08] bg-[#0f2942] text-white placeholder:text-white/40" : "border-zinc-200 bg-zinc-50"}`}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Preço (R$)"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none ${darkMode ? "border-white/[.08] bg-[#0f2942] text-white placeholder:text-white/40" : "border-zinc-200 bg-zinc-50"}`}
              />
              <button
                onClick={() => { addCustomItem(); setShowCustomItemModal(false) }}
                disabled={!customName || !customPrice}
                className="w-full rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt popup */}
      {showReceipt && lastOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-2xl bg-white p-6 shadow-2xl w-full max-w-sm">
            <div className="mb-4 text-center">
              <p className="text-3xl font-bold text-green-600">#{lastOrder.orderNumber}</p>
              <p className="text-sm text-white/40">Pedido gerado com sucesso!</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  printReceiptPopup(lastOrder)
                  setShowReceipt(false)
                }}
                className="flex-1 rounded-lg bg-green-600 px-4 py-3 text-sm font-bold text-white hover:bg-green-700"
              >
                Imprimir
              </button>
              <button
                onClick={() => {
                  setShowReceipt(false)
                }}
                className="flex-1 rounded-lg border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cash Register Modal */}
      {showCashRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={`rounded-2xl p-6 shadow-2xl w-full max-w-sm ${darkMode ? "bg-[#1a3a5c]" : "bg-white"}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className={`text-lg font-bold ${darkMode ? "text-white" : "text-zinc-900"}`}>
                {cashRegisterAction === "open" ? "Abrir Caixa" : cashRegisterAction === "close" ? "Fechar Caixa" : "Transferir Caixa"}
              </h3>
              <button onClick={() => setShowCashRegisterModal(false)} className={`${darkMode ? "text-white/50 hover:text-white" : "text-zinc-400 hover:text-zinc-600"}`}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {cashRegisterAction === "open" && (
              <div className="space-y-3">
                <div>
                  <label className={`text-xs ${darkMode ? "text-white/50" : "text-zinc-500"}`}>Valor em caixa (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={openingAmount}
                    onChange={(e) => setOpeningAmount(e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-green-500 focus:outline-none ${darkMode ? "border-white/[.08] bg-[#1a3a5c] text-white placeholder:text-white/40" : "border-zinc-200"}`}
                  />
                </div>
                <button onClick={openCashRegister} className="w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700">
                  Abrir Caixa
                </button>
              </div>
            )}

            {cashRegisterAction === "close" && (
              <div className="space-y-3">
                <div className={`rounded-lg p-3 text-sm ${darkMode ? "bg-[#1a3a5c]" : "bg-zinc-50"}`}>
                  <p className={darkMode ? "text-white/50" : "text-zinc-500"}>Valor esperado: <span className={`font-bold ${darkMode ? "text-white" : "text-zinc-900"}`}>{formatCurrency(
                    (cashRegister?.openingAmount || 0) + (cashRegister?.movements || []).reduce((s: number, m: any) => s + m.amount, 0)
                  )}</span></p>
                </div>
                <div>
                  <label className={`text-xs ${darkMode ? "text-white/50" : "text-zinc-500"}`}>Valor contado (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={closingAmount}
                    onChange={(e) => setClosingAmount(e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-green-500 focus:outline-none ${darkMode ? "border-white/[.08] bg-[#1a3a5c] text-white placeholder:text-white/40" : "border-zinc-200"}`}
                  />
                </div>
                <button onClick={closeCashRegister} className="w-full rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700">
                  Fechar Caixa
                </button>
              </div>
            )}

            {cashRegisterAction === "transfer" && (
              <div className="space-y-3">
                <div>
                  <label className={`text-xs ${darkMode ? "text-white/50" : "text-zinc-500"}`}>Transferir para</label>
                  <select
                    value={transferUserId}
                    onChange={(e) => setTransferUserId(e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-green-500 focus:outline-none ${darkMode ? "border-white/[.08] bg-[#1a3a5c] text-white" : "border-zinc-200"}`}
                  >
                    <option value="">Selecionar atendente...</option>
                    {allUsers.filter((u: any) => u.id !== user?.id && u.role !== "motoboy").map((u: any) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <button onClick={transferCashRegister} disabled={!transferUserId} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                  Transferir Caixa
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Close Table Modal */}
      {closingTableModal && closingTableNumber !== null && (() => {
        const tableOrders = orders.filter((o: any) => o.tableNumber === closingTableNumber && o.orderType === "presencial" && !["cancelled"].includes(o.status))
        const pendingOrders = tableOrders.filter((o: any) => o.status !== "delivered")
        const deliveredOrders = tableOrders.filter((o: any) => o.status === "delivered")
        const ordersTotal = pendingOrders.reduce((s: number, o: any) => s + o.total, 0)
        const cartItemsTotal = closingTableCart.reduce((s, i) => s + i.price * i.quantity, 0)
        const subtotal = ordersTotal + cartItemsTotal
        const serviceTax = serviceTaxConfig.enabled && serviceTaxConfig.presencial
          ? serviceTaxConfig.type === "percent"
            ? subtotal * (serviceTaxConfig.value / 100)
            : serviceTaxConfig.value
          : 0
        const grandTotal = subtotal + serviceTax
        const partialPaid = tablePartialPaid[closingTableNumber] || 0
        const remaining = grandTotal - partialPaid
        const splitValue = splitCount && parseInt(splitCount) > 1 ? remaining / parseInt(splitCount) : null
        const customTotal = customPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
        const customRemaining = remaining - customTotal

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className={`rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-hidden flex flex-col ${darkMode ? "bg-[#0d2137] text-white" : "bg-white text-zinc-900"}`}>
              {/* Header */}
              <div className={`flex items-center justify-between px-6 pt-5 pb-4 border-b ${darkMode ? "border-white/10" : "border-zinc-200"}`}>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">
                    Fechar Mesa {closingTableNumber}
                  </h3>
                  <p className={`text-xs mt-0.5 ${darkMode ? "text-white/50" : "text-zinc-500"}`}>Confirme os itens e a forma de pagamento</p>
                </div>
                <button onClick={() => { setClosingTableModal(false); setClosingTableNumber(null); setClosingTableCart([]); setAllTableItems([]); setCloseTableMode("single"); setSplitCount(""); setCustomPayments([{ amount: "", method: "cash" }]); setEachPersonStep(0); setEachPersonSelections({}); setEachPersonPixUrl(null); setSplitPersonStep(0) }} className={`${darkMode ? "text-white/50 hover:text-white" : "text-zinc-400 hover:text-zinc-600"} rounded-lg p-1`}>
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
                {/* Summary */}
                <div className={`rounded-xl border p-4 space-y-1.5 ${darkMode ? "bg-white/5 border-white/10" : "bg-zinc-50 border-zinc-200"}`}>
                  <div className="flex justify-between text-sm">
                    <span className={darkMode ? "text-white/40" : "text-zinc-500"}>Subtotal</span>
                    <span className={`font-medium ${darkMode ? "text-white" : "text-zinc-700"}`}>{formatCurrency(subtotal)}</span>
                  </div>
                  {serviceTax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className={darkMode ? "text-white/40" : "text-zinc-500"}>Taxa de serviço ({serviceTaxConfig.type === "percent" ? `${serviceTaxConfig.value}%` : "fixo"})</span>
                      <span className={`font-medium ${darkMode ? "text-white" : "text-zinc-700"}`}>{formatCurrency(serviceTax)}</span>
                    </div>
                  )}
                  {partialPaid > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-600">Já abatido</span>
                      <span className="font-bold text-blue-600">− {formatCurrency(partialPaid)}</span>
                    </div>
                  )}
                  <div className={`flex justify-between text-sm border-t pt-1.5 mt-1.5 ${darkMode ? "border-white/10" : "border-zinc-200"}`}>
                    <span className={`font-medium ${darkMode ? "text-white/70" : "text-zinc-700"}`}>Restante a cobrar</span>
                    <span className="text-lg font-extrabold text-green-600">{formatCurrency(remaining)}</span>
                  </div>
                </div>

                {/* Mode selector */}
                <div>
                  <p className={`text-xs font-semibold mb-2 uppercase tracking-wide ${darkMode ? "text-white/40" : "text-zinc-400"}`}>Forma de cobrança</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "single", label: "Pagamento único", icon: "💳" },
                      { id: "split", label: "Dividir igual", icon: "➗" },
                      { id: "custom", label: "Cada um paga", icon: "👥" },
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => { setCloseTableMode(m.id as any); setSplitCount(""); setCustomPayments([{ amount: "", method: "cash" }]); setEachPersonStep(0); setEachPersonSelections({}); setEachPersonPixUrl(null); setSplitPersonStep(0) }}
                        className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-xs font-medium transition-all ${
                          closeTableMode === m.id
                            ? "border-green-500 bg-green-50 text-green-700"
                            : darkMode ? "border-white/10 text-white/60 hover:border-white/20" : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                        }`}
                      >
                        <span className="text-lg">{m.icon}</span>
                        <span className="text-center leading-tight">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mode: Single payment */}
                {closeTableMode === "single" && (
                  <div>
                    <p className={`text-xs font-semibold mb-2 uppercase tracking-wide ${darkMode ? "text-white/40" : "text-zinc-400"}`}>Forma de pagamento</p>
                    <div className="flex gap-2">
                      {[
                        { value: "cash", label: "Dinheiro", icon: Banknote },
                        { value: "card", label: "Cartão", icon: CreditCard },
                        { value: "pix", label: "Pix", icon: DollarSign },
                      ].map((p) => (
                        <button
                          key={p.value}
                          onClick={() => setClosingTablePayment(p.value)}
                          className={`flex-1 flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-xs font-medium transition-all ${
                            closingTablePayment === p.value
                              ? "border-green-500 bg-green-50 text-green-700"
                              : darkMode ? "border-white/10 text-white/60 hover:border-white/20" : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                          }`}
                        >
                          <p.icon className="h-4 w-4" />
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mode: Split equally — sequential payments */}
                {closeTableMode === "split" && (
                  <div className="space-y-3">
                    <div>
                      <label className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? "text-white/40" : "text-zinc-400"}`}>Quantas pessoas?</label>
                      <input
                        type="number"
                        min="2"
                        placeholder="Ex: 4"
                        value={splitCount}
                        onChange={(e) => { setSplitCount(e.target.value); setSplitPersonStep(0) }}
                        className={`mt-1 w-full rounded-xl border-2 px-4 py-3 text-2xl font-bold text-center focus:border-green-500 focus:outline-none ${darkMode ? "border-white/10 bg-white/5 text-white" : "border-zinc-200 text-zinc-900"}`}
                        autoFocus
                      />
                    </div>
                    {splitValue !== null && splitValue > 0 && (
                      <>
                        {/* Progress bar */}
                        <div className="flex gap-1.5">
                          {Array.from({ length: parseInt(splitCount) || 0 }).map((_, i) => (
                            <div
                              key={i}
                              className={`flex-1 h-2 rounded-full transition-colors ${
                                i <= splitPersonStep ? "bg-green-500" : "bg-zinc-200"
                              }`}
                            />
                          ))}
                        </div>
                        <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
                          <p className="text-xs text-zinc-500">
                            {splitPersonStep + 1}ª pessoa de {splitCount}
                          </p>
                          <p className="text-3xl font-extrabold text-green-600">{formatCurrency(splitValue)}</p>
                          <p className="text-xs text-zinc-400 mt-1">{splitCount} pessoas × {formatCurrency(splitValue)} = {formatCurrency(remaining)}</p>
                        </div>
                      </>
                    )}
                    <div>
                      <p className={`text-xs font-semibold mb-2 uppercase tracking-wide ${darkMode ? "text-white/40" : "text-zinc-400"}`}>Forma de pagamento</p>
                      <div className="flex gap-2">
                        {[
                          { value: "cash", label: "Dinheiro", icon: Banknote },
                          { value: "card", label: "Cartão", icon: CreditCard },
                          { value: "pix", label: "Pix", icon: DollarSign },
                        ].map((p) => (
                          <button
                            key={p.value}
                            onClick={() => setClosingTablePayment(p.value)}
                            className={`flex-1 flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-xs font-medium transition-all ${
                              closingTablePayment === p.value
                                ? "border-green-500 bg-green-50 text-green-700"
                                : darkMode ? "border-white/10 text-white/60 hover:border-white/20" : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                            }`}
                          >
                            <p.icon className="h-4 w-4" />
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {splitValue !== null && splitValue > 0 && (
                      <button
                        onClick={() => {
                          if (splitPersonStep + 1 < (parseInt(splitCount) || 0)) {
                            setSplitPersonStep(prev => prev + 1)
                          } else {
                            // Last person — close the table
                            setConfirmDialog({
                              open: true,
                              title: `Fechar Mesa ${closingTableNumber}?`,
                              message: `Último pagamento — ${formatCurrency(splitValue)}\nTotal: ${formatCurrency(remaining)}`,
                              onConfirm: () => { setConfirmDialog({ open: false, title: "", message: "", onConfirm: () => {}, confirmed: false, successTitle: "", successMessage: "" }); handleCloseTable() },
                              confirmed: false,
                              successTitle: "",
                              successMessage: "",
                            })
                          }
                        }}
                        disabled={!splitCount || parseInt(splitCount) < 2}
                        className="w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-40 transition-colors"
                      >
                        {splitPersonStep + 1 < (parseInt(splitCount) || 0)
                          ? `Confirmar pagamento ${splitPersonStep + 1} de ${splitCount}`
                          : `Fechar mesa · ${formatCurrency(splitValue)}`
                        }
                      </button>
                    )}
                  </div>
                )}

                {/* Mode: Cada um paga — item selection + Pix per person */}
                {closeTableMode === "custom" && (
                  <div className="space-y-3">
                    {/* Step indicator */}
                    <div className={`flex items-center justify-center gap-2 text-xs ${darkMode ? "text-white/40" : "text-zinc-400"}`}>
                      <span className={`font-bold text-green-600 ${eachPersonStep + 1 <= Object.keys(eachPersonSelections).length ? "text-green-600" : "text-white/30"}`}>
                        Pessoa {eachPersonStep + 1}
                      </span>
                      <span>·</span>
                      <span>{Object.keys(eachPersonSelections).length} pessoa(s) configurada(s)</span>
                    </div>

                    {/* Item quantity selectors */}
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {allTableItems.map((item, idx) => {
                        const selectedQty = eachPersonSelections[eachPersonStep]?.[idx] || 0
                        const isSelected = selectedQty > 0
                        const maxQty = item.quantity || 1
                        return (
                          <div
                            key={idx}
                            className={`flex items-center gap-2 rounded-xl border-2 p-2.5 transition-all ${
                              isSelected
                                ? "border-green-500 bg-green-50"
                                : darkMode ? "border-white/10 hover:border-white/20" : "border-zinc-200 hover:border-zinc-300"
                            }`}
                          >
                            {maxQty > 1 ? (
                              <>
                                <button
                                  onClick={() => {
                                    setEachPersonSelections(prev => {
                                      const next = { ...prev }
                                      const personSel = { ...(next[eachPersonStep] || {}) }
                                      const newQty = Math.max(0, (personSel[idx] || 0) - 1)
                                      if (newQty === 0) delete personSel[idx]
                                      else personSel[idx] = newQty
                                      next[eachPersonStep] = personSel
                                      return next
                                    })
                                  }}
                                  className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold transition-colors ${
                                    isSelected
                                      ? "bg-green-600 text-white hover:bg-green-700"
                                      : darkMode ? "bg-white/10 text-white/60 hover:bg-white/20" : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300"
                                  }`}
                                >
                                  -
                                </button>
                                <span className={`min-w-[28px] text-center text-sm font-bold ${isSelected ? "text-green-700" : darkMode ? "text-white/60" : "text-zinc-400"}`}>
                                  {selectedQty}/{maxQty}
                                </span>
                                <button
                                  onClick={() => {
                                    setEachPersonSelections(prev => {
                                      const next = { ...prev }
                                      const personSel = { ...(next[eachPersonStep] || {}) }
                                      const newQty = Math.min(maxQty, (personSel[idx] || 0) + 1)
                                      personSel[idx] = newQty
                                      next[eachPersonStep] = personSel
                                      return next
                                    })
                                  }}
                                  disabled={selectedQty >= maxQty}
                                  className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold transition-colors disabled:opacity-30 ${
                                    isSelected
                                      ? "bg-green-600 text-white hover:bg-green-700"
                                      : darkMode ? "bg-white/10 text-white/60 hover:bg-white/20" : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300"
                                  }`}
                                >
                                  +
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  setEachPersonSelections(prev => {
                                    const next = { ...prev }
                                    const personSel = { ...(next[eachPersonStep] || {}) }
                                    if (isSelected) delete personSel[idx]
                                    else personSel[idx] = 1
                                    next[eachPersonStep] = personSel
                                    return next
                                  })
                                }}
                                className={`flex h-7 w-7 items-center justify-center rounded-lg border-2 text-xs font-bold transition-all ${
                                  isSelected
                                    ? "border-green-500 bg-green-600 text-white"
                                    : darkMode ? "border-white/20 text-white/40" : "border-zinc-300 text-zinc-400"
                                }`}
                              >
                                {isSelected ? "✓" : ""}
                              </button>
                            )}
                            <div className="flex-1 min-w-0">
                              <span className={`text-sm font-medium ${darkMode ? "text-white" : "text-zinc-900"}`}>{item.quantity}x {item.name}</span>
                            </div>
                            <span className={`text-sm font-bold ${darkMode ? "text-white" : "text-zinc-700"}`}>{formatCurrency(item.price * (isSelected ? selectedQty : item.quantity))}</span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Person subtotal */}
                    <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-center">
                      <p className="text-xs text-zinc-500">Pessoa {eachPersonStep + 1} — subtotal</p>
                      <p className="text-2xl font-extrabold text-green-600">
                        {formatCurrency(
                          Object.entries(eachPersonSelections[eachPersonStep] || {}).reduce(
                            (s, [idx, qty]) => s + (allTableItems[parseInt(idx)]?.price || 0) * qty, 0
                          )
                        )}
                      </p>
                    </div>

                    {/* Pix display */}
                    {eachPersonPixUrl && (
                      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-center space-y-2">
                        <p className="text-xs font-semibold text-blue-700">QR Code — Pessoa {eachPersonStep + 1}</p>
                        <a
                          href={eachPersonPixUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                        >
                          Abrir link de pagamento
                        </a>
                        <p className="text-[10px] text-blue-500">Aponte o celular do cliente para o QR</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (eachPersonStep > 0) {
                            setEachPersonStep(prev => prev - 1)
                            setEachPersonPixUrl(null)
                          }
                        }}
                        disabled={eachPersonStep === 0}
                        className={`rounded-xl border-2 px-4 py-2.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-40 ${darkMode ? "border-white/10 text-white/60 hover:bg-white/5" : "border-zinc-200 text-zinc-600"}`}
                      >
                        Voltar
                      </button>
                      <button
                        onClick={async () => {
                          const selected = eachPersonSelections[eachPersonStep] || {}
                          const personTotal = Object.entries(selected).reduce((s, [idx, qty]) => s + (allTableItems[parseInt(idx)]?.price || 0) * qty, 0)
                          if (personTotal <= 0) return
                          setEachPersonGenerating(true)
                          try {
                            const res = await fetchAuth("/api/pix-generate", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                establishmentId: user?.establishmentId,
                                amount: personTotal,
                                description: `Mesa ${closingTableNumber} — Pessoa ${eachPersonStep + 1}`,
                              }),
                            })
                            const data = await res.json()
                            if (data.invoiceUrl) {
                              setEachPersonPixUrl(data.invoiceUrl)
                            }
                          } catch {
                            toast("Erro ao gerar Pix", "error")
                          } finally {
                            setEachPersonGenerating(false)
                          }
                        }}
                        disabled={Object.keys(eachPersonSelections[eachPersonStep] || {}).length === 0 || eachPersonGenerating}
                        className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-40 transition-colors"
                      >
                        {eachPersonGenerating ? "Gerando..." : "Gerar Pix"}
                      </button>
                      <button
                        onClick={() => {
                          setEachPersonSelections(prev => ({ ...prev, [(eachPersonStep + 1)]: {} }))
                          setEachPersonStep(prev => prev + 1)
                          setEachPersonPixUrl(null)
                        }}
                        className={`rounded-xl border-2 border-dashed px-4 py-2.5 text-sm font-medium hover:border-green-400 hover:text-green-600 ${darkMode ? "border-white/10 text-white/60" : "border-zinc-300 text-zinc-600"}`}
                      >
                        Próxima pessoa
                      </button>
                    </div>
                  </div>
                )}

                {/* Orders summary */}
                {(pendingOrders.length > 0 || allTableItems.length > 0) && (
                  <details className={`rounded-xl border ${darkMode ? "border-white/10" : "border-zinc-200"}`}>
                    <summary className={`px-4 py-3 text-xs font-semibold cursor-pointer uppercase tracking-wide ${darkMode ? "text-white/40" : "text-zinc-400"}`}>
                      Ver detalhes ({pendingOrders.length + allTableItems.length} itens)
                    </summary>
                    <div className={`px-4 pb-4 space-y-2 text-sm ${darkMode ? "text-white/60" : "text-zinc-600"}`}>
                      {pendingOrders.map((o: any) => {
                        const items = typeof o.items === "string" ? JSON.parse(o.items) : o.items
                        return (
                          <div key={o.id} className={`flex justify-between py-1 border-b ${darkMode ? "border-white/10" : "border-zinc-100"}`}>
                            <span className="text-zinc-600">{items.map((i: any) => `${i.quantity}x ${i.name}`).join(", ")}</span>
                            <span className="font-medium text-zinc-900">{formatCurrency(o.total)}</span>
                          </div>
                        )
                      })}
                      {closingTableCart.map((item) => (
                        <div key={item.productId} className={`flex justify-between py-1 border-b ${darkMode ? "border-white/10" : "border-zinc-100"}`}>
                          <span className={darkMode ? "text-white/60" : "text-zinc-600"}>{item.quantity}x {item.name}</span>
                          <span className={`font-medium ${darkMode ? "text-white" : "text-zinc-900"}`}>{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              {/* Footer */}
              <div className={`px-6 pb-5 pt-3 border-t ${darkMode ? "border-white/10" : "border-zinc-200"}`}>
                <button
                  onClick={() => {
                    const paymentLabels: Record<string, string> = { cash: "Dinheiro", card: "Cartão", pix: "Pix" }
                    let selectedPayment = closingTablePayment
                    if (closeTableMode === "custom" && customPayments.length > 0) {
                      selectedPayment = customPayments[0].method
                    }
                    setConfirmDialog({
                      open: true,
                      title: `Fechar Mesa ${closingTableNumber}?`,
                      message: `Total: ${formatCurrency(remaining)}\nPagamento: ${paymentLabels[selectedPayment] || selectedPayment}`,
                      onConfirm: () => { setConfirmDialog({ open: false, title: "", message: "", onConfirm: () => {}, confirmed: false, successTitle: "", successMessage: "" }); handleCloseTable() },
                      confirmed: false,
                      successTitle: "",
                      successMessage: "",
                    })
                  }}
                  disabled={closeTableMode === "split" && (!splitCount || parseInt(splitCount) < 2)}
                  className="w-full rounded-xl bg-green-600 py-3.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-40 transition-colors"
                >
                  Fechar Mesa · {formatCurrency(remaining)}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Abater Modal */}
      {abaterModal !== null && (() => {
        const total = getTableTotal(abaterModal)
        const alreadyPaid = tablePartialPaid[abaterModal] || 0
        const remainingAbater = total - alreadyPaid
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className={`rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 ${darkMode ? "bg-[#0d2137] text-white" : "bg-white text-zinc-900"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">Abater valor</h3>
                  <p className={`text-xs ${darkMode ? "text-white/50" : "text-zinc-500"}`}>Mesa {abaterModal} · Mesa continua aberta</p>
                </div>
                <button onClick={() => { setAbaterModal(null); setAbaterAmount("") }} className={`${darkMode ? "text-white/50 hover:text-white" : "text-zinc-400 hover:text-zinc-600"}`}>
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className={`rounded-xl border p-3 flex justify-between text-sm ${darkMode ? "bg-white/5 border-white/10" : "bg-zinc-50 border-zinc-200"}`}>
                <span className={darkMode ? "text-white/40" : "text-zinc-500"}>Restante na mesa</span>
                <span className={`font-bold ${darkMode ? "text-white" : "text-zinc-900"}`}>{formatCurrency(remainingAbater)}</span>
              </div>

              <div>
                <label className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? "text-white/40" : "text-zinc-400"}`}>Valor a abater</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="R$ 0,00"
                  value={abaterAmount}
                  onChange={(e) => setAbaterAmount(e.target.value)}
                  className={`mt-1 w-full rounded-xl border-2 px-4 py-3 text-2xl font-bold text-center focus:border-green-500 focus:outline-none ${darkMode ? "border-white/10 bg-white/5 text-white" : "border-zinc-200 text-zinc-900"}`}
                  autoFocus
                />
                {abaterAmount && parseFloat(abaterAmount) > 0 && (
                  <p className={`text-xs text-center mt-1 ${darkMode ? "text-white/50" : "text-zinc-500"}`}>
                    Restante após abate: {formatCurrency(Math.max(0, remainingAbater - parseFloat(abaterAmount)))}
                  </p>
                )}
              </div>

              <div>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${darkMode ? "text-white/40" : "text-zinc-400"}`}>Forma de pagamento</p>
                <div className="flex gap-2">
                  {[
                    { value: "cash", label: "Dinheiro", icon: Banknote },
                    { value: "card", label: "Cartão", icon: CreditCard },
                    { value: "pix", label: "Pix", icon: DollarSign },
                  ].map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setAbaterMethod(p.value)}
                      className={`flex-1 flex flex-col items-center gap-1 rounded-xl border-2 p-2.5 text-xs font-medium transition-all ${
                        abaterMethod === p.value ? "border-green-500 bg-green-50 text-green-700" : darkMode ? "border-white/10 text-white/60" : "border-zinc-200 text-zinc-600"
                      }`}
                    >
                      <p.icon className="h-4 w-4" />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => { setAbaterModal(null); setAbaterAmount("") }} className={`flex-1 rounded-xl border py-3 text-sm font-medium hover:bg-zinc-50 ${darkMode ? "border-white/10 text-white/60" : "border-zinc-300 text-zinc-700"}`}>
                  Cancelar
                </button>
                <button
                  onClick={processAbater}
                  disabled={!abaterAmount || parseFloat(abaterAmount) <= 0}
                  className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  Registrar Abate
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        variant="warning"
        confirmed={confirmDialog.confirmed}
        successTitle={confirmDialog.successTitle}
        successMessage={confirmDialog.successMessage}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ open: false, title: "", message: "", onConfirm: () => {}, confirmed: false, successTitle: "", successMessage: "" })}
      />

      {/* Staff QR Code Modal */}
      {showStaffQr && staffQrImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowStaffQr(false) }}>
          <div className={`rounded-2xl p-6 text-center shadow-2xl ${darkMode ? "bg-[#1a3a5c]" : "bg-white"}`}>
            <p className={`mb-1 text-sm font-bold ${darkMode ? "text-white" : "text-zinc-900"}`}>QR Code — Garcom</p>
            <p className={`mb-4 text-xs ${darkMode ? "text-white/50" : "text-white/40"}`}>Escaneie com o celular do garcom</p>
            <img src={staffQrImage} alt="QR Code Garcom" className="mx-auto rounded-xl border-4 border-white shadow-lg" />
            <p className={`mt-3 text-[10px] ${darkMode ? "text-white/40" : "text-white/50"}`}>{`/{${user?.establishment?.slug}}/staff`}</p>
            <button onClick={() => setShowStaffQr(false)} className={`mt-4 rounded-xl px-6 py-2 text-sm font-bold ${darkMode ? "bg-[#1a3a5c] text-white/70 hover:bg-[#162e4a]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const statusLabels: Record<string, string> = {
  new: "Novo",
  pending: "Pendente",
  preparing: "Preparando",
  ready: "Pronto",
  out_for_delivery: "Saiu p/ Entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
}

const statusColors: Record<string, string> = {
  new: "bg-zinc-100 text-zinc-600",
  pending: "bg-zinc-100 text-zinc-600",
  preparing: "bg-amber-100 text-amber-700",
  ready: "bg-green-100 text-green-700",
  out_for_delivery: "bg-blue-100 text-blue-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
}

function PedidosTab({ orders, deliveryPeople, establishmentId, onRefresh, darkMode }: { orders: any[]; deliveryPeople: any[]; establishmentId: string; onRefresh: () => void; darkMode: boolean }) {
  const [filter, setFilter] = useState("all")
  const [payModalOrder, setPayModalOrder] = useState<any>(null)
  const [payMethod, setPayMethod] = useState("cash")

  const externalOrders = orders.filter((o: any) => o.orderType !== "presencial")
  const activeOrders = externalOrders.filter((o: any) => {
    if (filter === "all") return ["preparing", "ready", "out_for_delivery"].includes(o.status)
    if (filter === "preparing") return o.status === "preparing"
    if (filter === "ready") return o.status === "ready"
    if (filter === "out_for_delivery") return o.status === "out_for_delivery"
    if (filter === "delivered") return o.status === "delivered"
    return true
  })

  async function updateStatus(orderId: string, status: string) {
    localStorage.setItem("pedefacil-last-action", JSON.stringify({ type: "status-changed", ts: Date.now() }))
    await fetchAuth(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    onRefresh()
  }

  async function handlePayOrder() {
    if (!payModalOrder) return
    await fetchAuth(`/api/orders/${payModalOrder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "delivered", paymentMethod: payMethod }),
    })
    setPayModalOrder(null)
    onRefresh()
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mb-4 flex gap-2">
        {[
          { value: "all", label: "Todos" },
          { value: "preparing", label: "Preparando" },
          { value: "ready", label: "Prontos" },
          { value: "out_for_delivery", label: "Em entrega" },
          { value: "delivered", label: "Entregue" },
        ].map((f) => {
          const count = f.value === "all"
            ? externalOrders.filter((o: any) => ["preparing", "ready", "out_for_delivery"].includes(o.status)).length
            : f.value === "preparing"
            ? externalOrders.filter((o: any) => o.status === "preparing").length
            : f.value === "ready"
            ? externalOrders.filter((o: any) => o.status === "ready").length
            : f.value === "out_for_delivery"
            ? externalOrders.filter((o: any) => o.status === "out_for_delivery").length
            : f.value === "delivered"
            ? externalOrders.filter((o: any) => o.status === "delivered" && new Date(o.deliveredAt || o.createdAt).toDateString() === new Date().toDateString()).length
            : 0
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === f.value ? "bg-green-600 text-white" : darkMode ? "bg-[#1a3a5c] text-white/70 hover:bg-[#162e4a]" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {f.label}
              {count > 0 && (
                <span className={`ml-1 rounded-full px-1 py-0.5 text-[9px] font-bold ${
                  filter === f.value ? "bg-white/20" : darkMode ? "bg-[#162e4a]" : "bg-zinc-200"
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {activeOrders.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-12 ${darkMode ? "text-white/40" : "text-white/50"}`}>
          <Package className="mb-2 h-8 w-8" />
          <p className="text-sm">
            {filter === "all" ? "Nenhum pedido ativo" :
             filter === "preparing" ? "Nenhum em preparo" :
             filter === "ready" ? "Nenhum pedido pronto" :
             filter === "out_for_delivery" ? "Nenhuma entrega em andamento" :
             "Nenhum entregue hoje"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeOrders.map((order) => {
            const items = typeof order.items === "string" ? JSON.parse(order.items) : order.items
            const isPickup = order.orderType === "pickup"
            const isDelivery = order.orderType === "delivery"
            const hasMotoboy = !!order.deliveryPersonId
            const motoboyName = deliveryPeople.find((p: any) => p.id === order.deliveryPersonId)?.name

            return (
              <div key={order.id} className={`rounded-xl border p-3 ${
                order.status === "ready" && isPickup ? "border-amber-300 shadow-sm" : darkMode ? "border-white/[.08] bg-[#1a3a5c]" : "border-zinc-200 bg-white"
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {order.orderNumber && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                          #{order.orderNumber}
                        </span>
                      )}
                      <span className={`font-medium ${darkMode ? "text-white" : "text-zinc-900"}`}>{order.customerName}</span>
                      {filter === "all" && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          order.status === "preparing" ? "bg-amber-100 text-amber-700" :
                          order.status === "ready" ? "bg-green-100 text-green-700" :
                          order.status === "out_for_delivery" ? "bg-blue-100 text-blue-700" :
                          "bg-green-100 text-green-700"
                        }`}>
                          {order.status === "preparing" ? "Preparando" :
                           order.status === "ready" ? "Pronto" :
                           order.status === "out_for_delivery" ? "Em entrega" :
                           "Entregue"}
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        darkMode ? "bg-[#1a3a5c] text-white/70" : "bg-zinc-100 text-zinc-600"
                      }`}>
                        {isPickup ? "Retirada" : "Entrega"}
                      </span>
                    </div>
                    <div className={`mt-1 text-xs ${darkMode ? "text-white/50" : "text-white/40"}`}>
                      {items.map((i: any) => `${i.quantity}x ${i.name}`).join(", ")}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-sm font-bold text-green-600">{formatCurrency(order.total)}</p>
                      {order.status === "delivered" && motoboyName && (
                        <span className="text-[10px] text-white/50">via {motoboyName}</span>
                      )}
                    </div>
                    {filter === "out_for_delivery" && hasMotoboy && motoboyName && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-blue-600">
                        <Bike className="h-3 w-3" />
                        {motoboyName}
                      </div>
                    )}
                    {filter === "ready" && isDelivery && hasMotoboy && motoboyName && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-blue-600">
                        <Bike className="h-3 w-3" />
                        Aguardando {motoboyName}
                      </div>
                    )}
                  </div>

                  {filter === "ready" && order.status === "ready" && isPickup && (
                    <div className="flex flex-col gap-2">
                      {(order.paymentMethod === "online" || order.paymentMethod === "asaas") ? (
                        <button
                          onClick={() => updateStatus(order.id, "delivered")}
                          className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600"
                        >
                          Entregar Pedido
                        </button>
                      ) : (
                        <button
                          onClick={() => { setPayModalOrder(order); setPayMethod("cash") }}
                          className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600"
                        >
                          Pagar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {payModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={`rounded-2xl p-6 shadow-2xl w-full max-w-sm ${darkMode ? "bg-[#0d2137] text-white" : "bg-white text-zinc-900"}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900">Pagar Pedido #{payModalOrder.orderNumber}</h3>
              <button onClick={() => setPayModalOrder(null)} className={`${darkMode ? "text-white/50 hover:text-white" : "text-zinc-400 hover:text-zinc-600"}`}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className={`rounded-lg p-3 text-sm ${darkMode ? "bg-white/5" : "bg-zinc-50"}`}>
                <p className={darkMode ? "text-white/50" : "text-zinc-500"}>{payModalOrder.customerName}</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(payModalOrder.total)}</p>
              </div>
              <div>
                <label className={`text-xs ${darkMode ? "text-white/40" : "text-zinc-400"}`}>Forma de pagamento</label>
                <div className="flex gap-2 mt-1">
                  {[
                    { value: "cash", label: "Dinheiro" },
                    { value: "card", label: "Cartão" },
                    { value: "pix", label: "Pix" },
                  ].map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setPayMethod(p.value)}
                      className={`flex-1 rounded-lg border p-2 text-xs font-medium transition-colors ${
                        payMethod === p.value
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handlePayOrder} className="w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700">
                Pagar e Entregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BalcaoTab({ orders, establishmentId, onRefresh, darkMode }: { orders: any[]; establishmentId: string; onRefresh: () => void; darkMode: boolean }) {
  const [filter, setFilter] = useState("all")
  const allBalcao = orders.filter((o: any) => o.orderType === "presencial")
  const activeBalcao = allBalcao.filter((o: any) => ["preparing", "ready"].includes(o.status))
  const deliveredBalcao = allBalcao.filter((o: any) => o.status === "delivered" && new Date(o.deliveredAt || o.createdAt).toDateString() === new Date().toDateString())
  const balcaoOrders = filter === "delivered" ? deliveredBalcao : activeBalcao.filter((o: any) => {
    if (filter === "all") return true
    if (filter === "preparing") return o.status === "preparing"
    if (filter === "ready") return o.status === "ready"
    return true
  })

  async function updateStatus(orderId: string, status: string) {
    localStorage.setItem("pedefacil-last-action", JSON.stringify({ type: "status-changed", ts: Date.now() }))
    await fetchAuth(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    onRefresh()
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mb-4 flex gap-2">
        {[
          { value: "all", label: "Todos", count: activeBalcao.length },
          { value: "preparing", label: "Preparando", count: activeBalcao.filter((o: any) => o.status === "preparing").length },
          { value: "ready", label: "Prontos", count: activeBalcao.filter((o: any) => o.status === "ready").length },
          { value: "delivered", label: "Entregue", count: deliveredBalcao.length },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f.value ? "bg-green-600 text-white" : darkMode ? "bg-[#1a3a5c] text-white/70 hover:bg-[#162e4a]" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {f.label}
            {f.count > 0 && (
              <span className={`ml-1 rounded-full px-1 py-0.5 text-[9px] font-bold ${
                filter === f.value ? "bg-white/20" : darkMode ? "bg-[#162e4a]" : "bg-zinc-200"
              }`}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {balcaoOrders.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-12 ${darkMode ? "text-white/40" : "text-white/50"}`}>
          <Store className="mb-2 h-8 w-8" />
          <p className="text-sm">
            {filter === "delivered" ? "Nenhum pedido entregue hoje" :
             filter === "preparing" ? "Nenhum em preparo" :
             filter === "ready" ? "Nenhum pedido pronto" :
             "Nenhum pedido de balcão"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {balcaoOrders.map((order) => {
            const items = typeof order.items === "string" ? JSON.parse(order.items) : order.items
            const isTable = order.tableNumber !== null
            const tableLabel = isTable ? `Mesa ${order.tableNumber}` : null

            return (
              <div key={order.id} className={`rounded-xl border p-3 ${
                order.status === "ready" && !isTable ? "border-amber-400 shadow-md" : darkMode ? "border-white/[.08] bg-[#1a3a5c]" : "border-zinc-200 bg-white"
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {order.orderNumber && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                          #{order.orderNumber}
                        </span>
                      )}
                      {isTable ? (
                        <span className={`font-medium ${darkMode ? "text-white" : "text-zinc-900"}`}>{tableLabel}</span>
                      ) : (
                        <span className={`font-medium ${darkMode ? "text-white" : "text-zinc-900"}`}>{order.customerName}</span>
                      )}
                      {filter === "all" && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          order.status === "preparing" ? "bg-amber-100 text-amber-700" :
                          "bg-green-100 text-green-700"
                        }`}>
                          {order.status === "preparing" ? "Preparando" : "Pronto"}
                        </span>
                      )}
                    </div>
                    <div className={`mt-1 text-xs ${darkMode ? "text-white/50" : "text-white/40"}`}>
                      {items.map((i: any) => `${i.quantity}x ${i.name}`).join(", ")}
                    </div>
                    <p className="mt-1 text-sm font-bold text-green-600">{formatCurrency(order.total)}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {order.status === "ready" && !isTable && (
                      <button
                        onClick={() => updateStatus(order.id, "delivered")}
                        className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600"
                      >
                        Entregar Pedido
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
