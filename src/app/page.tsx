"use client"

import Link from "next/link"
import { Smartphone, BarChart3, CreditCard, ShoppingBag, QrCode, Store, Check, ChevronDown, Zap, Shield, TrendingDown, ArrowRight, Star, Sparkles, Globe, Users, Clock, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect, useRef } from "react"

const features = [
  { icon: Store, title: "Cardápio Digital", desc: "Fotos, categorias e preços. Seu cliente vê tudo bonito e pede em segundos." },
  { icon: ShoppingBag, title: "Pedidos Automáticos", desc: "Cliente monta, paga e o pedido vai direto para seu painel. Zero intervenção manual." },
  { icon: CreditCard, title: "Pagamento Integrado", desc: "Pix, cartão ou boleto. Link de pagamento automático via Asaas." },
  { icon: Smartphone, title: "PWA (parece um App)", desc: "Instalável na tela inicial. Sem Play Store, sem custo de desenvolvimento." },
  { icon: BarChart3, title: "Dashboard Inteligente", desc: "Vendas, pedidos, estoque, financeiro. Tudo em tempo real." },
  { icon: QrCode, title: "QR Code na Mesa", desc: "Cliente escaneia e abre o cardápio. Perfeito para restaurantes e bares." },
]

const plans = [
  { name: "Starter", price: "49", period: "/mês", desc: "Para crescer sem limites", features: ["Até 200 pedidos/mês", "Cardápio digital", "Dashboard completo", "Relatórios", "3 usuários"], cta: "Testar 7 dias grátis", highlighted: true, badge: "Mais popular" },
  { name: "Pro", price: "99", period: "/mês", desc: "Para quem quer escalar", features: ["Pedidos ilimitados", "Tudo do Starter", "Controle de estoque", "Financeiro completo", "Cupons e promoções", "Entregadores", "10 usuários"], cta: "Testar 7 dias grátis", highlighted: false },
  { name: "Enterprise", price: "199", period: "/mês", desc: "Para redes e franquias", features: ["Multi-unidade", "Tudo do Pro", "Multi-tenant", "Suporte prioritário", "Usuários ilimitados", "API personalizada"], cta: "Falar com vendas", highlighted: false },
]

const faq = [
  { q: "Preciso saber programar para usar?", a: "Não! O PedeFácil é completamente visual. Você cadastra seus produtos, configura as opções e o sistema funciona automaticamente." },
  { q: "Como o cliente faz o pedido?", a: "O cliente acessa seu cardápio pelo link ou QR Code, monta o pedido e finaliza. Tudo muito rápido e simples." },
  { q: "Preciso pagar por transação?", a: "Não cobramos nada por transação. Você paga apenas a taxa do gateway de pagamento (Asaas), igual a qualquer maquininha." },
  { q: "Posso cancelar quando quiser?", a: "Sim! Não há fidelidade. Você pode cancelar sua assinatura a qualquer momento sem multa." },
  { q: "Funciona no celular?", a: "Sim! O PedeFácil é um PWA, funciona como um app no celular sem precisar baixar nada da Play Store." },
  { q: "Tem app para o motoboy?", a: "Sim! O motoboy recebe um link e visualiza os pedidos prontos para entrega, com mapa e status em tempo real." },
]

const testimonials = [
  { name: "Carlos Silva", role: "Pizzaria do Carlos", text: "Saí do marketplace e economizo R$ 800/mês. O PedeFácil é muito mais simples e meus clientes adoram.", rating: 5 },
  { name: "Maria Santos", role: "Lanchonete da Mari", text: "Em 1 semana já estava com meu cardápio online. O suporte é incrível, respondem em minutos.", rating: 5 },
  { name: "João Costa", role: "Hamburgueria JB", text: "O dashboard é incrível. Consigo ver tudo em tempo real: pedidos, estoque, financeiro. Perfeito!", rating: 5 },
]

function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, className: `transition-all duration-1000 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}` }
}

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [scrollY, setScrollY] = useState(0)
  const hero = useReveal(0.1)
  const brand = useReveal(0.15)
  const feat = useReveal(0.1)
  const how = useReveal(0.1)
  const compare = useReveal(0.1)
  const pricing = useReveal(0.1)
  const test = useReveal(0.1)
  const faqSec = useReveal(0.1)
  const cta = useReveal(0.1)

  useEffect(() => {
    const h = () => setScrollY(window.scrollY)
    window.addEventListener("scroll", h, { passive: true })
    return () => window.removeEventListener("scroll", h)
  }, [])

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-60 -left-60 h-[700px] w-[700px] rounded-full bg-[#FF6B35]/[0.07] blur-[150px]" />
        <div className="absolute top-[40%] -right-60 h-[500px] w-[500px] rounded-full bg-purple-600/[0.06] blur-[130px]" />
        <div className="absolute bottom-0 left-[30%] h-[400px] w-[400px] rounded-full bg-blue-600/[0.05] blur-[120px]" />
      </div>

      {/* Navbar */}
      <nav className={`fixed top-0 z-50 w-full transition-all duration-500 ease-out ${scrollY > 50 ? "border-b border-white/[0.08] bg-black/60 backdrop-blur-xl" : "bg-transparent"}`}>
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 md:px-[60px]">
          <div className="flex items-center gap-3">
            <img src="/icons/pedefacil-logo.svg" alt="PedeFácil" className="h-12 md:h-14" />
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-[15px] font-medium text-white/50 hover:text-white transition-colors duration-300">Entrar</Link>
            <Link href="/cadastro" className="hidden sm:inline-flex">
              <span className="inline-flex h-[44px] items-center rounded-full bg-[#FF6B35] px-6 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer">
                Testar 7 dias grátis
              </span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section ref={hero.ref} className={`relative z-10 min-h-svh flex flex-col items-center justify-center px-5 pt-20 ${hero.className}`}>
        <div className="mx-auto max-w-[980px] text-center">
          {/* Overline */}
          <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">Cardápio digital + gestão completa</p>

          {/* Logo central */}
          <div className="mb-10 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-[#FF6B35]/20 blur-[60px]" />
              <img src="/icons/pedefacil-logo.svg" alt="PedeFácil" className="relative h-24 md:h-32" />
            </div>
          </div>

          <h1 className="text-[40px] md:text-[72px] font-semibold leading-[118%] md:leading-[105%] tracking-[-1px] md:tracking-[-2.4px]">
            A solução completa
            <br />
            <span className="bg-gradient-to-r from-[#FF6B35] via-[#FF8F6B] to-[#FFB088] bg-clip-text text-transparent">pro seu estabelecimento.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-[640px] text-[16px] md:text-[18px] leading-[150%] tracking-[-0.3px] text-white/50 font-light">
            Cardápio digital, pedidos automáticos, pagamento integrado e gestão completa — tudo por mensalidade fixa, sem comissão por pedido.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/cadastro">
              <span className="inline-flex h-[58px] items-center gap-2 rounded-full bg-gradient-to-r from-[#FF6B35] to-[#E55A2B] px-10 text-[18px] font-semibold text-white transition-opacity hover:opacity-90 shadow-[0_0_40px_rgba(255,107,53,0.3)]">
                Testar 7 dias grátis
                <ArrowRight className="h-5 w-5" />
              </span>
            </Link>
            <Link href="#planos">
              <span className="inline-flex h-[58px] items-center rounded-full border border-white/10 px-10 text-[16px] font-medium text-white/50 transition-colors hover:border-white/20 hover:text-white cursor-pointer">
                Ver planos
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats marquee */}
      <section className="relative z-10 border-y border-white/[0.06] py-8">
        <div className="mx-auto flex max-w-[1440px] items-center justify-center gap-12 md:gap-24 px-5">
          {[
            { v: "2.500+", l: "Estabelecimentos" },
            { v: "150K+", l: "Pedidos processados" },
            { v: "R$ 0", l: "Comissão por pedido" },
            { v: "99.9%", l: "Uptime" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <p className="text-[28px] md:text-[36px] font-semibold tracking-[-1px] bg-gradient-to-r from-[#FF6B35] to-[#FF8F6B] bg-clip-text text-transparent">{s.v}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/25">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Brand Showcase */}
      <section ref={brand.ref} className={`relative z-10 py-[120px] md:py-[200px] ${brand.className}`}>
        <div className="mx-auto max-w-[1080px] px-5 md:px-[60px]">
          <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-8 md:p-16">
            <div className="grid items-center gap-12 md:grid-cols-[1fr_1.2fr]">
              <div>
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">Por que PedeFácil</p>
                <h2 className="text-[32px] md:text-[48px] font-semibold leading-[115%] tracking-[-1px] md:tracking-[-1.6px]">
                  Não é só cardápio.
                  <br />
                  <span className="bg-gradient-to-r from-[#FF6B35] to-[#FF8F6B] bg-clip-text text-transparent">É o sistema completo.</span>
                </h2>
                <p className="mt-5 text-[15px] md:text-[17px] leading-[150%] tracking-[-0.3px] text-white/40 font-light">
                  Do cardápio digital ao controle total do seu negócio. Pedidos, caixa, estoque, financeiro, entregadores, relatórios — tudo em um só lugar.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Globe, label: "Cardápio Online" },
                  { icon: ShoppingBag, label: "Pedidos Automáticos" },
                  { icon: CreditCard, label: "Pagamento Integrado" },
                  { icon: BarChart3, label: "Dashboard" },
                  { icon: Users, label: "Gestão de Equipe" },
                  { icon: Clock, label: "Controle de Caixa" },
                  { icon: TrendingUp, label: "Relatórios" },
                  { icon: Smartphone, label: "PWA (App)" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 rounded-[12px] border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                    <item.icon className="h-4 w-4 text-[#FF6B35]" />
                    <span className="text-[13px] font-medium text-white/60">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section ref={feat.ref} className={`relative z-10 py-[120px] md:py-[200px] ${feat.className}`}>
        <div className="mx-auto max-w-[1080px] px-5 md:px-[60px]">
          <div className="mb-16 md:mb-24">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">Funcionalidades</p>
            <h2 className="text-[32px] md:text-[56px] font-semibold leading-[115%] tracking-[-1px] md:tracking-[-2px] max-w-[800px]">
              Tudo que um marketplace tem.
              <br />
              <span className="bg-gradient-to-r from-[#FF6B35] to-[#FF8F6B] bg-clip-text text-transparent">Sem as taxas de comissão.</span>
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="group rounded-[16px] border border-white/[0.08] bg-white/[0.02] p-8 transition-all duration-500 hover:border-white/[0.15] hover:bg-white/[0.05]">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#FF6B35]/10">
                  <f.icon className="h-5 w-5 text-[#FF6B35]" />
                </div>
                <h3 className="text-[20px] md:text-[22px] font-semibold tracking-[-0.5px] text-white">{f.title}</h3>
                <p className="mt-3 text-[15px] leading-[150%] tracking-[-0.3px] text-white/40 font-light">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it looks */}
      <section ref={how.ref} className={`relative z-10 py-[120px] md:py-[200px] ${how.className}`}>
        <div className="mx-auto max-w-[1080px] px-5 md:px-[60px]">
          <div className="mb-16 md:mb-24 text-center">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">Visual</p>
            <h2 className="text-[32px] md:text-[56px] font-semibold leading-[115%] tracking-[-1px] md:tracking-[-2px]">
              Veja como funciona
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "Dashboard", desc: "Vendas, pedidos e relatórios em tempo real", bg: "from-green-500/[0.08] to-emerald-500/[0.04]", border: "border-green-500/[0.12]", icon: BarChart3, iconColor: "text-green-400" },
              { title: "Cardápio", desc: "Categorias, produtos com fotos e preços", bg: "from-[#FF6B35]/[0.08] to-orange-500/[0.04]", border: "border-[#FF6B35]/[0.12]", icon: Store, iconColor: "text-[#FF6B35]" },
              { title: "Pedidos", desc: "Acompanhe pedidos em tempo real com status", bg: "from-blue-500/[0.08] to-purple-500/[0.04]", border: "border-blue-500/[0.12]", icon: ShoppingBag, iconColor: "text-blue-400" },
              { title: "Entregas", desc: "Painel do motoboy com mapa e status", bg: "from-purple-500/[0.08] to-pink-500/[0.04]", border: "border-purple-500/[0.12]", icon: Smartphone, iconColor: "text-purple-400" },
              { title: "Caixa", desc: "Vendas presenciais simplificadas", bg: "from-emerald-500/[0.08] to-teal-500/[0.04]", border: "border-emerald-500/[0.12]", icon: CreditCard, iconColor: "text-emerald-400" },
              { title: "Estoque", desc: "Controle de insumos e baixa automática", bg: "from-amber-500/[0.08] to-yellow-500/[0.04]", border: "border-amber-500/[0.12]", icon: QrCode, iconColor: "text-amber-400" },
            ].map((item) => (
              <div key={item.title} className={`rounded-[16px] border ${item.border} bg-gradient-to-br ${item.bg} p-6 transition-all duration-500 hover:scale-[1.02]`}>
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[14px] border border-white/[0.08] bg-white/[0.04]">
                  <item.icon className={`h-7 w-7 ${item.iconColor}`} />
                </div>
                <h3 className="text-[17px] font-semibold tracking-[-0.3px] text-white">{item.title}</h3>
                <p className="mt-1 text-[14px] text-white/35">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section ref={compare.ref} className={`relative z-10 py-[120px] md:py-[200px] ${compare.className}`}>
        <div className="mx-auto max-w-[980px] px-5 md:px-[60px]">
          <div className="mb-16 md:mb-24 text-center">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">Comparação</p>
            <h2 className="text-[32px] md:text-[56px] font-semibold leading-[115%] tracking-[-1px] md:tracking-[-2px]">
              <span className="text-red-400">Marketplace</span>{" vs "}
              <span className="bg-gradient-to-r from-[#FF6B35] to-[#FF8F6B] bg-clip-text text-transparent">PedeFácil</span>
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[16px] border border-red-500/[0.15] bg-red-500/[0.04] p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-red-500/10">
                  <TrendingDown className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-[17px] font-semibold text-red-400">Marketplace Tradicional</h3>
                  <p className="text-[12px] text-white/25">iFood, Rappi, etc.</p>
                </div>
              </div>
              <div className="space-y-3 text-[15px]">
                <div className="flex justify-between"><span className="text-white/40">Comissão por pedido</span><span className="font-semibold text-red-400">12% a 27%</span></div>
                <div className="flex justify-between"><span className="text-white/40">Processamento pagamento</span><span className="font-semibold text-red-400">3.2%</span></div>
                <div className="flex justify-between"><span className="text-white/40">Mensalidade</span><span className="font-semibold text-red-400">R$ 150+</span></div>
                <div className="border-t border-white/[0.08] pt-3">
                  <div className="flex justify-between"><span className="font-medium text-white">Total em 100 pedidos</span><span className="font-semibold text-red-400">R$ 1.325/mês</span></div>
                </div>
              </div>
            </div>

            <div className="relative rounded-[16px] border-2 border-[#FF6B35]/40 bg-[#FF6B35]/[0.06] p-8 shadow-[0_0_60px_rgba(255,107,53,0.08)]">
              <div className="absolute -top-3 right-6 rounded-full bg-gradient-to-r from-[#FF6B35] to-[#FF8F6B] px-4 py-1.5 text-[12px] font-semibold text-white shadow-lg">
                Economia de R$ 15.000/ano
              </div>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#FF6B35]/15">
                  <Check className="h-5 w-5 text-[#FF6B35]" />
                </div>
                <div>
                  <h3 className="text-[17px] font-semibold text-[#FF6B35]">PedeFácil</h3>
                  <p className="text-[12px] text-white/25">Seu cardápio, seu controle</p>
                </div>
              </div>
              <div className="space-y-3 text-[15px]">
                <div className="flex justify-between"><span className="text-white/40">Comissão por pedido</span><span className="font-semibold text-green-400">0%</span></div>
                <div className="flex justify-between"><span className="text-white/40">Processamento pagamento</span><span className="font-semibold text-green-400">Taxa do Asaas</span></div>
                <div className="flex justify-between"><span className="text-white/40">Mensalidade</span><span className="font-semibold text-green-400">R$ 0 a R$ 199</span></div>
                <div className="border-t border-white/[0.08] pt-3">
                  <div className="flex justify-between"><span className="font-medium text-white">Total em 100 pedidos</span><span className="font-semibold text-green-400">R$ 49/mês</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section ref={pricing.ref} className={`relative z-10 py-[120px] md:py-[200px] ${pricing.className}`} id="planos">
        <div className="mx-auto max-w-[1080px] px-5 md:px-[60px]">
          <div className="mb-16 md:mb-24 text-center">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">Planos</p>
            <h2 className="text-[32px] md:text-[56px] font-semibold leading-[115%] tracking-[-1px] md:tracking-[-2px]">
              Mensalidade fixa.
              <br />
              <span className="bg-gradient-to-r from-[#FF6B35] to-[#FF8F6B] bg-clip-text text-transparent">Sem surpresas.</span>
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <div key={plan.name} className={`relative rounded-[16px] border p-7 transition-all duration-500 hover:scale-[1.02] ${plan.highlighted ? "border-[#FF6B35]/40 bg-[#FF6B35]/[0.06] shadow-[0_0_60px_rgba(255,107,53,0.08)]" : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]"}`}>
                {plan.badge && (
                  <div className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-[#FF6B35] to-[#FF8F6B] px-4 py-1.5 text-[11px] font-semibold text-white">
                    {plan.badge}
                  </div>
                )}
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/30">{plan.name}</p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-[40px] font-semibold tracking-[-1.5px] text-white">R$ {plan.price}</span>
                  <span className="text-[14px] text-white/30">{plan.period}</span>
                </div>
                <p className="mt-2 text-[14px] text-white/35">{plan.desc}</p>
                <ul className="mt-5 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-[14px] text-white/50">
                      <Check className="h-4 w-4 text-[#FF6B35]" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/cadastro" className="mt-6 block">
                  <span className={`flex h-[48px] w-full items-center justify-center rounded-full text-[15px] font-semibold transition-opacity hover:opacity-90 cursor-pointer ${plan.highlighted ? "bg-[#FF6B35] text-white shadow-[0_0_30px_rgba(255,107,53,0.25)]" : "border border-white/10 text-white/60 hover:border-white/20 hover:text-white"}`}>
                    {plan.cta}
                  </span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section ref={test.ref} className={`relative z-10 py-[120px] md:py-[200px] ${test.className}`}>
        <div className="mx-auto max-w-[1080px] px-5 md:px-[60px]">
          <div className="mb-16 md:mb-24 text-center">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">Depoimentos</p>
            <h2 className="text-[32px] md:text-[56px] font-semibold leading-[115%] tracking-[-1px] md:tracking-[-2px]">
              Quem usa, recomenda
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((t) => (
              <div key={t.name} className="rounded-[16px] border border-white/[0.08] bg-white/[0.02] p-8 transition-all duration-500 hover:border-white/[0.15] hover:bg-white/[0.05]">
                <div className="mb-4 flex gap-1">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-[15px] leading-[150%] tracking-[-0.3px] text-white/50 font-light">&ldquo;{t.text}&rdquo;</p>
                <div className="mt-6">
                  <p className="text-[15px] font-semibold text-white">{t.name}</p>
                  <p className="text-[12px] text-white/25">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section ref={faqSec.ref} className={`relative z-10 py-[120px] md:py-[200px] ${faqSec.className}`}>
        <div className="mx-auto max-w-[720px] px-5 md:px-[60px]">
          <div className="mb-16 md:mb-24 text-center">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">FAQ</p>
            <h2 className="text-[32px] md:text-[48px] font-semibold leading-[115%] tracking-[-1px] md:tracking-[-1.6px]">
              Perguntas frequentes
            </h2>
          </div>
          <div className="space-y-3">
            {faq.map((item, i) => (
              <div key={i} className="rounded-[12px] border border-white/[0.08] bg-white/[0.02] overflow-hidden transition-colors hover:border-white/[0.12]">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="flex w-full items-center justify-between p-6 text-left">
                  <span className="text-[15px] font-medium text-white">{item.q}</span>
                  <ChevronDown className={`h-5 w-5 text-white/30 transition-transform duration-300 ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-400 ${openFaq === i ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
                  <div className="px-6 pb-6 text-[14px] leading-[150%] text-white/40 font-light">{item.a}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section ref={cta.ref} className={`relative z-10 py-[120px] md:py-[200px] ${cta.className}`}>
        <div className="mx-auto max-w-[980px] px-5 md:px-[60px]">
          <div className="rounded-[24px] border border-[#FF6B35]/20 bg-gradient-to-br from-[#FF6B35]/[0.08] to-purple-600/[0.04] p-12 md:p-20 text-center">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">Comece agora</p>
            <h2 className="text-[36px] md:text-[64px] font-semibold leading-[110%] tracking-[-1.5px] md:tracking-[-2.4px]">
              <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">O marketplace cobra até 27% por pedido.</span>
              <br />
              <span className="bg-gradient-to-r from-[#FF6B35] to-[#FF8F6B] bg-clip-text text-transparent">Aqui é mensalidade fixa.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-[500px] text-[16px] md:text-[18px] leading-[150%] text-white/40 font-light">
              Teste 7 dias grátis. Sem cartão. Cancele quando quiser.
            </p>
            <div className="mt-10">
              <Link href="/cadastro">
                <span className="inline-flex h-[58px] items-center gap-2 rounded-full bg-gradient-to-r from-[#FF6B35] to-[#E55A2B] px-10 text-[18px] font-semibold text-white transition-opacity hover:opacity-90 shadow-[0_0_50px_rgba(255,107,53,0.3)]">
                  Testar 7 dias grátis
                  <ArrowRight className="h-5 w-5" />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] py-10">
        <div className="mx-auto max-w-[1440px] px-5 md:px-[60px]">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-3">
              <img src="/icons/pedefacil-logo.svg" alt="PedeFácil" className="h-10 opacity-40" />
              <span className="text-[14px] text-white/25">PedeFácil © 2024</span>
            </div>
            <div className="flex items-center gap-6 text-[13px] text-white/25">
              <Link href="/cadastro" className="hover:text-[#FF6B35] transition-colors">Criar conta</Link>
              <Link href="/login" className="hover:text-[#FF6B35] transition-colors">Entrar</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
