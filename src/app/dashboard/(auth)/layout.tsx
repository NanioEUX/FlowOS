"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Store, ShoppingBag, Bike, UtensilsCrossed, Settings, BarChart3, LogOut, Menu, X, Package, DollarSign, Boxes, Users, Tag, Landmark, ChevronDown, ChevronRight, LayoutDashboard, CreditCard, Clock, Megaphone, Star } from "lucide-react"
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

  const navItems = mainNavItems.filter((item) => user?.role === "admin" || user?.permissions?.includes(item.perm))
  const mobileNavItems = navItems.slice(0, 5)

  function handleLogout() {
    localStorage.removeItem("pedefacil-user")
    router.push("/login")
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-flow-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-flow-blue border-t-transparent" />
      </div>
    )
  }

  if (!establishment) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-flow-bg gap-4">
        <Store className="h-12 w-12 text-flow-muted" />
        <p className="text-flow-gray">Nenhum estabelecimento vinculado</p>
        <Link href="/cadastro">
          <button className="btn-primary px-6 py-2.5 text-sm">Criar estabelecimento</button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-flow-bg">
      {/* Sidebar — desktop */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform border-r border-white/[.06] bg-flow-surface transition-transform",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/[.06] px-4">
          <div className="flex-shrink-0">
            {establishment?.logo ? (
              <img src={establishment.logo} alt={establishment.name} className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <FlowOSLogo size={28} variant="icon" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-flow-white leading-tight truncate">
              {establishment?.name || "FlowOS"}
            </p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden flex-shrink-0">
            <X className="h-5 w-5 text-flow-gray" />
          </button>
        </div>

        <nav className="p-3 space-y-0.5">
          {navItems.map((item) => (
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
            </Link>
          ))}

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
                {financeiroOpen ? <ChevronDown className="ml-auto h-4 w-4" /> : <ChevronRight className="ml-auto h-4 w-4" />}
              </button>
              {financeiroOpen && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/[.06] pl-3">
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
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/[.06] pl-3">
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
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/[.06] pl-3">
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
          <div className="px-3 pb-2">
            <SubscriptionBadge establishment={establishment} />
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 border-t border-white/[.06] p-3">
          <button
            onClick={handleLogout}
            className="sidebar-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/100/10"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sair
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 pb-20 lg:pb-0 lg:ml-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-white/[.06] bg-flow-bg/80 backdrop-blur-xl px-4 lg:h-16 lg:px-8">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
            <Menu className="h-5 w-5 text-flow-gray" />
          </button>
          <div className="flex-1" />
          <span className="hidden text-sm text-flow-muted lg:block">
            <a href={`/${establishment.slug}`} target="_blank" className="text-flow-blue hover:text-flow-cyan transition-colors">/{establishment.slug}</a>
          </span>
          <div className="hidden items-center gap-3 text-sm text-flow-muted lg:flex">
            <span>{currentTime}</span>
            <div className="flex items-center gap-1.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-flow-blue/10 text-[10px] font-bold text-flow-blue">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
              <span className="font-medium text-flow-gray">{user?.name}</span>
            </div>
          </div>
        </header>
        <main className="p-3 lg:p-8">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/[.06] bg-flow-surface/95 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-around py-2">
          {mobileNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors",
                pathname === item.href ? "text-flow-blue" : "text-flow-muted"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
          {navItems.length > 5 && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium text-flow-muted"
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
      <a href="/dashboard/planos" className="flex items-center gap-2 rounded-btn border border-amber-500/20 bg-amber-500/100/[.06] px-3 py-2 text-xs transition-colors hover:bg-amber-500/100/10">
        <Clock className="h-4 w-4 text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-amber-300">Teste: {daysLeft}d restante{daysLeft > 1 ? "s" : ""}</p>
          <p className="text-[10px] text-amber-400/70">Ver planos →</p>
        </div>
      </a>
    )
  }

  return (
    <a href="/dashboard/planos" className="flex items-center gap-2 rounded-btn border border-red-500/20 bg-red-500/100/[.06] px-3 py-2 text-xs transition-colors hover:bg-red-500/100/10">
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
