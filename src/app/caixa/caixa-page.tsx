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
  const [activeTab, setActiveTab] = useState<"caixa" | "balcao" | "pedidos">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("pedefacil-caixa-tab") as any) || "caixa"
    }
    return "caixa"
  })
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
  const [closingTableModal, setClosingTableModal] = useState(false)
  const [closingTableNumber, setClosingTableNumber] = useState<number | null>(null)
  const [closingTablePayment, setClosingTablePayment] = useState("cash")
  const [tableNames, setTableNames] = useState<Record<number, string>>({})
  const [newTableName, setNewTableName] = useState("")
  const [showTableNameModal, setShowTableNameModal] = useState(false)

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
        setTableNames(parsed.tableNames || {})
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
      tableNames,
    }))
  }, [tableCarts, nextTableNum, activeTable, cart, user?.establishmentId])

  useEffect(() => {
    localStorage.setItem("pedefacil-caixa-tab", activeTab)
  }, [activeTab])

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

    // Cross-tab sync: listen for changes from other tabs
    function handleStorage(e: StorageEvent) {
      if (e.key === "pedefacil-last-action" && e.newValue) {
        loadData(userData.establishmentId)
      }
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
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
    setNewTableName("")
    setShowTableNameModal(true)
  }

  function confirmNewTable() {
    const num = nextTableNum
    if (activeTable !== null) {
      setTableCarts((prev) => ({ ...prev, [activeTable]: cart }))
    }
    setTableCarts((prev) => ({ ...prev, [num]: [] }))
    if (newTableName.trim()) {
      setTableNames((prev) => ({ ...prev, [num]: newTableName.trim() }))
    }
    setNextTableNum(num + 1)
    setActiveTable(num)
    setCart([])
    setShowTableNameModal(false)
    setNewTableName("")
  }

  function closeTable(num: number) {
    const items = tableCarts[num] || []
    const tableOrders = orders.filter((o: any) => o.tableNumber === num && o.orderType === "presencial" && !["delivered", "cancelled"].includes(o.status))
    if (tableOrders.length > 0 || items.length > 0) {
      setClosingTableNumber(num)
      setClosingTablePayment("cash")
      setClosingTableModal(true)
      return
    }
    setTableCarts((prev) => {
      const next = { ...prev }
      delete next[num]
      return next
    })
    setTableNames((prev) => {
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
    try {
      const res = await fetchAuth("/api/cash-register/close-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber: closingTableNumber,
          establishmentId: user.establishmentId,
          paymentMethod: closingTablePayment,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        // Clear table from localStorage
        setTableCarts((prev) => {
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
        alert(`Mesa fechada! ${data.ordersClosed} pedido(s) - ${formatCurrency(data.total)}`)
        loadData(user.establishmentId)
      } else {
        alert(data.error || "Erro ao fechar mesa")
      }
    } catch (err) {
      console.error(err)
      alert("Erro ao fechar mesa")
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
    const isMesa = activeTable !== null
    const tableLabel = isMesa ? (tableNames[activeTable] ? `Mesa ${activeTable} - ${tableNames[activeTable]}` : `Mesa ${activeTable}`) : "Balcão"

    if (isMesa) {
      if (!confirm(`Adicionar pedido à ${tableLabel}? (Pagamento será cobrado no fechamento da mesa)`)) return
    } else {
      if (!confirm(`Finalizar venda ${tableLabel} - ${formatCurrency(cartTotal)}?`)) return
    }

    setClosing(true)
    try {
      // Optimistic: create temporary order for instant UI feedback
      const tempId = `temp-${Date.now()}`
      const tempOrder = {
        id: tempId,
        orderNumber: Math.floor(Math.random() * 9000) + 1000,
        establishmentId: user.establishmentId,
        customerName: tableLabel,
        items: JSON.stringify(cart),
        total: cartTotal,
        orderType: "presencial",
        paymentMethod: isMesa ? "pending" : payment,
        method: "caixa",
        status: sendToPrep ? "preparing" : (isMesa ? "new" : "delivered"),
        tableNumber: activeTable,
        createdAt: new Date().toISOString(),
        deliveredAt: sendToPrep ? null : (isMesa ? null : new Date().toISOString()),
      }
      if (sendToPrep || isMesa) {
        setOrders((prev) => [tempOrder, ...prev])
      }

      const res = await fetchAuth("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          establishmentId: user.establishmentId,
          customerName: tableLabel,
          items: JSON.stringify(cart),
          total: cartTotal,
          orderType: "presencial",
          paymentMethod: isMesa ? "pending" : payment,
          method: "caixa",
          status: sendToPrep ? "preparing" : (isMesa ? "new" : "delivered"),
          tableNumber: activeTable,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        console.error("Erro ao criar pedido:", data)
        // Remove optimistic temp order
        setOrders((prev) => prev.filter((o) => o.id !== tempId))
        alert(data.error || "Erro ao criar pedido")
        return
      }

      // Only record cash movement for balcão (immediate payment)
      if (!isMesa && cashRegister) {
        await fetchAuth(`/api/cash-register/${cashRegister.id}/movements`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "sale",
            amount: cartTotal,
            description: `Venda Balcão - ${payment === "cash" ? "Dinheiro" : payment === "card" ? "Cartão" : "Pix"}`,
            paymentMethod: payment,
          }),
        })
      }

      const orderData = data.order
      if (!orderData) {
        console.error("Pedido criado mas dados não retornados:", data)
        alert("Pedido registrado, mas houve um erro ao exibir. Atualize a página.")
        loadData(user.establishmentId)
        setCart([])
        if (!isMesa) setActiveTable(null)
        return
      }

      setLastOrder({ ...orderData, items: cart, establishmentName: user.establishment?.name })

      // Update orders in real time - replace temp with real order
      setOrders((prev) => prev.map((o) => o.id === tempId ? orderData : o))
      // If temp wasn't added (e.g. balcão without sendToPrep), add it
      if (!sendToPrep && !isMesa) {
        setOrders((prev) => [orderData, ...prev])
      }

      // Notify other tabs
      localStorage.setItem("pedefacil-last-action", JSON.stringify({ type: "order-created", ts: Date.now() }))

      // Don't close table for mesa - keep it open for more orders
      setCart([])
      if (!isMesa) {
        setActiveTable(null)
      }
      setSendToPrep(false)

      if (!isMesa && printReceipt && orderData) {
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
    const toUser = allUsers.find((u: any) => u.id === transferUserId)
    if (!confirm(`Transferir caixa para ${toUser?.name || "outro atendente"}? Você será desconectado.`)) return
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
      handleLogout()
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
  const showTabs = hasPedidos

  // Count presencial orders for "Pedidos Balcão" badge
  const balcaoOrders = orders.filter((o: any) => o.orderType === "presencial" && ["preparing", "ready"].includes(o.status))
  const balcaoReadyCount = orders.filter((o: any) => o.orderType === "presencial" && o.status === "ready").length
  // Count external orders for "Pedidos Externos" badge
  const externalOrders = orders.filter((o: any) => o.orderType !== "presencial" && ["preparing", "ready", "out_for_delivery"].includes(o.status))

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
              onClick={() => setActiveTab("balcao")}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "balcao"
                  ? "border-b-2 border-green-600 text-green-700"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Store className="h-4 w-4" />
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
                  ? "border-b-2 border-green-600 text-green-700"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Package className="h-4 w-4" />
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
              <p className="text-[10px] text-zinc-400">Duplo clique para fechar</p>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {Object.keys(tableCarts).sort((a, b) => Number(a) - Number(b)).map((key) => {
                const num = Number(key)
                const items = tableCarts[num] || []
                const cartTotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
                const tableOrdersTotal = orders
                  .filter((o: any) => o.tableNumber === num && o.orderType === "presencial" && !["delivered", "cancelled"].includes(o.status))
                  .reduce((s: number, o: any) => s + o.total, 0)
                const total = cartTotal + tableOrdersTotal
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
                    onDoubleClick={() => {
                      setClosingTableNumber(num)
                      setClosingTablePayment("cash")
                      setClosingTableModal(true)
                    }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.04]">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full"><path d="M2 7h20v2H2V7zm1 3h4l1 10h10l1-10h4v10H3V10zm15-6h2v3h-2V4zM4 4h2v3H4V4z"/></svg>
                    </div>
                    {total === 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); closeTable(num) }}
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 z-10"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <span className={`text-2xl font-bold z-10 ${isActive ? "text-green-700" : "text-zinc-700"}`}>{num}</span>
                    {tableNames[num] && (
                      <span className={`text-xs font-medium z-10 ${isActive ? "text-green-600" : "text-zinc-500"}`}>{tableNames[num]}</span>
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
              disabled={closing || cart.length === 0 || (!cashRegister && !activeTable)}
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

      {/* Pedidos Balcão Tab */}
      {activeTab === "balcao" && (
        <BalcaoTab orders={orders} tableNames={tableNames} establishmentId={user?.establishmentId || ""} onRefresh={() => loadData(user?.establishmentId || "")} />
      )}

      {/* Pedidos Externos Tab */}
      {activeTab === "pedidos" && (
        <PedidosTab orders={orders} deliveryPeople={deliveryPeople} establishmentId={user?.establishmentId || ""} onRefresh={() => loadData(user?.establishmentId || "")} />
      )}

      {/* Success overlay */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="rounded-2xl bg-white p-8 shadow-2xl animate-bounce">
            <div className="flex flex-col items-center">
              <CheckCircle className="mb-3 h-16 w-16 text-green-500" />
              <p className="text-lg font-bold text-zinc-900">
                {activeTable ? (sendToPrep ? "Pedido adicionado e enviado para preparo!" : "Pedido adicionado à mesa!") : sendToPrep ? "Pedido enviado para preparo!" : "Venda registrada!"}
              </p>
              {lastOrder && (
                <p className="text-sm text-zinc-500 mt-1">
                  Pedido #{lastOrder.orderNumber || lastOrder.id?.slice(0, 8)}
                </p>
              )}
              {activeTable && !sendToPrep && <p className="text-sm text-zinc-500">Pagamento será cobrado no fechamento da mesa</p>}
              {activeTable && sendToPrep && <p className="text-sm text-zinc-500">Acompanhe no módulo Pedidos</p>}
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

      {/* Close Table Modal */}
      {closingTableModal && closingTableNumber !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-2xl bg-white p-6 shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900">
                Mesa {closingTableNumber}{tableNames[closingTableNumber] ? ` - ${tableNames[closingTableNumber]}` : ""}
              </h3>
              <button onClick={() => { setClosingTableModal(false); setClosingTableNumber(null) }} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            {(() => {
              const tableOrders = orders.filter((o: any) => o.tableNumber === closingTableNumber && o.orderType === "presencial" && !["cancelled"].includes(o.status))
              const pendingOrders = tableOrders.filter((o: any) => o.status !== "delivered")
              const deliveredOrders = tableOrders.filter((o: any) => o.status === "delivered")
              const total = tableOrders.reduce((s: number, o: any) => s + o.total, 0)
              return (
                <div className="space-y-3 overflow-y-auto flex-1 min-h-0">
                  {tableOrders.length === 0 ? (
                    <p className="text-sm text-zinc-400 text-center py-4">Nenhum pedido para esta mesa</p>
                  ) : (
                    <>
                      {/* Pending orders */}
                      {pendingOrders.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-amber-600 mb-2">Pedidos pendentes ({pendingOrders.length})</p>
                          <div className="space-y-2">
                            {pendingOrders.map((o: any) => {
                              const items = typeof o.items === "string" ? JSON.parse(o.items) : o.items
                              return (
                                <div key={o.id} className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium text-zinc-700">
                                      {o.orderNumber && `#${o.orderNumber} `}
                                      {o.customerName}
                                    </span>
                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                      o.status === "new" ? "bg-zinc-100 text-zinc-600" :
                                      o.status === "preparing" ? "bg-amber-100 text-amber-700" :
                                      "bg-green-100 text-green-700"
                                    }`}>
                                      {o.status === "new" ? "Novo" : o.status === "preparing" ? "Preparando" : "Pronto"}
                                    </span>
                                  </div>
                                  <p className="text-xs text-zinc-500">{items.map((i: any) => `${i.quantity}x ${i.name}`).join(", ")}</p>
                                  <p className="text-xs font-medium text-green-600 mt-1">{formatCurrency(o.total)}</p>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Delivered orders */}
                      {deliveredOrders.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-green-600 mb-2">Já entregues ({deliveredOrders.length})</p>
                          <div className="space-y-2">
                            {deliveredOrders.map((o: any) => {
                              const items = typeof o.items === "string" ? JSON.parse(o.items) : o.items
                              return (
                                <div key={o.id} className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium text-zinc-700">
                                      {o.orderNumber && `#${o.orderNumber} `}
                                      {o.customerName}
                                    </span>
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                      Entregue
                                    </span>
                                  </div>
                                  <p className="text-xs text-zinc-500">{items.map((i: any) => `${i.quantity}x ${i.name}`).join(", ")}</p>
                                  <p className="text-xs font-medium text-green-600 mt-1">{formatCurrency(o.total)}</p>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Total */}
                      <div className="rounded-lg bg-green-50 p-3 text-sm border border-green-200 sticky bottom-0">
                        <div className="flex justify-between items-center">
                          <span className="text-green-700 font-medium">Total</span>
                          <span className="text-lg font-bold text-green-700">{formatCurrency(total)}</span>
                        </div>
                      </div>

                      {/* Payment */}
                      <div>
                        <label className="text-xs text-zinc-500">Forma de pagamento</label>
                        <div className="flex gap-2 mt-1">
                          {[
                            { value: "cash", label: "Dinheiro" },
                            { value: "card", label: "Cartão" },
                            { value: "pix", label: "Pix" },
                          ].map((p) => (
                            <button
                              key={p.value}
                              onClick={() => setClosingTablePayment(p.value)}
                              className={`flex-1 rounded-lg border p-2 text-xs font-medium transition-colors ${
                                closingTablePayment === p.value
                                  ? "border-green-500 bg-green-50 text-green-700"
                                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button onClick={handleCloseTable} className="w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700">
                        Fechar Mesa e Cobrar
                      </button>
                    </>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Table Name Modal */}
      {showTableNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-2xl bg-white p-6 shadow-2xl w-full max-w-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900">Nova Mesa {nextTableNum}</h3>
              <button onClick={() => setShowTableNameModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500">Nome do cliente (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: João"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") confirmNewTable() }}
                />
                <p className="mt-1 text-[10px] text-zinc-400">{`Se preencher, aparecerá como "Mesa ${nextTableNum} - ${newTableName || "João"}"`}</p>
              </div>
              <button onClick={confirmNewTable} className="w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700">
                Abrir Mesa
              </button>
            </div>
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

function PedidosTab({ orders, deliveryPeople, establishmentId, onRefresh }: { orders: any[]; deliveryPeople: any[]; establishmentId: string; onRefresh: () => void }) {
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
    // Optimistic: notify and refresh
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
                filter === f.value ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {f.label}
              {count > 0 && (
                <span className={`ml-1 rounded-full px-1 py-0.5 text-[9px] font-bold ${
                  filter === f.value ? "bg-white/20" : "bg-zinc-200"
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {activeOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
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
              <div key={order.id} className={`rounded-xl border bg-white p-3 ${
                order.status === "ready" && isPickup ? "border-amber-300 shadow-sm" : "border-zinc-200"
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {order.orderNumber && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                          #{order.orderNumber}
                        </span>
                      )}
                      <span className="font-medium text-zinc-900">{order.customerName}</span>
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
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                        {isPickup ? "Retirada" : "Entrega"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {items.map((i: any) => `${i.quantity}x ${i.name}`).join(", ")}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-sm font-bold text-green-600">{formatCurrency(order.total)}</p>
                      {order.status === "delivered" && motoboyName && (
                        <span className="text-[10px] text-zinc-400">via {motoboyName}</span>
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

                  {/* Buttons - "Prontos" tab, pickup orders only */}
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

      {/* Payment Modal for Pickup Orders */}
      {payModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-2xl bg-white p-6 shadow-2xl w-full max-w-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900">Pagar Pedido #{payModalOrder.orderNumber}</h3>
              <button onClick={() => setPayModalOrder(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg bg-zinc-50 p-3 text-sm">
                <p className="text-zinc-500">{payModalOrder.customerName}</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(payModalOrder.total)}</p>
              </div>
              <div>
                <label className="text-xs text-zinc-500">Forma de pagamento</label>
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

function BalcaoTab({ orders, tableNames, establishmentId, onRefresh }: { orders: any[]; tableNames: Record<number, string>; establishmentId: string; onRefresh: () => void }) {
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
              filter === f.value ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {f.label}
            {f.count > 0 && (
              <span className={`ml-1 rounded-full px-1 py-0.5 text-[9px] font-bold ${
                filter === f.value ? "bg-white/20" : "bg-zinc-200"
              }`}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {balcaoOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
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
            const tableLabel = isTable ? (tableNames[order.tableNumber] ? `Mesa ${order.tableNumber} - ${tableNames[order.tableNumber]}` : `Mesa ${order.tableNumber}`) : null

            return (
              <div key={order.id} className={`rounded-xl border bg-white p-3 ${
                order.status === "ready" && !isTable ? "border-amber-400 shadow-md" : "border-zinc-200"
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
                        <span className="font-medium text-zinc-900">{tableLabel}</span>
                      ) : (
                        <span className="font-medium text-zinc-900">{order.customerName}</span>
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
                    <div className="mt-1 text-xs text-zinc-500">
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
