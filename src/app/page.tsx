"use client"

import Link from "next/link"
import { Smartphone, BarChart3, CreditCard, ShoppingBag, QrCode, Store, Check, ChevronDown, Zap, Shield, TrendingDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"

const features = [
  {
    icon: Store,
    title: "Cardápio Digital",
    desc: "Cardápio online com fotos, categorias e variações. Seu cliente vê tudo bonito.",
  },
  {
    icon: ShoppingBag,
    title: "Pedidos pelo Site",
    desc: "Cliente monta o pedido no site e finaliza automaticamente. Sem intervenção manual.",
  },
  {
    icon: CreditCard,
    title: "Pagamento Integrado",
    desc: "Link de pagamento por Pix, boleto ou cartão. Tudo automático.",
  },
  {
    icon: Smartphone,
    title: "Funciona como App",
    desc: "PWA instalável na tela inicial. Parece um app de verdade, sem custo de loja.",
  },
  {
    icon: BarChart3,
    title: "Dashboard Completo",
    desc: "Gerencie pedidos, produtos, relatórios e configurações em tempo real.",
  },
  {
    icon: QrCode,
    title: "QR Code na Mesa",
    desc: "Cliente escaneia o QR Code e já abre o cardápio. Perfeito para restaurantes.",
  },
]

const plans = [
  {
    name: "Grátis",
    price: "0",
    period: "/mês",
    desc: "Para testar e começar a vender",
    features: ["Até 50 pedidos/mês", "Cardápio digital","1 usuário"],
    cta: "Começar grátis",
    highlighted: false,
  },
  {
    name: "Starter",
    price: "49",
    period: "/mês",
    desc: "Para crescer sem limites",
    features: ["Até 200 pedidos/mês", "Tudo do Grátis", "Dashboard completo", "Relatórios", "3 usuários"],
    cta: "Assinar Starter",
    highlighted: true,
    badge: "Mais popular",
  },
  {
    name: "Pro",
    price: "99",
    period: "/mês",
    desc: "Para quem quer escalar",
    features: ["Pedidos ilimitados", "Tudo do Starter", "Controle de estoque", "Financeiro completo", "Cupons e promoções", "Entregadores", "10 usuários"],
    cta: "Assinar Pro",
    highlighted: false,
  },
  {
    name: "Enterprise",
    price: "199",
    period: "/mês",
    desc: "Para redes e franquias",
    features: ["Multi-unidade", "Tudo do Pro", "Multi-tenant", "Suporte prioritário", "Usuários ilimitados", "API personalizada"],
    cta: "Falar com vendas",
    highlighted: false,
  },
]

const faq = [
  {
    q: "Preciso saber programar para usar?",
    a: "Não! O PedeFácil é completamente visual. Você cadastra seus produtos, configura as opções e o sistema funciona automaticamente.",
  },
  {
    q: "Como o cliente faz o pedido?",
    a: "O cliente acessa seu cardápio pelo link ou QR Code, monta o pedido e finaliza. Tudo muito rápido e simples.",
  },
  {
    q: "Preciso pagar por transação?",
    a: "Não cobramos nada por transação. Você paga apenas a taxa do gateway de pagamento (Asaas), igual a qualquer maquininha.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim! Não há fidelidade. Você pode cancelar sua assinatura a qualquer momento sem multa.",
  },
  {
    q: "Funciona no celular?",
    a: "Sim! O PedeFácil é um PWA, funciona como um app no celular sem precisar baixar nada da Play Store.",
  },
  {
    q: "Tem app para o motoboy?",
    a: "Sim! O motoboy recebe um link e visualiza os pedidos prontos para entrega, com mapa e status em tempo real.",
  },
]

const testimonials = [
  {
    name: "Carlos Silva",
    role: "Pizzaria do Carlos",
    text: "Saí do marketplace e economizo R$ 800/mês. O PedeFácil é muito mais simples e meus clientes adoram.",
    rating: 5,
  },
  {
    name: "Maria Santos",
    role: "Lanchonete da Mari",
    text: "Em 1 semana já estava com meu cardápio online. O suporte é incrível, respondem em minutos.",
    rating: 5,
  },
  {
    name: "João Costa",
    role: "Hamburgueria JB",
    text: "O dashboard é incrível. Consigo ver tudo em tempo real: pedidos, estoque, financeiro. Perfeito!",
    rating: 5,
  },
]

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <img src="/icons/pedefacil-logo.svg" alt="PedeFácil" className="h-8" />
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link href="/cadastro">
              <Button size="sm" className="bg-[#FF6B35] hover:bg-[#E55A2B]">Criar Cardápio</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#FFF7F3] to-white py-20">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <div className="mx-auto max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#FFF0E6] px-4 py-1.5 text-sm text-[#FF6B35]">
              <Zap className="h-4 w-4" />
              Seu cardápio, seu controle
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-6xl">
              Seu cardápio online.
              <br />
              <span className="text-[#FF6B35]">Mensalidade fixa, sem surpresas.</span>
            </h1>
            <p className="mt-6 text-lg text-zinc-600">
              Plataforma completa de pedidos e gerenciamento para seu estabelecimento. Cliente acessa seu cardápio,
              escolhe o que quer, paga por Pix/cartão e o pedido vai direto para seu painel. Mensalidade fixa, sem comissão.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/cadastro">
                <Button size="lg" className="bg-[#FF6B35] hover:bg-[#E55A2B] px-8">
                  Criar meu cardápio grátis
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-zinc-100 bg-white py-20">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-3xl font-bold text-zinc-900">
            Tudo que um marketplace tem, sem as taxas de comissão
          </h2>
          <p className="mt-2 text-center text-zinc-600">
            Plataforma completa com preço fixo. Sem surpresas no fim do mês.
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[#FFF0E6]">
                  <f.icon className="h-6 w-6 text-[#FF6B35]" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900">{f.title}</h3>
                <p className="mt-2 text-sm text-zinc-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* System Screenshots */}
      <section className="border-t border-zinc-100 bg-zinc-50 py-20">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-3xl font-bold text-zinc-900">
            Veja como funciona
          </h2>
          <p className="mt-2 text-center text-zinc-600">
            Conheça as principais telas do sistema
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Dashboard */}
            <div className="group rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="aspect-video bg-gradient-to-br from-green-50 to-green-100 p-4">
                <div className="h-full rounded-lg bg-white shadow-sm border border-zinc-100 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    <div className="h-2 w-16 rounded bg-zinc-200"></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="h-8 rounded bg-green-100"></div>
                    <div className="h-8 rounded bg-blue-100"></div>
                    <div className="h-8 rounded bg-orange-100"></div>
                  </div>
                  <div className="h-12 rounded bg-zinc-100"></div>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-zinc-900">Dashboard</h3>
                <p className="text-sm text-zinc-600">Visão geral com vendas, pedidos e relatórios em tempo real</p>
              </div>
            </div>

            {/* Cardápio */}
            <div className="group rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="aspect-video bg-gradient-to-br from-orange-50 to-orange-100 p-4">
                <div className="h-full rounded-lg bg-white shadow-sm border border-zinc-100 p-3">
                  <div className="flex gap-2 mb-2">
                    <div className="h-4 w-12 rounded-full bg-[#FF6B35]"></div>
                    <div className="h-4 w-12 rounded-full bg-zinc-200"></div>
                    <div className="h-4 w-12 rounded-full bg-zinc-200"></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-16 rounded bg-zinc-100"></div>
                    <div className="h-16 rounded bg-zinc-100"></div>
                    <div className="h-16 rounded bg-zinc-100"></div>
                    <div className="h-16 rounded bg-zinc-100"></div>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-zinc-900">Cardápio</h3>
                <p className="text-sm text-zinc-600">Categorias, produtos com fotos e preços</p>
              </div>
            </div>

            {/* Pedidos */}
            <div className="group rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="aspect-video bg-gradient-to-br from-blue-50 to-blue-100 p-4">
                <div className="h-full rounded-lg bg-white shadow-sm border border-zinc-100 p-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 rounded bg-zinc-50">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-blue-200"></div>
                        <div className="h-2 w-16 rounded bg-zinc-200"></div>
                      </div>
                      <div className="h-4 w-12 rounded bg-green-200"></div>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-zinc-50">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-blue-200"></div>
                        <div className="h-2 w-16 rounded bg-zinc-200"></div>
                      </div>
                      <div className="h-4 w-12 rounded bg-yellow-200"></div>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-zinc-50">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-blue-200"></div>
                        <div className="h-2 w-16 rounded bg-zinc-200"></div>
                      </div>
                      <div className="h-4 w-12 rounded bg-orange-200"></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-zinc-900">Pedidos</h3>
                <p className="text-sm text-zinc-600">Acompanhe pedidos em tempo real com status</p>
              </div>
            </div>

            {/* Entregas */}
            <div className="group rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="aspect-video bg-gradient-to-br from-purple-50 to-purple-100 p-4">
                <div className="h-full rounded-lg bg-white shadow-sm border border-zinc-100 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-purple-200"></div>
                    <div>
                      <div className="h-2 w-16 rounded bg-zinc-200 mb-1"></div>
                      <div className="h-2 w-10 rounded bg-zinc-100"></div>
                    </div>
                  </div>
                  <div className="h-16 rounded bg-zinc-100 mb-2"></div>
                  <div className="flex gap-2">
                    <div className="h-4 flex-1 rounded bg-purple-200"></div>
                    <div className="h-4 flex-1 rounded bg-green-200"></div>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-zinc-900">Entregas</h3>
                <p className="text-sm text-zinc-600">Painel do motoboy com mapa e status</p>
              </div>
            </div>

            {/* Caixa */}
            <div className="group rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="aspect-video bg-gradient-to-br from-emerald-50 to-emerald-100 p-4">
                <div className="h-full rounded-lg bg-white shadow-sm border border-zinc-100 p-3">
                  <div className="grid grid-cols-3 gap-1 mb-2">
                    <div className="h-8 rounded bg-emerald-100"></div>
                    <div className="h-8 rounded bg-emerald-100"></div>
                    <div className="h-8 rounded bg-emerald-100"></div>
                    <div className="h-8 rounded bg-emerald-100"></div>
                    <div className="h-8 rounded bg-emerald-100"></div>
                    <div className="h-8 rounded bg-emerald-100"></div>
                  </div>
                  <div className="h-6 rounded bg-emerald-200"></div>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-zinc-900">Caixa</h3>
                <p className="text-sm text-zinc-600">Tela de vendas presenciais simplificada</p>
              </div>
            </div>

            {/* Estoque */}
            <div className="group rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="aspect-video bg-gradient-to-br from-amber-50 to-amber-100 p-4">
                <div className="h-full rounded-lg bg-white shadow-sm border border-zinc-100 p-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="h-2 w-20 rounded bg-zinc-200"></div>
                      <div className="h-2 w-8 rounded bg-amber-200"></div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="h-2 w-16 rounded bg-zinc-200"></div>
                      <div className="h-2 w-8 rounded bg-green-200"></div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="h-2 w-24 rounded bg-zinc-200"></div>
                      <div className="h-2 w-8 rounded bg-red-200"></div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="h-2 w-14 rounded bg-zinc-200"></div>
                      <div className="h-2 w-8 rounded bg-amber-200"></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-zinc-900">Estoque</h3>
                <p className="text-sm text-zinc-600">Controle de insumos e baixa automática</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="bg-zinc-50 py-20">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-3xl font-bold text-zinc-900">
            Mensalidade fixa. Zero comissão.
          </h2>
          <p className="mt-2 text-center text-zinc-600">
            Compare e veja quanto você economiza por mês.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {/* Marketplace */}
            <div className="rounded-xl border border-red-200 bg-white p-6">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                </div>
                <h3 className="font-semibold text-red-700">Marketplace Tradicional</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-600">Comissão por pedido</span>
                  <span className="font-bold text-red-600">12% a 27%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Processamento pagamento</span>
                  <span className="font-bold text-red-600">3.2%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Mensalidade</span>
                  <span className="font-bold text-red-600">R$ 150+</span>
                </div>
                <div className="border-t border-zinc-200 pt-3">
                  <div className="flex justify-between">
                    <span className="font-semibold text-zinc-900">Total em 100 pedidos (R$50)</span>
                    <span className="font-bold text-red-600">R$ 1.325/mês</span>
                  </div>
                </div>
              </div>
            </div>

            {/* PedeFácil */}
            <div className="rounded-xl border-2 border-[#FF6B35] bg-white p-6">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFF0E6]">
                  <Check className="h-4 w-4 text-[#FF6B35]" />
                </div>
                <h3 className="font-semibold text-[#FF6B35]">PedeFácil</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-600">Comissão por pedido</span>
                  <span className="font-bold text-green-600">0%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Processamento pagamento</span>
                  <span className="font-bold text-green-600">Taxa do Asaas</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Mensalidade</span>
                  <span className="font-bold text-green-600">R$ 0 a R$ 199</span>
                </div>
                <div className="border-t border-zinc-200 pt-3">
                  <div className="flex justify-between">
                    <span className="font-semibold text-zinc-900">Total em 100 pedidos (R$50)</span>
                    <span className="font-bold text-green-600">R$ 49/mês</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-4 text-center text-sm text-zinc-500">
            * Economia de até R$ 15.000/ano comparado a marketplaces tradicionais
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-white py-20" id="planos">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-3xl font-bold text-zinc-900">
            Mensalidade fixa, sem surpresas
          </h2>
          <p className="mt-2 text-center text-zinc-600">
            Escolha o plano ideal para o tamanho do seu negócio. Cancele quando quiser.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border p-6 ${
                  plan.highlighted
                    ? "border-[#FF6B35] bg-[#FFF7F3] shadow-lg"
                    : "border-zinc-200 bg-white"
                }`}
              >
                {plan.badge && (
                  <div className="mb-3 inline-flex rounded-full bg-[#FF6B35] px-3 py-1 text-xs font-medium text-white">
                    {plan.badge}
                  </div>
                )}
                <h3 className="text-lg font-bold text-zinc-900">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-zinc-900">R$ {plan.price}</span>
                  <span className="text-sm text-zinc-500">{plan.period}</span>
                </div>
                <p className="mt-2 text-sm text-zinc-600">{plan.desc}</p>
                <ul className="mt-4 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-zinc-600">
                      <Check className="h-4 w-4 text-[#FF6B35]" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/cadastro" className="mt-6 block">
                  <Button
                    className={`w-full ${
                      plan.highlighted
                        ? "bg-[#FF6B35] hover:bg-[#E55A2B]"
                        : "bg-zinc-900 hover:bg-zinc-800"
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-zinc-50 py-20">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-3xl font-bold text-zinc-900">
            Quem já usa, recomenda
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {testimonials.map((t) => (
              <div key={t.name} className="rounded-xl border border-zinc-200 bg-white p-6">
                <div className="mb-3 flex gap-1">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <span key={i} className="text-yellow-400">★</span>
                  ))}
                </div>
                <p className="text-sm text-zinc-600">&ldquo;{t.text}&rdquo;</p>
                <div className="mt-4">
                  <p className="font-semibold text-zinc-900">{t.name}</p>
                  <p className="text-xs text-zinc-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center text-3xl font-bold text-zinc-900">
            Perguntas frequentes
          </h2>
          <div className="mt-8 space-y-3">
            {faq.map((item, i) => (
              <div
                key={i}
                className="rounded-xl border border-zinc-200 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between p-4 text-left"
                >
                  <span className="font-medium text-zinc-900">{item.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-zinc-500 transition-transform ${
                      openFaq === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-sm text-zinc-600">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="bg-[#FF6B35] py-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold text-white">
            Comece a vender online hoje
          </h2>
          <p className="mt-3 text-lg text-white/90">
            Crie seu cardápio em 2 minutos. Sem cartão de crédito. Sem mensalidade no plano grátis.
          </p>
          <div className="mt-8">
            <Link href="/cadastro">
              <Button size="lg" className="bg-white text-[#FF6B35] hover:bg-zinc-100 px-8">
                Criar meu cardápio grátis
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-zinc-500">
          <div className="mb-4">
            <img src="/icons/pedefacil-logo.svg" alt="PedeFácil" className="mx-auto h-6" />
          </div>
          <p>PedeFácil © 2024 — Seu cardápio, seu controle</p>
          <div className="mt-3 flex items-center justify-center gap-4 text-xs">
            <Link href="/cadastro" className="hover:text-[#FF6B35]">Criar conta</Link>
            <Link href="/dashboard" className="hover:text-[#FF6B35]">Entrar</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
