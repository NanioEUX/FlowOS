import { redirect } from "next/navigation"
import { getSaasAdmin } from "@/lib/saas-admin-auth"
import Link from "next/link"

const MENU = [
  { href: "/admin-saas/dashboard", icon: "📊", label: "Visão Geral" },
  { href: "/admin-saas/estabelecimentos", icon: "🏪", label: "Estabelecimentos" },
  { href: "/admin-saas/respostas-rapidas", icon: "⚡", label: "Respostas Rápidas" },
  { href: "/admin-saas/templates", icon: "🎨", label: "Templates Categoria" },
  { href: "/admin-saas/instancias", icon: "📱", label: "Instâncias WhatsApp" },
  { href: "/admin-saas/pagamentos", icon: "💰", label: "Gateway Pagamento" },
  { href: "/admin-saas/ia-custos", icon: "🤖", label: "IA & Custos" },
  { href: "/admin-saas/planos", icon: "💳", label: "Planos & Billing" },
  { href: "/admin-saas/logs", icon: "📋", label: "Logs & Auditoria" },
]

export default async function SaasLayout({ children }: { children: React.ReactNode }) {
  const admin = await getSaasAdmin()
  if (!admin) redirect("/admin-saas/login")

  return (
    <div className="min-h-screen bg-zinc-50">
      <aside className="fixed left-0 top-0 h-full w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col z-30">
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center text-xl">
              ⚡
            </div>
            <div>
              <p className="text-white font-bold text-sm">FlowOS</p>
              <p className="text-zinc-500 text-xs">Painel Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {MENU.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 hover:bg-zinc-800/50 hover:text-white transition-all"
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-zinc-800">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold">
              {admin.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{admin.email}</p>
              <p className="text-zinc-500 text-xs">SaaS Admin</p>
            </div>
          </div>
          <form action="/api/saas-admin/logout" method="POST">
            <button
              type="submit"
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-800/50 hover:text-white transition-all"
            >
              <span>🚪</span>
              <span>Sair</span>
            </button>
          </form>
        </div>
      </aside>

      <main className="ml-64 min-h-screen">{children}</main>
    </div>
  )
}
