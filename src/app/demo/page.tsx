"use client"

import { useState } from "react"
import { LayoutDashboard, ShoppingBag, Bike, ClipboardList, Monitor, ChevronRight, ExternalLink, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FlowOSLogo } from "@/components/flowos-logo"
import Link from "next/link"

const modules = [
  {
    id: "dashboard",
    icon: LayoutDashboard,
    title: "Dashboard",
    desc: "Visão geral do seu negócio em tempo real",
    color: "bg-blue-500",
    features: [
      "Vendas do dia e ticket médio",
      "Pedidos ativos por status",
      "Gráfico de vendas 7 dias",
      "Produtos mais vendidos",
      "Clientes ativos",
      "Motoboys disponíveis",
    ],
    link: "/geladolate-sorveteria",
  },
  {
    id: "menu",
    icon: ShoppingBag,
    title: "Cardápio Online",
    desc: "Seu cardápio profissional para clientes",
    color: "bg-emerald-500",
    features: [
      "Cardápio com fotos e categorias",
      "Busca de produtos",
      "Carrinho de compras",
      "Pagamento online (Pix/cartão)",
      "Identificação do cliente",
      "Acompanhamento do pedido",
    ],
    link: "/geladolate-sorveteria",
  },
  {
    id: "orders",
    icon: ClipboardList,
    title: "Gestão de Pedidos",
    desc: "Controle total dos seus pedidos",
    color: "bg-amber-500",
    features: [
      "Lista de pedidos em tempo real",
      "Filtros por período e status",
      "Alteração de status automática",
      "Atribuição de motoboy",
      "Impressão de cupom",
      "Notificações sonoras",
    ],
    link: "/dashboard/pedidos",
  },
  {
    id: "delivery",
    icon: Bike,
    title: "App do Motoboy",
    desc: "Entregadores sempre conectados",
    color: "bg-purple-500",
    features: [
      "Pedidos prontos para sair",
      "Mapa com rota de entrega",
      "Status em tempo real",
      "Ganhos do dia/mês",
      "Ativar/desativar disponibilidade",
      "Notificações push",
    ],
    link: "/geladolate-sorveteria/entregas/demo",
  },
  {
    id: "pos",
    icon: Monitor,
    title: "Caixa (POS)",
    desc: "Vendas presenciais rápidas",
    color: "bg-rose-500",
    features: [
      "Tela cheia otimizada",
      "Seleção rápida de produtos",
      "Pagamento Dinheiro/Pix/Cartão",
      "Cupom fiscal automático",
      "Abertura de caixa",
      "Relatório do dia",
    ],
    link: "/caixa",
  },
]

export default function DemoPage() {
  const [activeModule, setActiveModule] = useState("dashboard")
  const current = modules.find((m) => m.id === activeModule)!

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF7F3] to-white">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            </Link>
            <FlowOSLogo size={32} className="h-8" />
          </div>
          <Link href="/cadastro">
            <Button className="bg-[#FF6B35] hover:bg-[#E55A2B]">
                Testar 7 dias grátis
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="py-12 text-center">
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl">
          Conheça o FlowOS
        </h1>
        <p className="mt-3 text-lg text-zinc-600">
          Um sistema completo para gerenciar seu restaurante
        </p>
      </section>

      {/* Module Tabs */}
      <section className="mx-auto max-w-7xl px-4 pb-12">
        <div className="flex flex-wrap justify-center gap-2">
          {modules.map((mod) => (
            <button
              key={mod.id}
              onClick={() => setActiveModule(mod.id)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                activeModule === mod.id
                  ? "bg-[#FF6B35] text-white shadow-lg"
                  : "bg-white text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <mod.icon className="h-4 w-4" />
              {mod.title}
            </button>
          ))}
        </div>

        {/* Module Detail */}
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* Info */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
            <div className={`mb-4 inline-flex rounded-xl p-3 ${current.color}`}>
              <current.icon className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-900">{current.title}</h2>
            <p className="mt-2 text-zinc-600">{current.desc}</p>

            <ul className="mt-6 space-y-3">
              {current.features.map((f, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-zinc-700">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FFF0E6]">
                    <ChevronRight className="h-3 w-3 text-[#FF6B35]" />
                  </div>
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <Link href={current.link} target="_blank">
                <Button className="bg-[#FF6B35] hover:bg-[#E55A2B]">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Ver demo ao vivo
                </Button>
              </Link>
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-8">
            <div className="text-center">
              <current.icon className="mx-auto h-16 w-16 text-zinc-300" />
              <p className="mt-4 text-sm text-zinc-500">
                Clique em &quot;Ver demo ao vivo&quot; para ver o {current.title} em ação
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* All Modules Grid */}
      <section className="border-t border-zinc-200 bg-white py-12">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-2xl font-bold text-zinc-900">
            Todos os módulos incluídos
          </h2>
          <p className="mt-2 text-center text-zinc-600">
            Sem comissão sobre vendas, sem limites
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {modules.map((mod) => (
              <div
                key={mod.id}
                className="rounded-xl border border-zinc-200 p-4 text-center transition-all hover:border-[#FF6B35] hover:shadow-md"
              >
                <div className={`mx-auto mb-3 inline-flex rounded-lg p-2 ${current.id === mod.id ? "bg-[#FF6B35]" : "bg-zinc-100"}`}>
                  <mod.icon className={`h-5 w-5 ${current.id === mod.id ? "text-white" : "text-zinc-500"}`} />
                </div>
                <h3 className="font-semibold text-zinc-900">{mod.title}</h3>
                <p className="mt-1 text-xs text-zinc-500">{mod.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#FF6B35] py-12">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl font-bold text-white">
            Comece agora mesmo
          </h2>
          <p className="mt-2 text-white/90">
            Crie seu cardápio em 2 minutos. Teste 7 dias grátis.
          </p>
          <div className="mt-6">
            <Link href="/cadastro">
              <Button size="lg" className="bg-white text-[#FF6B35] hover:bg-zinc-100">
              Testar 7 dias grátis
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
