"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Store, ShoppingBag, Bike, UtensilsCrossed, Settings, BarChart3, LogOut, Menu, X, Package, DollarSign, Boxes, Users, Tag, Landmark, ChevronDown, ChevronRight, LayoutDashboard } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
  { icon: Landmark, label: "Caixa", href: "/dashboard/financeiro/caixa" },
  { icon: DollarSign, label: "Despesas", href: "/dashboard/financeiro/despesas" },
  { icon: BarChart3, label: "Relatórios", href: "/dashboard/relatorios", perm: "relatorios" },
  { icon: Tag, label: "Cupons", href: "/dashboard/cupons", perm: "config" },
]

const configSubItems = [
  { icon: Settings, label: "Geral", href: "/dashboard/config", perm: "config" },
  { icon: Users, label: "Usuários", href: "/dashboard/usuarios", perm: "usuarios" },
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

    if (!userData.permissions?.includes("caixa") && userData.permissions?.length <= 1) {
      router.replace("/login")
      return
    }

    fetchAuth(`/api/establishments?id=${userData.establishmentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setEstablishment(data)
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false))
  }, [router])

  const navItems = mainNavItems.filter((item) => user?.permissions?.includes(item.perm))
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
        <Store className="h-12 w-12 text-zinc-300" />
        <p className="text-zinc-600">Nenhum estabelecimento vinculado</p>
        <Link href="/cadastro">
          <Button>Criar estabelecimento</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-zinc-50">
      {/* Sidebar — desktop */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform border-r border-zinc-200 bg-white transition-transform",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-zinc-200 px-4">
          <div className="flex-shrink-0">
            {establishment?.logo ? (
              <img src={establishment.logo} alt={establishment.name} className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <img src="/icons/pedefacil-logo.svg" alt="PedeFácil" className="h-8" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {establishment?.name ? (
              <p className="text-sm font-semibold text-zinc-900 leading-tight">{establishment.name}</p>
            ) : (
              <p className="text-sm font-semibold text-zinc-900">PedeFácil</p>
            )}
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden flex-shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === item.href
                  ? "bg-green-50 text-green-700"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}

          {/* Caixa */}
          {user?.permissions?.includes("caixa") && (
            <>
              {user?.role === "admin" ? (
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    (pathname === "/caixa" || pathname === "/dashboard/caixa")
                      ? "bg-green-50 text-green-700"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  )}
                >
                  <DollarSign className="h-5 w-5" />
                  <Link href="/dashboard/caixa" onClick={() => setSidebarOpen(false)} className="hover:underline">
                    Caixa
                  </Link>
                  <span className="text-zinc-400">/</span>
                  <Link href="/caixa" className="text-green-600 hover:underline">
                    (Tela cheia)
                  </Link>
                </div>
              ) : (
                <Link
                  href="/caixa"
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    pathname === "/caixa"
                      ? "bg-green-50 text-green-700"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  )}
                >
                  <DollarSign className="h-5 w-5" />
                  Caixa
                </Link>
              )}
            </>
          )}

          {/* Financeiro submenu */}
          {user?.permissions?.includes("relatorios") && (
            <div>
              <button
                onClick={() => setFinanceiroOpen(!financeiroOpen)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  pathname.startsWith("/dashboard/financeiro") || pathname === "/dashboard/relatorios" || pathname === "/dashboard/cupons"
                    ? "bg-green-50 text-green-700"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                )}
              >
                <Landmark className="h-5 w-5" />
                Financeiro
                {financeiroOpen ? <ChevronDown className="ml-auto h-4 w-4" /> : <ChevronRight className="ml-auto h-4 w-4" />}
              </button>
              {financeiroOpen && (
                <div className="ml-4 mt-1 space-y-1 border-l border-zinc-200 pl-3">
                  {financeiroSubItems.filter((item) => !item.perm || user?.permissions?.includes(item.perm)).map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                        pathname === item.href
                          ? "bg-green-50 text-green-700"
                          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Configuracoes submenu */}
          {user?.permissions?.includes("config") && (
            <div>
              <button
                onClick={() => setConfigOpen(!configOpen)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  pathname === "/dashboard/config" || pathname === "/dashboard/usuarios"
                    ? "bg-green-50 text-green-700"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                )}
              >
                <Settings className="h-5 w-5" />
                Configurações
                {configOpen ? <ChevronDown className="ml-auto h-4 w-4" /> : <ChevronRight className="ml-auto h-4 w-4" />}
              </button>
              {configOpen && (
                <div className="ml-4 mt-1 space-y-1 border-l border-zinc-200 pl-3">
                  {configSubItems.filter((item) => !item.perm || user?.permissions?.includes(item.perm)).map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                        pathname === item.href
                          ? "bg-green-50 text-green-700"
                          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                      )}
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

        <div className="absolute bottom-0 left-0 right-0 border-t border-zinc-200 p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-5 w-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 pb-20 lg:pb-0 lg:ml-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-zinc-200 bg-white px-4 lg:h-16 lg:px-8">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <span className="hidden text-sm text-zinc-500 lg:block">
            <a href={`/${establishment.slug}`} target="_blank" className="text-green-600 underline">/{establishment.slug}</a>
          </span>
          <div className="hidden items-center gap-3 text-sm text-zinc-500 lg:flex">
            <span>{currentTime}</span>
            <div className="flex items-center gap-1.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-[10px] font-bold text-green-700">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
              <span className="font-medium text-zinc-700">{user?.name}</span>
            </div>
          </div>
        </header>
        <main className="p-3 lg:p-8">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-200 bg-white lg:hidden">
        <div className="flex items-center justify-around py-2">
          {mobileNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors",
                pathname === item.href
                  ? "text-green-600"
                  : "text-zinc-400"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
          {navItems.length > 5 && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium text-zinc-400"
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
