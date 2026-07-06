"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Store, ShoppingBag, Bike, UtensilsCrossed, Settings, BarChart3, LogOut, Menu, X, Package, DollarSign, Boxes, Users, Tag, Landmark, ChevronDown, ChevronRight, LayoutDashboard, CreditCard, Megaphone, Star, Clock, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { FlowOSLogo } from "@/components/flowos-logo"
import { fetchAuth } from "@/lib/fetch-auth"

const mainNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard/home", perm: "dashboard" },
  { icon: ShoppingBag, label: "Pedidos", href: "/dashboard/pedidos", perm: "pedidos" },
  { icon: Bike, label: "Entregas", href: "/dashboard/entregas", perm: "entregas" },
  { icon: UtensilsCrossed, label: "Cardápio", href: "/dashboard/cardapio", perm: "cardapio" },
  { icon: Boxes, label: "Estoque", href: "/dashboard/estoque", perm: "estoque" },
  { icon: Users, label: "Clientes", href: "/dashboard/clientes", perm: "clientes" },
]

const financeiroSubItems = [
  { icon: TrendingUp, label: "Receitas", href: "/dashboard/financeiro/receitas" },
  { icon: BarChart3, label: "DRE", href: "/dashboard/financeiro" },
  { icon: DollarSign, label: "Despesas", href: "/dashboard/financeiro/despesas" },
  { icon: BarChart3, label: "Relatórios", href: "/dashboard/relatorios", perm: "relatorios" },
]

const marketingSubItems = [
  { icon: Tag, label: "Cupons", href: "/dashboard/cupons", perm: "config" },
  { icon: Star, label: "Fidelidade", href: "/dashboard/fidelidade", perm: "config" },
]

const configSubItems = [
  { icon: Settings, label: "Geral", href: "/dashboard/config", perm: "config" },
  { icon: Users, label: "Usuários", href: "/dashboard/usuarios", perm: "usuarios" },
  { icon: CreditCard, label: "Planos", href: "/dashboard/planos", perm: "config" },
]

interface UserData {
  id: string
  name: string
  email: string
  role: string
  permissions: string[]
  establishmentId: string
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [financeiroOpen, setFinanceiroOpen] = useState(false)
  const [marketingOpen, setMarketingOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [establishment, setEstablishment] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<UserData | null>(null)
  const [expenseAlert, setExpenseAlert] = useState<"none" | "warning" | "danger">("none")
  const [stockAlert, setStockAlert] = useState<"none" | "warning" | "danger">("none")

  useEffect(() => {
    const stored = localStorage.getItem("pedefacil-user")
    if (!stored) {
      router.replace("/login")
      return
    }

    const userData: UserData = JSON.parse(stored)
    setUser(userData)

    if (userData.role !== "admin" && !userData.permissions?.includes("caixa") && userData.permissions?.length <= 1) {
      router.replace("/login")
      return
    }

    fetchAuth(`/api/establishments?id=${userData.establishmentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setEstablishment(data)

        if (userData.role === "admin" && !pathname.startsWith("/dashboard/planos")) {
          const now = new Date()
          const isExpired =
            data.subscriptionStatus === "expired" ||
            (data.subscriptionStatus === "trial" && data.trialEndsAt && new Date(data.trialEndsAt) < now)
          if (isExpired) {
            router.replace("/dashboard/planos")
            return
          }
        }
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false))
  }, [router, pathname])

  useEffect(() => {
    if (!user?.establishmentId) return
    function loadAlerts() {
      fetchAuth(`/api/alerts?establishmentId=${user!.establishmentId}`)
        .then((r) => r.json())
        .then((data) => {
          setExpenseAlert(data.expenseAlert || "none")
          setStockAlert(data.stockAlert || "none")
        })
        .catch(() => {})
    }
    loadAlerts()
    window.addEventListener("expenses-updated", loadAlerts)
    window.addEventListener("stock-updated", loadAlerts)
    return () => {
      window.removeEventListener("expenses-updated", loadAlerts)
      window.removeEventListener("stock-updated", loadAlerts)
    }
  }, [user?.establishmentId])

  const navItems = mainNavItems.filter((item) => user?.role === "admin" || user?.permissions?.includes(item.perm))
  const mobileNavItems = navItems.slice(0, 5)

  function handleLogout() {
    localStorage.removeItem("pedefacil-user")
    router.push("/login")
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    )
  }

  if (!establishment) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 gap-4">
        <Store className="h-12 w-12 text-zinc-400" />
        <p className="text-zinc-600">Nenhum estabelecimento vinculado</p>
        <Link href="/cadastro">
          <button className="bg-green-600 text-white hover:bg-green-700 px-6 py-2.5 text-sm rounded-lg font-medium">Criar estabelecimento</button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-zinc-50">
      {/* Sidebar — blue gradient */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform border-r border-white/[.08] transition-transform",
          "bg-gradient-to-b from-[#1a3a5c] to-[#0d2137]",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="relative flex h-16 items-center gap-3 border-b border-white/[.1] px-4">
          <div className="flex-shrink-0">
            {establishment?.logo ? (
              <img src={establishment.logo} alt={establishment.name} className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <FlowOSLogo size={28} variant="icon" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white leading-tight truncate">
              {establishment?.name || "FlowOS"}
            </p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden flex-shrink-0">
            <X className="h-5 w-5 text-white/60" />
          </button>
          <button onClick={handleLogout} className="lg:hidden flex-shrink-0" title="Sair">
            <LogOut className="h-4 w-4 text-white/40 hover:text-red-400 transition-colors" />
          </button>
        </div>

        <nav className="relative p-3 space-y-0.5">
          {navItems.map((item) => {
            const alertLevel = item.perm === "estoque" ? stockAlert : "none"
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "sidebar-item",
                  pathname === item.href ? "active" : ""
                )}
              >
                <item.icon className="h-[18px] w-[18px]" />
                {item.label}
                {alertLevel === "danger" && <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white flex-shrink-0">Atenção</span>}
                {alertLevel === "warning" && <span className="ml-auto rounded-full bg-yellow-400 px-1.5 py-0.5 text-[9px] font-bold text-white flex-shrink-0">Atenção</span>}
              </Link>
            )
          })}

          {user?.permissions?.includes("caixa") && (
            <>
              <Link
                href="/caixa"
                onClick={() => setSidebarOpen(false)}
                className={cn("sidebar-item", pathname === "/caixa" ? "active" : "")}
              >
                <DollarSign className="h-[18px] w-[18px]" />
                Frente de Caixa
              </Link>
              {user?.role === "admin" && (
                <Link
                  href="/dashboard/caixa-gerencial"
                  onClick={() => setSidebarOpen(false)}
                  className={cn("sidebar-item", pathname === "/dashboard/caixa-gerencial" ? "active" : "")}
                >
                  <Landmark className="h-[18px] w-[18px]" />
                  Caixa Gerencial
                </Link>
              )}
            </>
          )}

          {(user?.role === "admin" || user?.permissions?.includes("relatorios")) && (
            <div>
              <button
                onClick={() => setFinanceiroOpen(!financeiroOpen)}
                className={cn(
                  "sidebar-item w-full",
                  (pathname.startsWith("/dashboard/financeiro") || pathname === "/dashboard/relatorios") ? "active" : ""
                )}
              >
                <Landmark className="h-[18px] w-[18px]" />
                Financeiro
                {expenseAlert === "danger" && <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white flex-shrink-0">Atenção</span>}
                {expenseAlert === "warning" && <span className="rounded-full bg-yellow-400 px-1.5 py-0.5 text-[9px] font-bold text-white flex-shrink-0">Atenção</span>}
                {financeiroOpen ? <ChevronDown className="ml-auto h-4 w-4" /> : <ChevronRight className="ml-auto h-4 w-4" />}
              </button>
              {financeiroOpen && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/[.1] pl-3">
                  {financeiroSubItems.filter((item) => !item.perm || user?.role === "admin" || user?.permissions?.includes(item.perm)).map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn("sidebar-item text-xs", pathname === item.href ? "active" : "")}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {(user?.role === "admin" || user?.permissions?.includes("config")) && (
            <div>
              <button
                onClick={() => setMarketingOpen(!marketingOpen)}
                className={cn("sidebar-item w-full", pathname === "/dashboard/cupons" ? "active" : "")}
              >
                <Megaphone className="h-[18px] w-[18px]" />
                Marketing
                {marketingOpen ? <ChevronDown className="ml-auto h-4 w-4" /> : <ChevronRight className="ml-auto h-4 w-4" />}
              </button>
              {marketingOpen && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/[.1] pl-3">
                  {marketingSubItems.filter((item) => !item.perm || user?.role === "admin" || user?.permissions?.includes(item.perm)).map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn("sidebar-item text-xs", pathname === item.href ? "active" : "")}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {(user?.role === "admin" || user?.permissions?.includes("config")) && (
            <div>
              <button
                onClick={() => setConfigOpen(!configOpen)}
                className={cn(
                  "sidebar-item w-full",
                  (pathname === "/dashboard/config" || pathname === "/dashboard/usuarios" || pathname === "/dashboard/planos") ? "active" : ""
                )}
              >
                <Settings className="h-[18px] w-[18px]" />
                Configurações
                {configOpen ? <ChevronDown className="ml-auto h-4 w-4" /> : <ChevronRight className="ml-auto h-4 w-4" />}
              </button>
              {configOpen && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/[.1] pl-3">
                  {configSubItems.filter((item) => !item.perm || user?.role === "admin" || user?.permissions?.includes(item.perm)).map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn("sidebar-item text-xs", pathname === item.href ? "active" : "")}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        {user?.role === "admin" && (
          <div className="relative px-3 pb-2">
            <SubscriptionBadge establishment={establishment} />
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 border-t border-white/[.1] p-3">
          <a href="https://flowos.fs.app" target="_blank" className="flex items-center justify-center gap-1.5 py-2 text-[11px] text-white/25 hover:text-white/40 transition-colors">
            <FlowOSLogo size={12} variant="icon" />
            Powered by FlowOS
          </a>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content area — light theme */}
      <div className="flex-1 pb-20 lg:pb-0 lg:ml-64">
        {/* Header — light */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-zinc-200 bg-white/80 backdrop-blur-xl px-4 lg:h-16 lg:px-8">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
            <Menu className="h-5 w-5 text-zinc-600" />
          </button>
          <div className="flex-1" />
          <span className="hidden text-sm text-zinc-500 lg:block">
            <a href={`/${establishment.slug}`} target="_blank" className="text-green-600 hover:text-green-700 font-medium transition-colors">/{establishment.slug}</a>
          </span>
          <div className="hidden items-center gap-3 text-sm text-zinc-500 lg:flex">
            <div className="flex items-center gap-1.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-[10px] font-bold text-green-700">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
              <span className="font-medium text-zinc-700">{user?.name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-500"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Content — light bg */}
        <main className="p-3 lg:p-8">{children}</main>
      </div>

      {/* Mobile bottom nav — blue (sidebar style) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/[.1] bg-gradient-to-r from-[#1a3a5c] to-[#0d2137] backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-around py-2">
          {mobileNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors",
                pathname === item.href ? "text-white" : "text-white/50"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
          {navItems.length > 5 && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium text-white/50"
            >
              <Menu className="h-5 w-5" />
              Mais
            </button>
          )}
        </div>
      </nav>
    </div>
  )
}

function SubscriptionBadge({ establishment }: { establishment: any }) {
  const status = establishment?.subscriptionStatus || "trial"
  const trialEnds = establishment?.trialEndsAt ? new Date(establishment.trialEndsAt) : null
  const daysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0

  if (status === "active") return null

  if (status === "trial" && daysLeft > 0) {
    return (
      <a href="/dashboard/planos" className="flex items-center gap-2 rounded-btn border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs transition-colors hover:bg-amber-400/20">
        <Clock className="h-4 w-4 text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-amber-300">Teste: {daysLeft}d restante{daysLeft > 1 ? "s" : ""}</p>
          <p className="text-[10px] text-amber-400/70">Ver planos →</p>
        </div>
      </a>
    )
  }

  return (
    <a href="/dashboard/planos" className="flex items-center gap-2 rounded-btn border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs transition-colors hover:bg-red-400/20">
      <CreditCard className="h-4 w-4 text-red-400" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-red-300">
          {status === "expired" ? "Assinatura expirada" : "Pagamento pendente"}
        </p>
        <p className="text-[10px] text-red-400/70">Ativar plano →</p>
      </div>
    </a>
  )
}
