"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, X, Minus, Plus, Trash2, Banknote, CreditCard, DollarSign, CheckCircle, LogOut, TrendingUp, Clock, Store, ShoppingBag, ArrowLeft, Package, Bike, MapPin, MessageCircle, ExternalLink, Printer } from "lucide-react"
import { fetchAuth } from "@/lib/fetch-auth"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"

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
  establishment?: { id: string; name: string; slug: string }
}

interface Product {
  id: string
  name: string
  price: number
  image: string | null
  categoryId: string
  categoryName?: string
}

interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
}

export default function CaixaPOSPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserData | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [activeCategory, setActiveCategory] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [payment, setPayment] = useState("cash")
  const [closing, setClosing] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [todayStats, setTodayStats] = useState({ count: 0, total: 0 })
  const [currentTime, setCurrentTime] = useState("")

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
  const [customName, setCustomName] = useState("")
  const [customPrice, setCustomPrice] = useState("")
  const [loading, setLoading] = useState(true)
  const [cashRegister, setCashRegister] = useState<any>(null)
  const [sendToPrep, setSendToPrep] = useState(false)
  const [printReceipt, setPrintReceipt] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pedefacil-print-receipt") !== "false"
    }
    return true
  })
  const [lastOrder, setLastOrder] = useState<any>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [activeTab, setActiveTab] = useState<"caixa" | "pedidos" | "entregas">("caixa")
  const [orders, setOrders] = useState<any[]>([])
  const [deliveryPeople, setDeliveryPeople] = useState<any[]>([])
  const [activeTable, setActiveTable] = useState<number | null>(null)
  const [tableCarts, setTableCarts] = useState<Record<number, CartItem[]>>({})
  const [nextTableNum, setNextTableNum] = useState(1)
  const [showCashRegisterModal, setShowCashRegisterModal] = useState(false)
  const [cashRegisterAction, setCashRegisterAction] = useState<"open" | "close" | "transfer">("open")
  const [openingAmount, setOpeningAmount] = useState("")
  const [closingAmount, setClosingAmount] = useState("")
  const [transferUserId, setTransferUserId] = useState("")
  const [allUsers, setAllUsers] = useState<any[]>([])

  // Load table state from localStorage
  useEffect(() => {
    if (!user?.establishmentId) return
    const saved = localStorage.getItem(`pedefacil-tables-${user.establishmentId}`)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setTableCarts(parsed.tableCarts || {})
        setNextTableNum(parsed.nextTableNum || 1)
        setActiveTable(parsed.activeTable || null)
        setCart(parsed.activeCart || [])
      } catch {}
    }
  }, [user?.establishmentId])

  // Save table state to localStorage
  useEffect(() => {
    if (!user?.establishmentId) return
    localStorage.setItem(`pedefacil-tables-${user.establishmentId}`, JSON.stringify({
      tableCarts,
      nextTableNum,
      activeTable,
      activeCart: cart,
    }))
  }, [tableCarts, nextTableNum, activeTable, cart, user?.establishmentId])

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
  }, [router])

  async function loadData(establishmentId: string) {
    const promises: Promise<any>[] = [
      fetchAuth(`/api/categories?establishmentId=${establishmentId}`),
      fetchAuth(`/api/orders?establishmentId=${establishmentId}`),
      fetchAuth(`/api/cash-register?establishmentId=${establishmentId}`),
      fetchAuth(`/api/users?establishmentId=${establishmentId}`),
    ]
    if (user?.permissions?.includes("pedidos") || user?.permissions?.includes("entregas")) {
      promises.push(fetchAuth(`/api/delivery-persons?establishmentId=${establishmentId}`))
    }
    const [catRes, orderRes, regRes, usersRes, dpRes] = await Promise.all(promises)
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
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) {
        return prev.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1 }]
    })
  }

  function addCustomItem() {
    if (!customName || !customPrice) return
    setCart((prev) => [...prev, { productId: "custom-" + Date.now(), name: customName, price: Number(customPrice), quantity: 1 }])
    setCustomName("")
    setCustomPrice("")
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((prev) => prev.map((i) => {
      if (i.productId !== productId) return i
      const newQty = i.quantity + delta
      return newQty > 0 ? { ...i, quantity: newQty } : i
    }).filter((i) => i.quantity > 0))
  }

  function removeItem(productId: string) {
    setCart((prev) => prev.filter((i) => i.productId !== productId))
  }

  function selectTable(num: number) {
    if (activeTable !== null) {
      setTableCarts((prev) => ({ ...prev, [activeTable]: cart }))
    }
    setActiveTable(num)
    setCart(tableCarts[num] || [])
  }

  function openNewTable() {
    const num = nextTableNum
    if (activeTable !== null) {
      setTableCarts((prev) => ({ ...prev, [activeTable]: cart }))
    }
    setTableCarts((prev) => ({ ...prev, [num]: [] }))
    setNextTableNum(num + 1)
    setActiveTable(num)
    setCart([])
  }

  function closeTable(num: number) {
    setTableCarts((prev) => {
      const next = { ...prev }
      delete next[num]
      return next
    })
    if (activeTable === num) {
      setActiveTable(null)
      setCart([])
    }
  }

  function deselectTable() {
    if (activeTable !== null) {
      setTableCarts((prev) => ({ ...prev, [activeTable]: cart }))
    }
    setActiveTable(null)
    setCart([])
  }

  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)

  async function finalizeSale() {
    if (!user?.establishmentId || cart.length === 0) return
    setClosing(true)
    try {
      const res = await fetchAuth("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          establishmentId: user.establishmentId,
          customerName: activeTable ? `Mesa ${activeTable}` : "Cliente Balcão",
          items: JSON.stringify(cart),
          total: cartTotal,
          orderType: "presencial",
          paymentMethod: payment,
          method: "caixa",
          status: sendToPrep ? "preparing" : "delivered",
          tableNumber: activeTable,
        }),
      })
      const data = await res.json()
      if (cashRegister) {
        await fetchAuth(`/api/cash-register/${cashRegister.id}/movements`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "sale",
            amount: cartTotal,
            description: `Venda ${activeTable ? `Mesa ${activeTable}` : "Balcão"} - ${payment === "cash" ? "Dinheiro" : payment === "card" ? "Cartão" : "Pix"}`,
            paymentMethod: payment,
          }),
        })
      }
      const orderData = data.order
      setLastOrder({ ...orderData, items: cart, establishmentName: user.establishment?.name })
      if (activeTable) {
        closeTable(activeTable)
      }
      setCart([])
      setActiveTable(null)
      setSendToPrep(false)
      if (printReceipt && orderData) {
        setShowSuccess(true)
        setTimeout(() => {
          setShowSuccess(false)
          setShowReceipt(true)
        }, 1500)
      } else {
        setShowSuccess(true)
        setTimeout(() => setShowSuccess(false), 2000)
      }
      loadData(user.establishmentId)
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
      }
    } catch (err) {
      console.error(err)
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
    } catch (err) {
      console.error(err)
    }
  }

  async function transferCashRegister() {
    if (!cashRegister || !transferUserId || !user?.establishmentId) return
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
      loadData(user.establishmentId)
    } catch (err) {
      console.error(err)
    }
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
  const hasEntregas = user?.permissions?.includes("entregas")
  const showTabs = hasPedidos || hasEntregas

  return (
    <div className="flex h-screen flex-col bg-zinc-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between bg-green-600 px-4 py-2 text-white">
        <div className="flex items-center gap-2">
          {!showTabs ? (
            <button onClick={() => router.push("/dashboard/home")} className="rounded-lg p-1 hover:bg-green-700">
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : null}
          <Store className="h-5 w-5" />
          <span className="font-bold">{user.establishment?.name || "Caixa"}</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            <span>{todayStats.count} vendas</span>
          </div>
          <div className="font-bold">{formatCurrency(todayStats.total)}</div>
        </div>
        <div className="flex items-center gap-2">
          {cashRegister ? (
            <>
              <span className="flex items-center gap-1 rounded-full bg-green-700 px-2 py-0.5 text-[10px] font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-green-300" />
                Caixa Aberto
              </span>
              {user?.canCloseRegister && (
                <button
                  onClick={() => { setCashRegisterAction("close"); setShowCashRegisterModal(true) }}
                  className="rounded-lg bg-red-500 px-2 py-1 text-[10px] font-medium hover:bg-red-600"
                >
                  Fechar
                </button>
              )}
              <button
                onClick={() => { setCashRegisterAction("transfer"); setShowCashRegisterModal(true) }}
                className="rounded-lg bg-green-700 px-2 py-1 text-[10px] font-medium hover:bg-green-800"
              >
                Transferir
              </button>
            </>
          ) : (
            <button
              onClick={() => { setCashRegisterAction("open"); setShowCashRegisterModal(true) }}
              className="rounded-lg bg-yellow-500 px-3 py-1 text-[10px] font-medium hover:bg-yellow-600"
            >
              Abrir Caixa
            </button>
          )}
          <span className="hidden text-sm sm:block">{currentTime}</span>
          <span className="text-sm">{user.name}</span>
          <button onClick={handleLogout} className="rounded-lg bg-green-700 p-1.5 hover:bg-green-800">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      {showTabs && (
        <div className="flex border-b border-zinc-200 bg-white">
          <button
            onClick={() => setActiveTab("caixa")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "caixa"
                ? "border-b-2 border-green-600 text-green-700"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <ShoppingBag className="h-4 w-4" />
              Caixa
            </div>
          </button>
          {hasPedidos && (
            <button
              onClick={() => setActiveTab("pedidos")}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "pedidos"
                  ? "border-b-2 border-green-600 text-green-700"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Package className="h-4 w-4" />
                Pedidos
                {orders.filter((o: any) => ["preparing", "ready", "out_for_delivery"].includes(o.status)).length > 0 && (
                  <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                    {orders.filter((o: any) => ["preparing", "ready", "out_for_delivery"].includes(o.status)).length}
                  </span>
                )}
              </div>
            </button>
          )}
          {hasEntregas && (
            <button
              onClick={() => setActiveTab("entregas")}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "entregas"
                  ? "border-b-2 border-green-600 text-green-700"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Bike className="h-4 w-4" />
                Entregas
              </div>
            </button>
          )}
        </div>
      )}

      {/* Caixa Tab */}
      {activeTab === "caixa" && (
        <>
          {/* Search + Categories */}
          <div className="bg-white px-4 py-2 shadow-sm">
        <div className="mb-2 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar produto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-8 text-sm focus:border-green-500 focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          <button
            onClick={() => setActiveCategory("all")}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeCategory === "all" ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-600"
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeCategory === cat.id ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-600"
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
            <div className="mb-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
              Abra o caixa no financeiro antes de vender
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="flex flex-col items-center rounded-xl border border-zinc-200 bg-white p-3 transition-all hover:border-green-400 hover:shadow-md active:scale-95"
              >
                {product.image ? (
                  <img src={product.image} alt={product.name} className="mb-2 h-14 w-14 rounded-lg object-cover" />
                ) : (
                  <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-lg bg-zinc-100 text-2xl">🍕</div>
                )}
                <p className="w-full truncate text-center text-xs font-medium text-zinc-800">{product.name}</p>
                <p className="text-xs font-bold text-green-600">{formatCurrency(product.price)}</p>
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full py-12 text-center text-sm text-zinc-400">
                Nenhum produto encontrado
              </div>
            )}
          </div>

          {/* Custom item */}
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 p-2">
            <input
              placeholder="Item avulso"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="flex-1 rounded border border-zinc-200 px-2 py-1.5 text-xs focus:border-green-500 focus:outline-none"
            />
            <input
              placeholder="R$"
              type="number"
              step="0.01"
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
              className="w-20 rounded border border-zinc-200 px-2 py-1.5 text-xs focus:border-green-500 focus:outline-none"
            />
            <button
              onClick={addCustomItem}
              disabled={!customName || !customPrice}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {/* Tables */}
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">Mesas</p>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {Object.keys(tableCarts).sort((a, b) => Number(a) - Number(b)).map((key) => {
                const num = Number(key)
                const items = tableCarts[num] || []
                const total = items.reduce((s, i) => s + i.price * i.quantity, 0)
                const isActive = activeTable === num
                return (
                  <div
                    key={num}
                    className={`relative flex h-40 min-w-[8rem] flex-col items-center justify-center rounded-2xl border-2 p-3 transition-all cursor-pointer overflow-hidden ${
                      isActive
                        ? "border-green-500 bg-green-50 shadow-lg"
                        : "border-zinc-200 bg-white hover:border-green-300 hover:shadow-md"
                    }`}
                    onClick={() => selectTable(num)}
                  >
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.04]">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full"><path d="M2 7h20v2H2V7zm1 3h4l1 10h10l1-10h4v10H3V10zm15-6h2v3h-2V4zM4 4h2v3H4V4z"/></svg>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); closeTable(num) }}
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 z-10"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <span className={`text-2xl font-bold z-10 ${isActive ? "text-green-700" : "text-zinc-700"}`}>{num}</span>
                    {items.length > 0 && (
                      <span className="text-xs text-zinc-500 z-10">{items.length} it{items.length === 1 ? "em" : "ens"}</span>
                    )}
                    {total > 0 && (
                      <span className="text-xs font-medium text-green-600 z-10">{formatCurrency(total)}</span>
                    )}
                    {items.length === 0 && total === 0 && (
                      <span className="text-[10px] text-zinc-400 z-10">Vazia</span>
                    )}
                  </div>
                )
              })}
              <div
                className="flex h-40 min-w-[8rem] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-white text-zinc-400 transition-colors hover:border-green-400 hover:text-green-600 cursor-pointer"
                onClick={openNewTable}
              >
                <Plus className="h-6 w-6" />
                <span className="mt-1 text-xs font-medium">Nova mesa</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cart + Summary */}
        <div className="flex w-80 flex-col border-l border-zinc-200 bg-white">
          {/* Cart Header */}
          <div className="border-b border-zinc-100 px-4 py-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-800">
                {activeTable ? `Mesa ${activeTable}` : "Venda Atual"}
              </h2>
              {activeTable !== null && (
                <button
                  onClick={deselectTable}
                  className="flex items-center gap-1 rounded-lg bg-zinc-100 px-2 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-200"
                >
                  <X className="h-3 w-3" />
                  Balcão
                </button>
              )}
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                <ShoppingBag className="mb-2 h-8 w-8" />
                <p className="text-xs">Toque nos produtos para adicionar</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.productId} className="flex items-center gap-2 rounded-lg bg-zinc-50 p-2">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-medium text-zinc-800">{item.name}</p>
                      <p className="text-[10px] text-zinc-500">{formatCurrency(item.price)} x {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQuantity(item.productId, -1)}
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-[10px] hover:bg-zinc-300"
                      >
                        <Minus className="h-2.5 w-2.5" />
                      </button>
                      <span className="w-5 text-center text-xs font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, 1)}
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-[10px] hover:bg-zinc-300"
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
          <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-700">Total</span>
              <span className="text-xl font-bold text-green-600">{formatCurrency(cartTotal)}</span>
            </div>

            {/* Send to preparation */}
            <label className="mb-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sendToPrep}
                onChange={(e) => setSendToPrep(e.target.checked)}
                className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <div className="flex-1">
                <p className="text-xs font-medium text-amber-800">Enviar para preparo</p>
                <p className="text-[10px] text-amber-600">Aparece no módulo Pedidos</p>
              </div>
            </label>

            {/* Print receipt */}
            <label className="mb-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 cursor-pointer select-none">
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
                <p className="text-xs font-medium text-blue-800">Gerar cupom</p>
                <p className="text-[10px] text-blue-600">Imprimir após venda</p>
              </div>
            </label>

            {/* Payment */}
            <div className="mb-3 flex gap-1.5">
              {[
                { value: "cash", icon: Banknote, label: "Dinheiro", color: "green" },
                { value: "card", icon: CreditCard, label: "Cartão", color: "blue" },
                { value: "pix", icon: DollarSign, label: "Pix", color: "purple" },
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPayment(p.value)}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-lg border p-2 text-[10px] font-medium transition-colors ${
                    payment === p.value
                      ? `border-${p.color}-500 bg-${p.color}-50 text-${p.color}-700`
                      : "border-zinc-200 text-zinc-500"
                  }`}
                >
                  <p.icon className="h-3 w-3" />
                  {p.label}
                </button>
              ))}
            </div>

            <button
              onClick={finalizeSale}
              disabled={closing || cart.length === 0 || !cashRegister}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-base font-bold text-white transition-colors hover:bg-green-700 disabled:opacity-50 active:scale-[0.98]"
            >
              {closing ? (
                "Registrando..."
              ) : !cashRegister ? (
                "Abra o caixa no financeiro antes de vender"
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  {activeTable ? `FINALIZAR MESA ${activeTable}` : "FINALIZAR VENDA"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
        </>
      )}

      {/* Pedidos Tab */}
      {activeTab === "pedidos" && (
        <PedidosTab orders={orders} deliveryPeople={deliveryPeople} establishmentId={user?.establishmentId || ""} onRefresh={() => loadData(user?.establishmentId || "")} />
      )}

      {/* Entregas Tab */}
      {activeTab === "entregas" && (
        <EntregasTab orders={orders} deliveryPeople={deliveryPeople} establishmentId={user?.establishmentId || ""} onRefresh={() => loadData(user?.establishmentId || "")} />
      )}

      {/* Success overlay */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="rounded-2xl bg-white p-8 shadow-2xl animate-bounce">
            <div className="flex flex-col items-center">
              <CheckCircle className="mb-3 h-16 w-16 text-green-500" />
              <p className="text-lg font-bold text-zinc-900">
                {sendToPrep ? "Pedido enviado para preparo!" : "Venda registrada!"}
              </p>
              {lastOrder && (
                <p className="text-sm text-zinc-500 mt-1">
                  Pedido #{lastOrder.orderNumber || lastOrder.id?.slice(0, 8)}
                </p>
              )}
              {sendToPrep && <p className="text-sm text-zinc-500">Acompanhe no módulo Pedidos</p>}
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
              <p className="text-sm text-zinc-500">Pedido gerado com sucesso!</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  printReceiptPopup(lastOrder)
                  setShowReceipt(false)
                  setShowSuccess(false)
                }}
                className="flex-1 rounded-lg bg-green-600 px-4 py-3 text-sm font-bold text-white hover:bg-green-700"
              >
                Imprimir
              </button>
              <button
                onClick={() => {
                  setShowReceipt(false)
                  setShowSuccess(false)
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
          <div className="rounded-2xl bg-white p-6 shadow-2xl w-full max-w-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900">
                {cashRegisterAction === "open" ? "Abrir Caixa" : cashRegisterAction === "close" ? "Fechar Caixa" : "Transferir Caixa"}
              </h3>
              <button onClick={() => setShowCashRegisterModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {cashRegisterAction === "open" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-zinc-500">Valor em caixa (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={openingAmount}
                    onChange={(e) => setOpeningAmount(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                  />
                </div>
                <button onClick={openCashRegister} className="w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700">
                  Abrir Caixa
                </button>
              </div>
            )}

            {cashRegisterAction === "close" && (
              <div className="space-y-3">
                <div className="rounded-lg bg-zinc-50 p-3 text-sm">
                  <p className="text-zinc-500">Valor esperado: <span className="font-bold text-zinc-900">{formatCurrency(
                    (cashRegister?.openingAmount || 0) + (cashRegister?.movements || []).reduce((s: number, m: any) => s + m.amount, 0)
                  )}</span></p>
                </div>
                <div>
                  <label className="text-xs text-zinc-500">Valor contado (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={closingAmount}
                    onChange={(e) => setClosingAmount(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
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
                  <label className="text-xs text-zinc-500">Transferir para</label>
                  <select
                    value={transferUserId}
                    onChange={(e) => setTransferUserId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
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
    </div>
  )
}

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  preparing: "Preparando",
  ready: "Pronto",
  out_for_delivery: "Saiu p/ Entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
}

const statusColors: Record<string, string> = {
  pending: "bg-zinc-100 text-zinc-600",
  preparing: "bg-amber-100 text-amber-700",
  ready: "bg-green-100 text-green-700",
  out_for_delivery: "bg-blue-100 text-blue-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
}

function PedidosTab({ orders, deliveryPeople, establishmentId, onRefresh }: { orders: any[]; deliveryPeople: any[]; establishmentId: string; onRefresh: () => void }) {
  const [filter, setFilter] = useState("all")
  const activeOrders = orders.filter((o: any) => {
    if (!["preparing", "ready", "out_for_delivery"].includes(o.status)) return false
    if (filter === "all") return true
    if (filter === "preparing") return o.status === "preparing"
    if (filter === "ready") return o.status === "ready"
    if (filter === "out_for_delivery") return o.status === "out_for_delivery"
    return true
  })

  async function updateStatus(orderId: string, status: string) {
    await fetchAuth(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    onRefresh()
  }

  async function updateDeliveryPerson(orderId: string, deliveryPersonId: string, deliveryPersonName: string) {
    await fetchAuth(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryPersonId, deliveryPersonName }),
    })
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
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f.value ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {activeOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
          <Package className="mb-2 h-8 w-8" />
          <p className="text-sm">Nenhum pedido ativo</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeOrders.map((order) => {
            const items = typeof order.items === "string" ? JSON.parse(order.items) : order.items
            const isPresencial = order.orderType === "presencial"
            const isLocked = isPresencial
              ? ["delivered", "cancelled"].includes(order.status)
              : ["ready", "out_for_delivery", "delivered"].includes(order.status)

            return (
              <div key={order.id} className="rounded-xl border border-zinc-200 bg-white p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {order.orderNumber && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                          #{order.orderNumber}
                        </span>
                      )}
                      <span className="font-medium text-zinc-900">{order.customerName}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[order.status]}`}>
                        {statusLabels[order.status]}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {items.map((i: any) => `${i.quantity}x ${i.name}`).join(", ")}
                    </div>
                    <p className="mt-1 text-sm font-bold text-green-600">{formatCurrency(order.total)}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <select
                      value={order.status}
                      onChange={(e) => updateStatus(order.id, e.target.value)}
                      disabled={isLocked}
                      className="rounded-lg border border-zinc-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50"
                    >
                      <option value="preparing">Preparando</option>
                      <option value="ready">Pronto</option>
                      {!isPresencial && <option value="out_for_delivery">Saiu p/ Entrega</option>}
                      <option value="delivered">Entregue</option>
                    </select>
                    {!isPresencial && (
                      <select
                        value={order.deliveryPersonId || ""}
                        onChange={(e) => {
                          const id = e.target.value
                          const person = deliveryPeople.find((p: any) => p.id === id)
                          updateDeliveryPerson(order.id, id, person?.name || "")
                        }}
                        disabled={isLocked}
                        className="rounded-lg border border-zinc-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50"
                      >
                        <option value="">Sem motoboy</option>
                        {deliveryPeople.map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
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

function EntregasTab({ orders, deliveryPeople, establishmentId, onRefresh }: { orders: any[]; deliveryPeople: any[]; establishmentId: string; onRefresh: () => void }) {
  const activeOrders = orders.filter((o: any) =>
    ["ready", "out_for_delivery"].includes(o.status) && o.orderType !== "presencial"
  )

  const groupedByPerson: Record<string, any[]> = {}
  for (const order of activeOrders) {
    const key = order.deliveryPersonId || "unassigned"
    if (!groupedByPerson[key]) groupedByPerson[key] = []
    groupedByPerson[key].push(order)
  }

  async function updateStatus(orderId: string, status: string) {
    await fetchAuth(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    onRefresh()
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {activeOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
          <Bike className="mb-2 h-8 w-8" />
          <p className="text-sm">Nenhuma entrega ativa</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByPerson).map(([personId, personOrders]) => {
            const person = deliveryPeople.find((p: any) => p.id === personId)
            return (
              <div key={personId} className="rounded-xl border border-zinc-200 bg-white p-3">
                <div className="mb-2 flex items-center gap-2 border-b border-zinc-100 pb-2">
                  <Bike className="h-4 w-4 text-zinc-400" />
                  <span className="font-medium text-zinc-900">{person?.name || "Sem motoboy"}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">
                    {personOrders.length} pedidos
                  </span>
                </div>
                <div className="space-y-2">
                  {personOrders.map((order) => {
                    const items = typeof order.items === "string" ? JSON.parse(order.items) : order.items
                    return (
                      <div key={order.id} className="flex items-center justify-between rounded-lg bg-zinc-50 p-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {order.orderNumber && (
                              <span className="text-xs font-bold text-green-600">#{order.orderNumber}</span>
                            )}
                            <span className="text-sm font-medium text-zinc-900">{order.customerName}</span>
                          </div>
                          {order.customerAddress && (
                            <p className="flex items-center gap-1 text-[10px] text-zinc-500">
                              <MapPin className="h-3 w-3" />{order.customerAddress}
                            </p>
                          )}
                          <p className="text-xs text-zinc-500">{formatCurrency(order.total)}</p>
                        </div>
                        <div className="flex gap-1">
                          {order.status === "ready" && (
                            <button
                              onClick={() => updateStatus(order.id, "out_for_delivery")}
                              className="rounded-lg bg-blue-500 px-2 py-1 text-[10px] font-medium text-white hover:bg-blue-600"
                            >
                              Saiu
                            </button>
                          )}
                          {order.status === "out_for_delivery" && (
                            <button
                              onClick={() => updateStatus(order.id, "delivered")}
                              className="rounded-lg bg-green-500 px-2 py-1 text-[10px] font-medium text-white hover:bg-green-600"
                            >
                              Entregue
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
