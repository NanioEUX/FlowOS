"use client"

import { useState, useEffect, useCallback } from "react"
import { Minus, Plus, X, ShoppingBag, CheckCircle, Loader2, Sun, Moon, Banknote, QrCode, Users, MinusCircle, Clock, UtensilsCrossed, ChevronDown, MessageSquare } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { CartItem } from "@/types"
import QRCode from "qrcode"

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
  primaryColor: string
  backgroundColor: string
  textColor: string
  headerColor: string
  colorsPublished: boolean
  defaultTheme: string
  tableCount: number
  categories: Category[]
}

interface OrderItem {
  productId: string
  name: string
  price: number
  quantity: number
}

interface TableOrder {
  id: string
  orderNumber: number | null
  items: string
  total: number
  status: string
  createdAt: string
}

interface TableStatus {
  open: boolean
  ordersCount: number
  totalPending: number
  orders: TableOrder[]
}

type RightTab = "cart" | "orders"
type PaymentMode = "menu" | "unique" | "split" | "each" | "discount"

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  new: { label: "Novo", color: "text-blue-500 bg-blue-50 dark:bg-blue-950", icon: Clock },
  preparing: { label: "Preparando", color: "text-amber-500 bg-amber-50 dark:bg-amber-950", icon: UtensilsCrossed },
  ready: { label: "Pronto", color: "text-green-500 bg-green-50 dark:bg-green-950", icon: CheckCircle },
  delivered: { label: "Entregue", color: "text-zinc-400 bg-zinc-50 dark:bg-zinc-800", icon: CheckCircle },
}

interface Props {
  establishment: Establishment
  tableNumber: number
}

export function MesaPage({ establishment: est, tableNumber }: Props) {
  const [darkMode, setDarkMode] = useState(() => est.defaultTheme !== "light")
  const [cart, setCart] = useState<CartItem[]>([])
  const [activeCategory, setActiveCategory] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [tableStatus, setTableStatus] = useState<TableStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [rightTab, setRightTab] = useState<RightTab>("cart")
  const [showPaymentMenu, setShowPaymentMenu] = useState(false)
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("menu")
  const [pixQrCode, setPixQrCode] = useState<string | null>(null)
  const [pixLoading, setPixLoading] = useState(false)
  const [splitCount, setSplitCount] = useState("2")
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [discountAmount, setDiscountAmount] = useState("")
  const [orderNotes, setOrderNotes] = useState("")
  const [showNotes, setShowNotes] = useState(false)

  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)

  function isLightColor(hex: string): boolean {
    const c = hex.replace("#", "")
    const r = parseInt(c.substring(0, 2), 16)
    const g = parseInt(c.substring(2, 4), 16)
    const b = parseInt(c.substring(4, 6), 16)
    return (r * 299 + g * 587 + b * 114) / 1000 > 160
  }

  const headerBg = est.colorsPublished ? est.headerColor : darkMode ? "#18181b" : "#ffffff"
  const headerTextColor = est.colorsPublished && isLightColor(est.headerColor) ? "text-zinc-900" : darkMode ? "text-white" : "text-zinc-900"
  const headerSubtext = est.colorsPublished && isLightColor(est.headerColor) ? "text-zinc-500" : darkMode ? "text-zinc-400" : "text-zinc-500"

  const checkTable = useCallback(async () => {
    try {
      const res = await fetch(`/api/table-status?slug=${est.slug}&table=${tableNumber}`)
      if (res.ok) {
        const data = await res.json()
        setTableStatus(data)
      }
    } catch {}
    setLoading(false)
  }, [est.slug, tableNumber])

  useEffect(() => {
    checkTable()
    const interval = setInterval(checkTable, 10000)
    return () => clearInterval(interval)
  }, [checkTable])

  const filteredProducts = est.categories
    .flatMap((cat) => cat.products)
    .filter((p) => {
      if (searchQuery) return p.name.toLowerCase().includes(searchQuery.toLowerCase())
      if (activeCategory === "all") return true
      return est.categories.find((c) => c.id === activeCategory)?.products.some((pr) => pr.id === p.id)
    })

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id)
      if (existing) return prev.map((i) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { id: product.id, name: product.name, price: product.price, quantity: 1 }]
    })
    setRightTab("cart")
  }

  function updateQuantity(id: string, delta: number) {
    setCart((prev) => prev.map((i) => {
      if (i.id !== id) return i
      const newQty = i.quantity + delta
      return newQty > 0 ? { ...i, quantity: newQty } : i
    }).filter((i) => i.quantity > 0))
  }

  function removeItem(id: string) {
    setCart((prev) => prev.filter((i) => i.id !== id))
  }

  async function sendOrder() {
    if (cart.length === 0) return
    setSending(true)
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          establishmentId: est.id,
          customerName: `Mesa ${tableNumber}`,
          items: JSON.stringify(cart),
          total: cartTotal,
          orderType: "presencial",
          tableNumber,
          paymentMethod: "pending",
          method: "tablet",
          status: "new",
          notes: orderNotes || null,
        }),
      })
      if (res.ok) {
        setCart([])
        setOrderNotes("")
        setShowNotes(false)
        setShowSuccess(true)
        setRightTab("orders")
        setTimeout(() => setShowSuccess(false), 2500)
        checkTable()
      }
    } catch {}
    setSending(false)
  }

  async function generatePix(amount: number, description: string) {
    setPixLoading(true)
    try {
      const res = await fetch("/api/pix-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          establishmentId: est.id,
          amount,
          description: `${est.name} - Mesa ${tableNumber} - ${description}`,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.invoiceUrl) {
          window.open(data.invoiceUrl, "_blank")
          resetPayment()
        } else if (data.pixPayload) {
          const qr = await QRCode.toDataURL(data.pixPayload, { width: 280, margin: 2 })
          setPixQrCode(qr)
        }
      }
    } catch {}
    setPixLoading(false)
  }

  function getTableItems(): OrderItem[] {
    if (!tableStatus) return []
    return tableStatus.orders.flatMap((o) => {
      try { return typeof o.items === "string" ? JSON.parse(o.items) : o.items } catch { return [] }
    })
  }

  function toggleItemSelection(idx: number) {
    setSelectedItems((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  function resetPayment() {
    setShowPaymentMenu(false)
    setPaymentMode("menu")
    setPixQrCode(null)
    setSelectedItems(new Set())
    setDiscountAmount("")
    setSplitCount("2")
  }

  function getSelectedTotal(): number {
    const items = getTableItems()
    return Array.from(selectedItems).reduce((sum, idx) => {
      const item = items[idx]
      return sum + (item ? item.price * item.quantity : 0)
    }, 0)
  }

  const tableItems = getTableItems()
  const activeOrders = tableStatus?.orders.filter((o) => o.status !== "delivered") || []

  // Closed table screen
  if (tableStatus && !tableStatus.open && !loading) {
    return (
      <div className={`flex min-h-screen flex-col items-center justify-center p-8 ${darkMode ? "bg-zinc-900 text-white" : "bg-white text-zinc-900"}`}>
        {est.logo ? <img src={est.logo} alt={est.name} className="mb-6 h-20 w-20 rounded-2xl object-cover" /> : <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-green-500 text-3xl font-bold text-white">{est.name.charAt(0)}</div>}
        <h1 className="mb-2 text-2xl font-bold">{est.name}</h1>
        <p className="mb-1 text-lg font-semibold text-amber-600">Mesa {tableNumber}</p>
        <div className={`mt-6 rounded-2xl border-2 border-dashed px-8 py-6 text-center ${darkMode ? "border-zinc-600" : "border-zinc-300"}`}>
          <CheckCircle className="mx-auto mb-3 h-12 w-12 text-green-500" />
          <p className="text-xl font-bold">Mesa encerrada</p>
          <p className={`mt-1 text-sm ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>Obrigado pela visita!</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex h-screen flex-col ${darkMode ? "bg-zinc-900 text-white" : "bg-white text-zinc-900"}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4" style={{ backgroundColor: headerBg }}>
        {/* Left: logo + establishment */}
        <div className="flex items-center gap-3">
          {est.logo ? <img src={est.logo} alt={est.name} className="h-11 w-11 rounded-xl object-cover shadow-sm" /> : <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-green-500 text-sm font-bold text-white shadow-sm`}>{est.name.charAt(0)}</div>}
          <span className={`text-sm font-semibold ${headerSubtext}`}>{est.name}</span>
        </div>

        {/* Center: table number */}
        <div className="flex items-center gap-2">
          <div className={`rounded-2xl px-6 py-2 shadow-sm ${est.colorsPublished && isLightColor(est.headerColor) ? "bg-zinc-900 text-white" : darkMode ? "bg-white/10 text-white" : "bg-zinc-900 text-white"}`}>
            <span className="text-2xl font-extrabold tracking-tight">Mesa {tableNumber}</span>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-3">
          {tableStatus && tableStatus.totalPending > 0 && (
            <span className="rounded-full bg-green-100 px-4 py-1.5 text-sm font-bold text-green-700 dark:bg-green-950 dark:text-green-400">
              Aberto — {formatCurrency(tableStatus.totalPending)}
            </span>
          )}
          <button onClick={() => { setShowPaymentMenu(true); setPaymentMode("menu") }} className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-green-700 active:scale-95">
            <Banknote className="h-4 w-4" />
            Pedir a Conta
          </button>
          <button onClick={() => setDarkMode(!darkMode)} className={`rounded-xl p-3 transition-colors ${darkMode ? "bg-zinc-800 hover:bg-zinc-700" : "bg-zinc-100 hover:bg-zinc-200"}`}>
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Success overlay */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className={`rounded-2xl p-8 text-center shadow-2xl ${darkMode ? "bg-zinc-800" : "bg-white"}`}>
            <CheckCircle className="mx-auto mb-3 h-16 w-16 text-green-500" />
            <p className={`text-xl font-bold ${darkMode ? "text-white" : "text-zinc-900"}`}>Pedido enviado!</p>
            <p className={`mt-1 text-sm ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>Em breve será preparado</p>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {paymentMode !== "menu" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={(e) => { if (e.target === e.currentTarget) resetPayment() }}>
          <div className={`w-full max-w-md rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto ${darkMode ? "bg-zinc-800" : "bg-white"}`}>
            <div className="flex items-center justify-between border-b px-6 py-4 dark:border-zinc-700">
              <h2 className="text-lg font-bold">
                {paymentMode === "unique" && "Pagamento Único"}
                {paymentMode === "split" && "Dividir Igual"}
                {paymentMode === "each" && "Cada Um Paga"}
                {paymentMode === "discount" && "Abater"}
              </h2>
              <button onClick={resetPayment} className="rounded-lg p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6">
              {/* Total info */}
              {tableStatus && (
                <div className={`mb-5 rounded-xl border p-4 ${darkMode ? "border-zinc-600 bg-zinc-700/50" : "border-zinc-200 bg-zinc-50"}`}>
                  <div className="flex justify-between text-sm">
                    <span className={darkMode ? "text-zinc-400" : "text-zinc-500"}>Total da mesa</span>
                    <span className="font-bold text-green-600">{formatCurrency(tableStatus.totalPending)}</span>
                  </div>
                  <p className={`mt-1 text-xs ${darkMode ? "text-zinc-500" : "text-zinc-400"}`}>{tableStatus.ordersCount} pedido(s)</p>
                </div>
              )}

              {/* UNIQUE */}
              {paymentMode === "unique" && (
                <div className="text-center">
                  {pixQrCode ? (
                    <div>
                      <p className={`mb-3 text-sm ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>Escaneie o QR Code com o app do banco</p>
                      <img src={pixQrCode} alt="QR Code Pix" className="mx-auto rounded-xl border-4 border-white shadow-lg" />
                      <p className="mt-4 text-2xl font-bold text-green-600">{formatCurrency(tableStatus?.totalPending || 0)}</p>
                      <button onClick={() => setPixQrCode(null)} className={`mt-4 rounded-xl px-4 py-2 text-sm font-medium ${darkMode ? "bg-zinc-700 hover:bg-zinc-600" : "bg-zinc-100 hover:bg-zinc-200"}`}>Voltar</button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className={`text-sm ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>Pagar o valor total da mesa</p>
                      <p className="text-3xl font-bold text-green-600">{formatCurrency(tableStatus?.totalPending || 0)}</p>
                      <button onClick={() => generatePix(tableStatus?.totalPending || 0, "Pagamento Único")} disabled={pixLoading} className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-green-500 bg-green-50 p-4 text-green-700 hover:bg-green-100 disabled:opacity-50">
                        {pixLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <QrCode className="h-5 w-5" />}
                        <span className="font-bold">Gerar QR Code Pix</span>
                      </button>
                      <button onClick={() => { const msg = encodeURIComponent(`Gostaria de pagar a Mesa ${tableNumber}. Total: ${formatCurrency(tableStatus?.totalPending || 0)}`); window.open(`https://wa.me/${est.phone?.replace(/\D/g, "")}?text=${msg}`, "_blank") }} className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-zinc-200 p-4 hover:bg-zinc-50">
                        <Banknote className="h-5 w-5" />
                        <span className="font-bold">Cartão ou Dinheiro</span>
                      </button>
                      <p className={`text-center text-xs ${darkMode ? "text-zinc-500" : "text-zinc-400"}`}>Cartão e dinheiro: dirija-se ao caixa</p>
                    </div>
                  )}
                </div>
              )}

              {/* SPLIT */}
              {paymentMode === "split" && (
                <div className="text-center">
                  {pixQrCode ? (
                    <div>
                      <p className={`mb-2 text-sm ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>Escaneie o QR Code — valor por pessoa</p>
                      <img src={pixQrCode} alt="QR Code Pix" className="mx-auto rounded-xl border-4 border-white shadow-lg" />
                      <p className="mt-4 text-2xl font-bold text-green-600">
                        {formatCurrency((tableStatus?.totalPending || 0) / Math.max(parseInt(splitCount) || 1, 1))}
                      </p>
                      <p className={`text-xs ${darkMode ? "text-zinc-500" : "text-zinc-400"}`}>por pessoa ({splitCount} pessoas)</p>
                      <button onClick={() => setPixQrCode(null)} className={`mt-4 rounded-xl px-4 py-2 text-sm font-medium ${darkMode ? "bg-zinc-700 hover:bg-zinc-600" : "bg-zinc-100 hover:bg-zinc-200"}`}>Voltar</button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className={`text-sm ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>Quantas pessoas?</p>
                      <div className="flex items-center justify-center gap-4">
                        <button onClick={() => setSplitCount(String(Math.max(2, parseInt(splitCount) - 1)))} className={`flex h-10 w-10 items-center justify-center rounded-full ${darkMode ? "bg-zinc-700 hover:bg-zinc-600" : "bg-zinc-100 hover:bg-zinc-200"}`}>
                          <Minus className="h-4 w-4" />
                        </button>
                        <input type="number" min="2" max="20" value={splitCount} onChange={(e) => setSplitCount(e.target.value)} className={`w-16 text-center text-3xl font-bold ${darkMode ? "bg-transparent" : ""}`} />
                        <button onClick={() => setSplitCount(String(parseInt(splitCount) + 1))} className={`flex h-10 w-10 items-center justify-center rounded-full ${darkMode ? "bg-zinc-700 hover:bg-zinc-600" : "bg-zinc-100 hover:bg-zinc-200"}`}>
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      {parseInt(splitCount) >= 2 && (
                        <>
                          <div className={`rounded-xl border p-3 ${darkMode ? "border-zinc-600" : "border-zinc-200"}`}>
                            <p className={`text-xs ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>Por pessoa</p>
                            <p className="text-2xl font-bold text-green-600">
                              {formatCurrency((tableStatus?.totalPending || 0) / parseInt(splitCount))}
                            </p>
                          </div>
                          <button onClick={() => generatePix((tableStatus?.totalPending || 0) / parseInt(splitCount), `Dividir igual - ${splitCount} pessoas`)} disabled={pixLoading} className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-green-500 bg-green-50 p-4 text-green-700 hover:bg-green-100 disabled:opacity-50">
                            {pixLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <QrCode className="h-5 w-5" />}
                            <span className="font-bold">Gerar QR Code Pix</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* EACH */}
              {paymentMode === "each" && (
                <div>
                  {pixQrCode ? (
                    <div className="text-center">
                      <p className={`mb-3 text-sm ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>Escaneie o QR Code com o app do banco</p>
                      <img src={pixQrCode} alt="QR Code Pix" className="mx-auto rounded-xl border-4 border-white shadow-lg" />
                      <p className="mt-4 text-2xl font-bold text-green-600">{formatCurrency(getSelectedTotal())}</p>
                      <button onClick={() => setPixQrCode(null)} className={`mt-4 rounded-xl px-4 py-2 text-sm font-medium ${darkMode ? "bg-zinc-700 hover:bg-zinc-600" : "bg-zinc-100 hover:bg-zinc-200"}`}>Voltar</button>
                    </div>
                  ) : (
                    <div>
                      <p className={`mb-3 text-sm ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>Selecione os itens que deseja pagar:</p>
                      <div className="space-y-2">
                        {tableItems.map((item, idx) => (
                          <button key={idx} onClick={() => toggleItemSelection(idx)} className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors ${selectedItems.has(idx) ? "border-green-500 bg-green-50 dark:bg-green-950" : darkMode ? "border-zinc-600 hover:border-zinc-500" : "border-zinc-200 hover:border-zinc-300"}`}>
                            <div className={`flex h-5 w-5 items-center justify-center rounded border-2 ${selectedItems.has(idx) ? "border-green-500 bg-green-500" : "border-zinc-300"}`}>
                              {selectedItems.has(idx) && <CheckCircle className="h-3 w-3 text-white" />}
                            </div>
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${darkMode ? "text-zinc-100" : "text-zinc-800"}`}>{item.quantity}x {item.name}</p>
                            </div>
                            <span className={`text-sm font-bold ${darkMode ? "text-zinc-200" : "text-zinc-700"}`}>{formatCurrency(item.price * item.quantity)}</span>
                          </button>
                        ))}
                      </div>
                      {selectedItems.size > 0 && (
                        <div className="mt-4">
                          <div className="flex justify-between rounded-xl border-2 border-green-500 bg-green-50 p-3 dark:bg-green-950">
                            <span className="font-medium text-green-700 dark:text-green-400">Seu total</span>
                            <span className="text-lg font-bold text-green-600">{formatCurrency(getSelectedTotal())}</span>
                          </div>
                          <button onClick={() => generatePix(getSelectedTotal(), "Cada um paga")} disabled={pixLoading} className="mt-3 flex w-full items-center justify-center gap-3 rounded-xl bg-green-600 p-4 text-white hover:bg-green-700 disabled:opacity-50">
                            {pixLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <QrCode className="h-5 w-5" />}
                            <span className="font-bold">Gerar QR Code Pix</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* DISCOUNT */}
              {paymentMode === "discount" && (
                <div>
                  {pixQrCode ? (
                    <div className="text-center">
                      <p className={`mb-3 text-sm ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>Escaneie o QR Code com o app do banco</p>
                      <img src={pixQrCode} alt="QR Code Pix" className="mx-auto rounded-xl border-4 border-white shadow-lg" />
                      <p className="mt-4 text-2xl font-bold text-green-600">{formatCurrency(parseFloat(discountAmount) || 0)}</p>
                      <button onClick={() => setPixQrCode(null)} className={`mt-4 rounded-xl px-4 py-2 text-sm font-medium ${darkMode ? "bg-zinc-700 hover:bg-zinc-600" : "bg-zinc-100 hover:bg-zinc-200"}`}>Voltar</button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {tableStatus && (
                        <div className={`rounded-xl border p-3 ${darkMode ? "border-zinc-600" : "border-zinc-200"}`}>
                          <div className="flex justify-between text-sm">
                            <span className={darkMode ? "text-zinc-400" : "text-zinc-500"}>Total da mesa</span>
                            <span className="font-bold">{formatCurrency(tableStatus.totalPending)}</span>
                          </div>
                        </div>
                      )}
                      <p className={`text-sm ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>Quanto deseja pagar?</p>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-green-600">R$</span>
                        <input type="number" step="0.01" min="0" placeholder="0,00" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} className={`w-full rounded-xl border-2 py-4 pl-12 pr-4 text-center text-2xl font-bold focus:border-green-500 focus:outline-none ${darkMode ? "border-zinc-600 bg-zinc-700" : "border-zinc-200"}`} />
                      </div>
                      {parseFloat(discountAmount) > 0 && (
                        <button onClick={() => generatePix(parseFloat(discountAmount) || 0, "Abater")} disabled={pixLoading} className="flex w-full items-center justify-center gap-3 rounded-xl bg-green-600 p-4 text-white hover:bg-green-700 disabled:opacity-50">
                          {pixLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <QrCode className="h-5 w-5" />}
                          <span className="font-bold">Gerar QR Code Pix — {formatCurrency(parseFloat(discountAmount) || 0)}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Back to menu button */}
              {pixQrCode && (
                <button onClick={resetPayment} className={`mt-4 w-full rounded-xl border p-3 text-center text-sm font-medium transition-colors ${darkMode ? "border-zinc-600 hover:bg-zinc-700" : "border-zinc-200 hover:bg-zinc-50"}`}>
                  ← Voltar ao cardápio
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment menu */}
      {showPaymentMenu && tableStatus && tableStatus.totalPending > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={(e) => { if (e.target === e.currentTarget) resetPayment() }}>
          <div className={`w-full max-w-sm rounded-2xl shadow-2xl ${darkMode ? "bg-zinc-800" : "bg-white"}`}>
            <div className="flex items-center justify-between border-b px-6 py-4 dark:border-zinc-700">
              <h2 className="text-lg font-bold">Pedir a Conta</h2>
              <button onClick={resetPayment} className="rounded-lg p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 space-y-2">
              <div className={`mb-3 rounded-xl border p-3 text-center ${darkMode ? "border-zinc-600 bg-zinc-700/50" : "border-zinc-200 bg-zinc-50"}`}>
                <p className={`text-xs ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>Total da mesa</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(tableStatus.totalPending)}</p>
              </div>
              <button onClick={() => { setShowPaymentMenu(false); setPaymentMode("unique") }} className={`flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors hover:border-green-500 ${darkMode ? "border-zinc-600" : "border-zinc-200"}`}>
                <QrCode className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-bold">Pagamento Único</p>
                  <p className={`text-xs ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>Pagar o valor total</p>
                </div>
              </button>
              <button onClick={() => { setShowPaymentMenu(false); setPaymentMode("split") }} className={`flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors hover:border-green-500 ${darkMode ? "border-zinc-600" : "border-zinc-200"}`}>
                <Users className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-bold">Dividir Igual</p>
                  <p className={`text-xs ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>Dividir entre N pessoas</p>
                </div>
              </button>
              <button onClick={() => { setShowPaymentMenu(false); setPaymentMode("each") }} className={`flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors hover:border-green-500 ${darkMode ? "border-zinc-600" : "border-zinc-200"}`}>
                <ShoppingBag className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-bold">Cada Um Paga</p>
                  <p className={`text-xs ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>Selecionar itens individualmente</p>
                </div>
              </button>
              <button onClick={() => { setShowPaymentMenu(false); setPaymentMode("discount") }} className={`flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors hover:border-green-500 ${darkMode ? "border-zinc-600" : "border-zinc-200"}`}>
                <MinusCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-bold">Abater</p>
                  <p className={`text-xs ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>Pagar um valor parcial</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Products - left */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className={`sticky top-0 z-10 pb-3 ${darkMode ? "bg-zinc-900" : "bg-white"}`}>
            <input type="text" placeholder="Buscar produto..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`mb-3 w-full rounded-2xl border px-5 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500 ${darkMode ? "border-zinc-700 bg-zinc-800 text-white placeholder:text-zinc-500" : "border-zinc-200 bg-zinc-50 placeholder:text-zinc-400"}`} />
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button onClick={() => setActiveCategory("all")} className={`shrink-0 rounded-xl px-5 py-2.5 text-sm font-bold transition-colors ${activeCategory === "all" ? "bg-green-600 text-white shadow-sm" : darkMode ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>Todos</button>
              {est.categories.map((cat) => (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`shrink-0 rounded-xl px-5 py-2.5 text-sm font-bold transition-colors ${activeCategory === cat.id ? "bg-green-600 text-white shadow-sm" : darkMode ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>{cat.name}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {filteredProducts.map((product) => (
              <button key={product.id} onClick={() => addToCart(product)} className={`flex flex-col rounded-2xl border p-3 text-left transition-all hover:shadow-lg active:scale-[0.97] ${darkMode ? "border-zinc-700 bg-zinc-800 hover:border-green-500" : "border-zinc-200 bg-white hover:border-green-400"}`}>
                {product.image ? <img src={product.image} alt={product.name} className="mb-3 h-28 w-full rounded-xl object-cover" /> : <div className={`mb-3 flex h-28 w-full items-center justify-center rounded-xl text-4xl ${darkMode ? "bg-zinc-700" : "bg-zinc-100"}`}>🍕</div>}
                <p className={`text-sm font-bold leading-tight ${darkMode ? "text-zinc-100" : "text-zinc-800"}`}>{product.name}</p>
                <p className="mt-1.5 text-sm font-extrabold text-green-600">{formatCurrency(product.price)}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Right panel - Cart + Orders */}
        <div className={`w-80 flex flex-col border-l ${darkMode ? "border-zinc-700 bg-zinc-800" : "border-zinc-200 bg-zinc-50"}`}>
          {/* Tabs */}
          <div className={`flex border-b ${darkMode ? "border-zinc-700" : "border-zinc-200"}`}>
            <button onClick={() => setRightTab("cart")} className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-colors ${rightTab === "cart" ? "border-b-2 border-green-600 text-green-600" : darkMode ? "text-zinc-400 hover:text-zinc-200" : "text-zinc-500 hover:text-zinc-700"}`}>
              <ShoppingBag className="h-3.5 w-3.5" />
              Carrinho
              {cart.length > 0 && <span className="rounded-full bg-green-600 px-1.5 py-0.5 text-[10px] text-white">{cart.reduce((s, i) => s + i.quantity, 0)}</span>}
            </button>
            <button onClick={() => setRightTab("orders")} className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-colors ${rightTab === "orders" ? "border-b-2 border-green-600 text-green-600" : darkMode ? "text-zinc-400 hover:text-zinc-200" : "text-zinc-500 hover:text-zinc-700"}`}>
              <UtensilsCrossed className="h-3.5 w-3.5" />
              Pedidos
              {activeOrders.length > 0 && <span className="rounded-full bg-green-600 px-1.5 py-0.5 text-[10px] text-white">{activeOrders.length}</span>}
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {/* CART TAB */}
            {rightTab === "cart" && (
              cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${darkMode ? "bg-zinc-700" : "bg-zinc-100"}`}>
                    <ShoppingBag className="h-8 w-8 text-zinc-400" />
                  </div>
                  <p className={`text-sm font-medium ${darkMode ? "text-zinc-300" : "text-zinc-600"}`}>Seu carrinho está vazio</p>
                  <p className={`mt-1 text-xs ${darkMode ? "text-zinc-500" : "text-zinc-400"}`}>Toque nos produtos para adicionar</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map((item) => (
                    <div key={item.id} className={`flex items-center gap-3 rounded-xl p-3 ${darkMode ? "bg-zinc-700" : "bg-white"}`}>
                      <div className="flex-1 min-w-0">
                        <p className={`truncate text-sm font-bold ${darkMode ? "text-zinc-100" : "text-zinc-800"}`}>{item.name}</p>
                        <p className={`text-xs font-medium ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>{formatCurrency(item.price)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className={`flex h-9 w-9 items-center justify-center rounded-full text-sm ${darkMode ? "bg-zinc-600 hover:bg-zinc-500" : "bg-zinc-100 hover:bg-zinc-200"}`}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className={`w-7 text-center text-base font-bold ${darkMode ? "text-zinc-200" : ""}`}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className={`flex h-9 w-9 items-center justify-center rounded-full text-sm ${darkMode ? "bg-zinc-600 hover:bg-zinc-500" : "bg-zinc-100 hover:bg-zinc-200"}`}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button onClick={() => removeItem(item.id)} className="ml-1 text-red-400 hover:text-red-600">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* ORDERS TAB */}
            {rightTab === "orders" && (
              tableStatus && tableStatus.orders.length > 0 ? (
                <div className="space-y-3">
                  {tableStatus.orders.slice().reverse().map((order) => {
                    const parsedItems = (() => { try { return typeof order.items === "string" ? JSON.parse(order.items) : order.items } catch { return [] } })() as OrderItem[]
                    const st = STATUS_CONFIG[order.status] || STATUS_CONFIG.new
                    return (
                      <div key={order.id} className={`rounded-xl border p-3 ${darkMode ? "border-zinc-600 bg-zinc-700/50" : "border-zinc-200 bg-white"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-zinc-500">#{order.orderNumber || "—"}</span>
                          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${st.color}`}>
                            <st.icon className="h-3 w-3" />
                            {st.label}
                          </span>
                        </div>
                        {parsedItems.map((item, idx) => (
                          <p key={idx} className={`text-xs ${darkMode ? "text-zinc-300" : "text-zinc-600"}`}>{item.quantity}x {item.name} — {formatCurrency(item.price * item.quantity)}</p>
                        ))}
                        <p className="mt-1 text-xs font-bold text-green-600">{formatCurrency(order.total)}</p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <UtensilsCrossed className="mb-3 h-10 w-10 text-zinc-300" />
                  <p className={`text-sm ${darkMode ? "text-zinc-500" : "text-zinc-400"}`}>Nenhum pedido ainda</p>
                </div>
              )
            )}
          </div>

          {/* Bottom bar - fixed */}
          {rightTab === "cart" && cart.length > 0 && (
            <div className={`border-t px-4 py-3 ${darkMode ? "border-zinc-700" : "border-zinc-200"}`}>
              {/* Notes */}
              {showNotes ? (
                <div className="mb-3">
                  <p className={`mb-1.5 text-[10px] font-bold uppercase tracking-wide ${darkMode ? "text-zinc-500" : "text-zinc-400"}`}>Observações</p>
                  <textarea
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    onBlur={() => { if (!orderNotes) setShowNotes(false) }}
                    placeholder="Ex: sem cebola, bem passado..."
                    maxLength={200}
                    autoFocus
                    rows={2}
                    className={`w-full resize-none rounded-xl border px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 ${darkMode ? "border-zinc-600 bg-zinc-700 text-white placeholder:text-zinc-500" : "border-zinc-200 bg-zinc-50 placeholder:text-zinc-400"}`}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setShowNotes(true)}
                  className={`mb-3 flex w-full items-center gap-2 rounded-xl border p-2.5 text-xs font-medium transition-colors ${orderNotes ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400" : darkMode ? "border-zinc-600 text-zinc-400 hover:border-zinc-500" : "border-zinc-200 text-zinc-500 hover:border-zinc-300"}`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {orderNotes ? `Observação: ${orderNotes.slice(0, 40)}${orderNotes.length > 40 ? "..." : ""}` : "Adicionar observação"}
                </button>
              )}

              <div className="mb-3 flex items-center justify-between">
                <span className={`text-sm font-medium ${darkMode ? "text-zinc-300" : "text-zinc-600"}`}>Total</span>
                <span className="text-xl font-bold text-green-600">{formatCurrency(cartTotal)}</span>
              </div>
              <button onClick={sendOrder} disabled={sending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 text-sm font-bold text-white transition-colors hover:bg-green-700 disabled:opacity-50 active:scale-[0.98]">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-4 w-4" /> Enviar Pedido</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
