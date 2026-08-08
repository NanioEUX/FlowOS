"use client"

import { useState } from "react"
import { Star, Clock, MapPin, Shield, Truck, ChevronRight, Heart, Share2, Minus, Plus, X, Check, ShoppingBag, ArrowRight, Sparkles, TrendingUp, Users, AlertCircle, Gift, Repeat, MessageSquare, ThumbsUp, BadgePercent, Timer, Zap, Award, CreditCard, Banknote, QrCode, PartyPopper, Copy, ExternalLink } from "lucide-react"

const improvements = [
  {
    id: 1,
    title: "Tela Principal - Menu",
    subtitle: "Atração + Desejo + Escassez",
    icon: "🏠",
    color: "from-blue-500 to-indigo-600",
    before: {
      label: "Antes",
      issues: [
        "Sem barra de progresso de frete grátis",
        "Sem indicador de popularidade nos itens",
        "Sem urgência/escassez",
        "Sem botão 'pedir novamente' para clientes recorrentes",
        "Header não mostra status do pedido em andamento",
      ]
    },
    after: {
      label: "Depois",
      improvements: [
        { title: "Barra de progresso frete grátis", desc: "Psicologia de conclusão — mostra 'Faltam R$ 12,00 para frete grátis' com barra animada", icon: "🎯" },
        { title: "Badge 'Mais Pedido' nos TOP itens", desc: "Social proof — '238 pedidos essa semana' gera confiança e FOMO", icon: "🔥" },
        { title: "Header com status do pedido ativo", desc: "Se tem pedido em andamento, mostra mini-tracker: 'Seu pedido saiu para entrega'", icon: "📦" },
        { title: "Seção 'Pedir Novamente' para recorrentes", desc: "Reduz fricção — cliente que já pediu vê seus últimos pedidos com 1 toque", icon: "🔄" },
        { title: "Indicador 'Últimas unidades' em itens com estoque baixo", desc: "Escassez real — gera urgência de compra imediata", icon: "⏰" },
        { title: "Skeleton loading animado", desc: "Sensação de velocidade — carregamento mais fluido e profissional", icon: "✨" },
      ]
    }
  },
  {
    id: 2,
    title: "Detalhes do Produto",
    subtitle: "Confiança + Desejo + Conversão",
    icon: "🍦",
    color: "from-emerald-500 to-teal-600",
    before: {
      label: "Antes",
      issues: [
        "Sem avaliações/reviews de clientes",
        "Sem sugestão de 'frequentemente pedidos juntos'",
        "Sem tempo estimado de preparo",
        "Sem botão de favoritar",
        "Botão 'Adicionar' sem urgência",
      ]
    },
    after: {
      label: "Depois",
      improvements: [
        { title: "Avaliações com estrelas e reviews", desc: "4.8 estrelas (127 avaliações) — social proof mais forte que qualquer badge", icon: "⭐" },
        { title: "Seção 'Quem pediu, também pediu'", desc: "Cross-sell inteligente — aumenta ticket médio em 25-40%", icon: "💡" },
        { title: "Tempo de preparo estimado", desc: "'Preparo: ~15 min' — gerencia expectativa e reduz ansiedade", icon: "⏱️" },
        { title: "Botão Favoritar (coração)", desc: "Engajamento — favoritos criam conexão emocional e facilitam recompra", icon: "❤️" },
        { title: "Botão 'Adicionar' com micro-animação", desc: "Feedback visual satisfatório — bolha '+1' saindo do botão", icon: "🫧" },
        { title: "Preço parcelado visível", desc: "'ou 3x de R$ 3,33 sem juros' — ancora preço e reduz resistência", icon: "💳" },
      ]
    }
  },
  {
    id: 3,
    title: "Carrinho de Compras",
    subtitle: "Urgência + Escassez + Recuperação",
    icon: "🛒",
    color: "from-orange-500 to-red-600",
    before: {
      label: "Antes",
      issues: [
        "Sem timer de retenção do pedido",
        "Sem display de economia total",
        "Sem sugestões de itens para completar o pedido",
        "Cupom sem destaque visual",
        "Sem estimativa de entrega no carrinho",
      ]
    },
    after: {
      label: "Depois",
      improvements: [
        { title: "Timer 'Seu carrinho reserva por 10:00'", desc: "Urgência artificial — carrinho expira, gera ação imediata", icon: "⏳" },
        { title: "Banner 'Você está economizando R$ 8,50!'", desc: "Reforço de valor — cliente se sente inteligente por ter comprado", icon: "💰" },
        { title: "Sugestão 'Complete seu pedido'", desc: "'Adicione um picolé por apenas R$ 5,00' — aumenta ticket médio", icon: "➕" },
        { title: "Barra de progresso frete grátis animada", desc: "Faltam R$ 12,00 — gamificação que incentiva adicionar mais itens", icon: "🎯" },
        { title: "Estimativa de entrega no carrinho", desc: "'Chega em 35-45 min' — transparência reduz abandono", icon: "🚴" },
        { title: "Botão 'Esvaziar' com confirmação", desc: "Previne ação acidental — 'Tem certeza? Seus itens serão perdidos'", icon: "🛡️" },
      ]
    }
  },
  {
    id: 4,
    title: "Finalização do Pedido",
    subtitle: "Confiança + Redução de Ansiedade",
    icon: "💳",
    color: "from-purple-500 to-pink-600",
    before: {
      label: "Antes",
      issues: [
        "Sem sinais de segurança/confiança",
        "Sem resumo visual do pedido (só texto)",
        "Sem estimativa de entrega na confirmação",
        "Botão 'Confirmar' sem reforço de segurança",
        "Sem opção de salvar endereço",
      ]
    },
    after: {
      label: "Depois",
      improvements: [
        { title: "Selo 'Compra 100% Segura' com cadeado", desc: "Trust signal — reduz ansiedade no momento mais crítico da conversão", icon: "🔒" },
        { title: "Resumo do pedido com miniaturas", desc: "Imagens dos itens — confirma visualmente o que está comprando", icon: "🖼️" },
        { title: "Estimativa de entrega final", desc: "'Previsão: 35-45 min' — manage expectativa desde o início", icon: "📍" },
        { title: "Botão com gradiente + ícone de cadeado", desc: "'Confirmar Pedido 🔒' — refuerza segurança no CTA principal", icon: "✅" },
        { title: "Seção 'Alguma observação?' expansível", desc: "Escondecomplexidade — só mostra quando cliente clica", icon: "📝" },
        { title: "Badges de pagamento (Pix, Cartão, Dinheiro)", desc: "Ícones visuais — processamento mental mais rápido", icon: "🏷️" },
      ]
    }
  },
  {
    id: 5,
    title: "Confirmação do Pedido",
    subtitle: "Retenção + Fidelização + Social",
    icon: "🎉",
    color: "from-yellow-500 to-orange-600",
    before: {
      label: "Antes",
      issues: [
        "Sem animação de celebração",
        "Sem tempo estimado de entrega visível",
        "Sem tracking visual do pedido",
        "Sem opção de compartilhar",
        "Cashback显示不够突出",
      ]
    },
    after: {
      label: "Depois",
      improvements: [
        { title: "Confetti + animação de sucesso", desc: "Dopamina — celebração visual gera satisfação imediata pós-compra", icon: "🎊" },
        { title: "Timer regressivo de entrega", desc: "'Chega em 38 min' com countdown — reduz ansiedade e check-back", icon: "⏰" },
        { title: "Tracker visual em steps", desc: "'Confirmado → Preparando → Saiu → Entregue' — transparência total", icon: "📊" },
        { title: "Cashback com progresso", desc: "'Faltam R$ 28 para seu próximo cupom de R$ 15' — gamificação de fidelidade", icon: "🎁" },
        { title: "Botão 'Compartilhar pedido'", desc: "Viralidade — 'Anime seus amigos' com link de indicação", icon: "📤" },
        { title: "Botão 'Pedir Novamente' em destaque", desc: "Recompra fácil — reduz fricção para próximo pedido", icon: "🔄" },
      ]
    }
  },
]

function BeforeAfterCard({ data }: { data: typeof improvements[0] }) {
  const [showAfter, setShowAfter] = useState(true)

  return (
    <div className="mb-12">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">{data.icon}</span>
        <div>
          <h3 className="text-xl font-bold text-zinc-900">{data.title}</h3>
          <p className="text-sm text-zinc-500">{data.subtitle}</p>
        </div>
      </div>

      {/* Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setShowAfter(false)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${!showAfter ? "bg-red-100 text-red-700 border-2 border-red-300" : "bg-zinc-100 text-zinc-500 border-2 border-transparent"}`}
        >
          ❌ Antes (Atual)
        </button>
        <button
          onClick={() => setShowAfter(true)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${showAfter ? "bg-emerald-100 text-emerald-700 border-2 border-emerald-300" : "bg-zinc-100 text-zinc-500 border-2 border-transparent"}`}
        >
          ✅ Depois (Proposto)
        </button>
      </div>

      {/* Content */}
      <div className={`rounded-2xl border-2 p-5 transition-all ${showAfter ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/50"}`}>
        {showAfter ? (
          <div className="space-y-3">
            {data.after.improvements.map((imp, i) => (
              <div key={i} className="flex gap-3 p-3 bg-white rounded-xl border border-emerald-100 shadow-sm">
                <span className="text-2xl flex-shrink-0">{imp.icon}</span>
                <div>
                  <h4 className="font-semibold text-zinc-900 text-sm">{imp.title}</h4>
                  <p className="text-xs text-zinc-500 mt-0.5">{imp.desc}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {data.before.issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 p-3 bg-white rounded-xl border border-red-100">
                <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-zinc-700">{issue}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MockMenuPage() {
  return (
    <div className="max-w-[390px] mx-auto bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-zinc-200">
      {/* Status bar mock */}
      <div className="bg-zinc-900 text-white text-[10px] px-6 py-1.5 flex justify-between items-center">
        <span>11:56</span>
        <span>4G ●●●○ 24%</span>
      </div>

      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)" }}>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg">🍦</div>
          <div>
            <div className="text-white font-bold text-sm">Olá, Nânio! 👋</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1 text-[10px] text-white/80">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span> Aberto
              </span>
              <span className="text-[10px] text-white/60">🕐 30-45 min</span>
              <span className="text-[10px] text-yellow-300">★ 4.8</span>
            </div>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold">N</div>
      </div>

      {/* Pedido em andamento (NOVO) */}
      <div className="mx-4 mt-3 p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
          <Truck className="h-4 w-4 text-blue-600" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold text-blue-900">Pedido #482 saiu para entrega</div>
          <div className="text-[10px] text-blue-600">Previsão: 12:35</div>
        </div>
        <ChevronRight className="h-4 w-4 text-blue-400" />
      </div>

      {/* Barra progresso frete grátis (NOVO) */}
      <div className="mx-4 mt-3 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium text-amber-800">Faltam R$ 12,00 para frete grátis! 🎉</span>
          <span className="text-[10px] text-amber-600">R$ 33,00 / R$ 45,00</span>
        </div>
        <div className="w-full h-2 bg-amber-200 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all" style={{ width: "73%" }}></div>
        </div>
      </div>

      {/* Destaque */}
      <div className="mx-4 mt-3 relative rounded-2xl overflow-hidden" style={{ minHeight: "180px" }}>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-700"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
        <div className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
          <TrendingUp className="h-3 w-3" /> TOP
        </div>
        <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-1 rounded-full">
          🔥 238 pedidos/semana
        </div>
        <div className="relative z-10 flex flex-col justify-end p-5" style={{ minHeight: "180px" }}>
          <h2 className="text-xl font-black text-white uppercase">MILKSHAKE FIT</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-white/60 text-xs">Preparo: ~15 min</span>
            <span className="text-white/40">•</span>
            <span className="text-yellow-300 text-xs">★ 4.9 (89)</span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div>
              <p className="text-lg font-bold text-white">R$ 19,90</p>
              <p className="text-[10px] text-white/60">ou 3x de R$ 6,63</p>
            </div>
            <button className="px-4 py-2 rounded-full text-sm font-bold text-white shadow-lg bg-white/20 backdrop-blur-sm">
              Comprar Agora
            </button>
          </div>
        </div>
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
          <div className="w-5 h-1.5 rounded-full bg-white"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-white/40"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-white/40"></div>
        </div>
      </div>

      {/* Pedir novamente (NOVO) */}
      <div className="mx-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
            <Repeat className="h-4 w-4 text-blue-500" /> Pedir novamente
          </h3>
          <span className="text-[10px] text-zinc-400">Último pedido: 2 dias</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {["Casquinha Dupla", "Sundae Clássico"].map((name, i) => (
            <div key={i} className="flex-shrink-0 w-[140px] p-2 bg-zinc-50 rounded-xl border border-zinc-100">
              <div className="w-full h-16 bg-zinc-200 rounded-lg mb-2 flex items-center justify-center text-2xl">🍦</div>
              <div className="text-[11px] font-medium text-zinc-800 truncate">{name}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs font-bold text-zinc-900">R$ {(10 + i * 5).toFixed(2).replace(".", ",")}</span>
                <button className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">+</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Promoções */}
      <div className="mx-4 mt-4">
        <h3 className="text-sm font-bold text-zinc-900 mb-2 flex items-center gap-1.5">
          <BadgePercent className="h-4 w-4 text-green-500" /> Promoções
        </h3>
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {[{ name: "Sundae Clássico", old: "R$ 19,90", price: "R$ 15,00", off: "25% OFF" }].map((item, i) => (
            <div key={i} className="flex-shrink-0 w-[160px] bg-white rounded-xl border border-zinc-100 overflow-hidden shadow-sm">
              <div className="h-20 bg-zinc-200 relative flex items-center justify-center text-3xl">
                🍨
                <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">{item.off}</div>
              </div>
              <div className="p-2">
                <div className="text-[11px] font-medium text-zinc-800 truncate">{item.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] line-through text-zinc-400">{item.old}</span>
                  <span className="text-xs font-bold text-green-600">{item.price}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="mx-4 mt-4 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {["Todos", "Sorvetes", "Picolés", "Fits"].map((cat, i) => (
          <button key={i} className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium border ${i === 0 ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200"}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Grid produtos */}
      <div className="mx-4 mt-3 grid grid-cols-2 gap-2 pb-20">
        {[{ name: "Casquinha Dupla", price: "R$ 10,00", off: "28% OFF", stock: "Últimas 3!" }, { name: "Sorvete Pote 500g", price: "R$ 22,00", off: "9% OFF" }].map((item, i) => (
          <div key={i} className="bg-white rounded-xl border border-zinc-100 overflow-hidden shadow-sm">
            <div className="h-28 bg-zinc-200 relative flex items-center justify-center text-4xl">
              {i === 0 ? "🍨" : "🍦"}
              <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">{item.off}</div>
              {item.stock && (
                <div className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                  <Timer className="h-2.5 w-2.5" /> {item.stock}
                </div>
              )}
            </div>
            <div className="p-2.5">
              <div className="text-xs font-semibold text-zinc-800 truncate">{item.name}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm font-bold text-zinc-900">{item.price}</span>
                <button className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs shadow-md">+</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 w-[390px] bg-white border-t border-zinc-200 flex items-center justify-around py-2 px-4" style={{ paddingBottom: "env(safe-area-inset-bottom, 8px)" }}>
        {[{ icon: "🔍", label: "Buscar" }, { icon: "🛍️", label: "Sacola", badge: 2 }, { icon: "📋", label: "Pedidos" }, { icon: "👤", label: "Perfil" }].map((item, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5 relative">
            <span className="text-lg">{item.icon}</span>
            <span className="text-[10px] text-zinc-500">{item.label}</span>
            {item.badge && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">{item.badge}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function MockProductDetail() {
  const [qty, setQty] = useState(1)
  const [flavors1, setFlavors1] = useState<string[]>([])
  const [flavors2, setFlavors2] = useState<string[]>([])

  return (
    <div className="max-w-[390px] mx-auto bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-zinc-200 relative">
      {/* Status bar */}
      <div className="bg-zinc-900 text-white text-[10px] px-6 py-1.5 flex justify-between items-center">
        <span>11:56</span>
        <span>4G ●●●○ 24%</span>
      </div>

      {/* Image */}
      <div className="relative h-48 bg-gradient-to-br from-emerald-400 to-teal-600">
        <div className="absolute inset-0 flex items-center justify-center text-7xl">🍨</div>
        <button className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white">
          <X className="h-4 w-4" />
        </button>
        <button className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white">
          <Heart className="h-4 w-4" />
        </button>
        {/* Share */}
        <button className="absolute top-3 left-14 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white">
          <Share2 className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4">
        {/* Header info */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">Casquinha Dupla</h1>
            <p className="text-sm text-zinc-500 mt-1">2 bolas de sorvete artesanal na casquinha, escolha seus sabores</p>
          </div>
        </div>

        {/* Rating + tempo (NOVO) */}
        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
            <span className="text-xs font-bold text-amber-700">4.7</span>
            <span className="text-[10px] text-amber-600">(127)</span>
          </div>
          <div className="flex items-center gap-1 text-zinc-500">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-xs">~15 min</span>
          </div>
          <div className="flex items-center gap-1 text-zinc-500">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-xs">312 pedidos</span>
          </div>
        </div>

        {/* Preço */}
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-sm line-through text-zinc-400">R$ 13,90</span>
          <span className="text-2xl font-black text-green-600">R$ 10,00</span>
        </div>
        <p className="text-[10px] text-zinc-400 mt-0.5">ou 3x de R$ 3,33 sem juros</p>

        {/* Quantidade */}
        <div className="mt-4">
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Quantidade</div>
          <div className="flex items-center gap-4">
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-10 rounded-full border-2 border-zinc-200 flex items-center justify-center text-zinc-400 active:bg-zinc-100">
              <Minus className="h-4 w-4" />
            </button>
            <span className="text-xl font-bold text-zinc-900 w-8 text-center">{qty}</span>
            <button onClick={() => setQty(qty + 1)} className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-lg active:bg-blue-600">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Sabor 1 */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-zinc-900">1° Sabor</h3>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">OBRIGATÓRIO</span>
          </div>
          <div className="border border-zinc-200 rounded-xl overflow-hidden">
            {["Chocolate", "Baunilha", "Morango", "Pistache", "Cookies", { name: "Nutella", extra: "+R$ 2,00" }].map((f, i) => (
              <label key={i} className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-100 last:border-0 cursor-pointer active:bg-zinc-50">
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full border-2 ${flavors1.includes(typeof f === 'string' ? f : f.name) ? "border-blue-500 bg-blue-500" : "border-zinc-300"}`}>
                    {flavors1.includes(typeof f === 'string' ? f : f.name) && <Check className="h-3 w-3 text-white m-auto" />}
                  </div>
                  <span className="text-sm text-zinc-700">{typeof f === 'string' ? f : f.name}</span>
                </div>
                {typeof f !== 'string' && <span className="text-xs font-bold text-blue-600">{f.extra}</span>}
              </label>
            ))}
          </div>
        </div>

        {/* Frequently bought together (NOVO) */}
        <div className="mt-5 p-3 bg-amber-50 rounded-xl border border-amber-200">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-bold text-amber-800">Quem pediu, também pediu</span>
          </div>
          <div className="flex gap-2">
            {[{ name: "Calda Chocolate", price: "R$ 3,00" }, { name: "Whipped Cream", price: "R$ 2,00" }].map((item, i) => (
              <div key={i} className="flex-1 p-2 bg-white rounded-lg border border-amber-100 flex items-center gap-2">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-sm">🍫</div>
                <div>
                  <div className="text-[10px] font-medium text-zinc-800">{item.name}</div>
                  <div className="text-[10px] font-bold text-amber-700">{item.price}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom button */}
      <div className="sticky bottom-0 p-4 bg-white border-t border-zinc-100" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
        <button className="w-full py-3.5 rounded-2xl bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:bg-blue-600">
          <Plus className="h-4 w-4" /> Adicionar · R$ {(10 * qty).toFixed(2).replace(".", ",")}
        </button>
      </div>
    </div>
  )
}

function MockCartPage() {
  return (
    <div className="max-w-[390px] mx-auto bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-zinc-200 relative">
      {/* Status bar */}
      <div className="bg-zinc-900 text-white text-[10px] px-6 py-1.5 flex justify-between items-center">
        <span>11:57</span>
        <span>4G ●●●○ 23%</span>
      </div>

      <div className="px-4 py-3 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm">🍦</div>
          <div>
            <div className="text-white font-bold text-xs">Olá, Nânio! 👋</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1 text-[9px] text-white/80">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span> Aberto
              </span>
              <span className="text-[9px] text-white/60">🕐 30-45 min</span>
            </div>
          </div>
        </div>
      </div>

      {/* Timer carrinho (NOVO) */}
      <div className="mx-4 mt-3 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
          <Timer className="h-4 w-4 text-red-600 animate-pulse" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold text-red-800">Seu carrinho reserva por</div>
          <div className="text-lg font-black text-red-600">09:42</div>
        </div>
      </div>

      {/* Entrega/Retirada */}
      <div className="mx-4 mt-3 flex gap-2">
        <button className="flex-1 py-2.5 rounded-xl bg-zinc-900 text-white text-xs font-medium flex items-center justify-center gap-1.5">
          <Truck className="h-3.5 w-3.5" /> Entrega
        </button>
        <button className="flex-1 py-2.5 rounded-xl bg-zinc-100 text-zinc-500 text-xs font-medium flex items-center justify-center gap-1.5 border border-zinc-200">
          <MapPin className="h-3.5 w-3.5" /> Retirada
        </button>
      </div>

      {/* Barra frete grátis */}
      <div className="mx-4 mt-3 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium text-amber-800">Faltam R$ 12,00 para frete grátis! 🎉</span>
        </div>
        <div className="w-full h-2 bg-amber-200 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full" style={{ width: "73%" }}></div>
        </div>
        <div className="text-[9px] text-amber-600 mt-1">Taxa de entrega: R$ 5,00</div>
      </div>

      {/* Itens */}
      <div className="mx-4 mt-3">
        <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-zinc-200 rounded-xl flex items-center justify-center text-xl">🍨</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-zinc-800 truncate">Casquinha Dupla</div>
              <div className="text-[10px] text-zinc-500">Pistache</div>
              <div className="text-xs font-bold text-zinc-900 mt-0.5">R$ 10,00</div>
            </div>
            <div className="flex items-center gap-2">
              <button className="w-6 h-6 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-400"><Minus className="h-3 w-3" /></button>
              <span className="text-sm font-bold text-zinc-900 w-5 text-center">2</span>
              <button className="w-6 h-6 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-400"><Plus className="h-3 w-3" /></button>
            </div>
            <button className="text-zinc-300"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <button className="w-full mt-2 text-xs text-red-500 font-medium py-1">Esvaziar carrinho</button>
      </div>

      {/* Economia (NOVO) */}
      <div className="mx-4 mt-3 p-3 rounded-xl bg-green-50 border border-green-200 flex items-center gap-2">
        <Gift className="h-4 w-4 text-green-600" />
        <span className="text-xs font-semibold text-green-800">Você está economizando R$ 7,80 nesta compra!</span>
      </div>

      {/* Cupom */}
      <div className="mx-4 mt-3 flex gap-2">
        <input placeholder="Cupom de desconto" className="flex-1 px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-700 placeholder:text-zinc-400" />
        <button className="px-4 py-2.5 rounded-xl bg-zinc-100 border border-zinc-200 text-xs font-medium text-zinc-600">Aplicar</button>
      </div>

      {/* Cashback */}
      <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">⭐</span>
          <div>
            <div className="text-xs font-semibold text-amber-800">Usar meu cashback</div>
            <div className="text-[10px] text-amber-600">822 cash = R$ 822,00</div>
          </div>
        </div>
        <div className="w-5 h-5 rounded-full border-2 border-zinc-300"></div>
      </div>

      {/* Complete o pedido (NOVO) */}
      <div className="mx-4 mt-3 p-3 rounded-xl bg-blue-50 border border-blue-200">
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="h-4 w-4 text-blue-500" />
          <span className="text-xs font-bold text-blue-800">Complete seu pedido</span>
        </div>
        <div className="flex gap-2">
          {[{ name: "Calda", price: "+R$ 3" }, { name: "Bombom", price: "+R$ 2" }].map((item, i) => (
            <div key={i} className="flex-1 p-2 bg-white rounded-lg border border-blue-100 text-center">
              <div className="text-[10px] font-medium text-zinc-700">{item.name}</div>
              <div className="text-[10px] font-bold text-blue-600">{item.price}</div>
              <button className="mt-1 w-5 h-5 mx-auto rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">+</button>
            </div>
          ))}
        </div>
      </div>

      {/* Estimativa entrega (NOVO) */}
      <div className="mx-4 mt-3 flex items-center gap-2 text-zinc-500">
        <Clock className="h-3.5 w-3.5" />
        <span className="text-[11px]">Previsão de entrega: <strong className="text-zinc-800">35-45 min</strong></span>
      </div>

      {/* Resumo */}
      <div className="mx-4 mt-3 space-y-1">
        <div className="flex justify-between text-xs text-zinc-600">
          <span>Subtotal</span><span className="font-medium">R$ 20,00</span>
        </div>
        <div className="flex justify-between text-xs text-zinc-600">
          <span>Taxa de entrega</span><span className="font-medium">R$ 5,00</span>
        </div>
        <div className="flex justify-between text-xs text-green-600 font-medium">
          <span>Desconto promo</span><span>- R$ 7,80</span>
        </div>
        <div className="border-t border-zinc-200 pt-2 mt-2 flex justify-between">
          <span className="text-sm font-bold text-zinc-900">Total</span>
          <span className="text-lg font-black text-zinc-900">R$ 17,20</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="mx-4 mt-4 space-y-2 pb-6">
        <button className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg" style={{ background: "linear-gradient(135deg, #06b6d4, #10b981)" }}>
          <ShoppingBag className="h-4 w-4" /> Finalizar pedido
        </button>
        <button className="w-full py-2.5 text-zinc-500 text-xs font-medium flex items-center justify-center gap-1">
          ← Continuar comprando
        </button>
      </div>
    </div>
  )
}

function MockCheckoutPage() {
  return (
    <div className="max-w-[390px] mx-auto bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-zinc-200 relative">
      {/* Status bar */}
      <div className="bg-zinc-900 text-white text-[10px] px-6 py-1.5 flex justify-between items-center">
        <span>11:57</span>
        <span>4G ●●●○ 23%</span>
      </div>

      {/* Progress bar (NOVO) */}
      <div className="px-4 pt-3">
        <div className="flex items-center gap-1">
          {[1, 2, 3].map((step, i) => (
            <div key={i} className="flex-1 flex items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i <= 2 ? "bg-blue-500 text-white" : "bg-zinc-200 text-zinc-400"}`}>
                {i < 2 ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              {i < 2 && <div className={`flex-1 h-0.5 rounded ${i < 2 ? "bg-blue-500" : "bg-zinc-200"}`}></div>}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-blue-600 font-medium">Carrinho</span>
          <span className="text-[9px] text-blue-600 font-medium">Pagamento</span>
          <span className="text-[9px] text-zinc-400">Confirmação</span>
        </div>
      </div>

      {/* Trust signal (NOVO) */}
      <div className="mx-4 mt-3 p-2.5 rounded-xl bg-green-50 border border-green-200 flex items-center gap-2">
        <Shield className="h-4 w-4 text-green-600" />
        <span className="text-[11px] font-medium text-green-800">Compra 100% segura e protegida</span>
      </div>

      <div className="px-4 py-3">
        <h2 className="text-lg font-bold text-zinc-900">Finalizar pedido</h2>

        {/* Endereço */}
        <div className="mt-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-zinc-500" />
              <div>
                <div className="text-xs font-medium text-zinc-800">Rua SZ - 005, 580</div>
                <div className="text-[10px] text-zinc-500">São Luiz, Brusque - SC</div>
              </div>
            </div>
            <button className="text-[10px] font-medium text-blue-600">Alterar</button>
          </div>
        </div>

        {/* Estimativa final (NOVO) */}
        <div className="mt-3 p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <Timer className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <div className="text-xs font-semibold text-blue-800">Previsão de entrega</div>
            <div className="text-sm font-bold text-blue-600">35-45 minutos</div>
          </div>
        </div>

        {/* Observações */}
        <div className="mt-4">
          <div className="text-xs font-semibold text-zinc-700 mb-1.5">Observações</div>
          <textarea placeholder="Ex: Sem cebola, ponto da carne..." className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-700 placeholder:text-zinc-400 resize-none h-16" />
        </div>

        {/* Pagamento */}
        <div className="mt-4">
          <div className="text-xs font-semibold text-zinc-700 mb-2">Pagamento</div>
          <div className="grid grid-cols-3 gap-2">
            <button className="py-2.5 rounded-xl bg-blue-50 border-2 border-blue-500 text-xs font-medium text-blue-700 flex flex-col items-center gap-1">
              <QrCode className="h-4 w-4" /> Pix
            </button>
            <button className="py-2.5 rounded-xl bg-zinc-50 border-2 border-zinc-200 text-xs font-medium text-zinc-600 flex flex-col items-center gap-1">
              <CreditCard className="h-4 w-4" /> Cartão
            </button>
            <button className="py-2.5 rounded-xl bg-zinc-50 border-2 border-zinc-200 text-xs font-medium text-zinc-600 flex flex-col items-center gap-1">
              <Banknote className="h-4 w-4" /> Dinheiro
            </button>
          </div>
        </div>

        {/* Resumo com miniaturas (NOVO) */}
        <div className="mt-4 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
          <div className="text-xs font-semibold text-zinc-700 mb-2">Resumo do pedido</div>
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-200">
            <div className="w-10 h-10 bg-zinc-200 rounded-lg flex items-center justify-center text-lg">🍨</div>
            <div className="flex-1">
              <div className="text-[11px] font-medium text-zinc-800">Casquinha Dupla x2</div>
              <div className="text-[10px] text-zinc-500">Pistache</div>
            </div>
            <span className="text-xs font-bold text-zinc-900">R$ 20,00</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-zinc-600">
              <span>Subtotal</span><span>R$ 20,00</span>
            </div>
            <div className="flex justify-between text-[11px] text-zinc-600">
              <span>Taxa de entrega</span><span>R$ 5,00</span>
            </div>
            <div className="border-t border-zinc-200 pt-1 flex justify-between">
              <span className="text-xs font-bold text-zinc-900">Total</span>
              <span className="text-sm font-black text-blue-600">R$ 25,00</span>
            </div>
          </div>
        </div>
      </div>

      {/* Botão confirmar com cadeado (NOVO) */}
      <div className="sticky bottom-0 p-4 bg-white border-t border-zinc-100" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
        <button className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg" style={{ background: "linear-gradient(135deg, #06b6d4, #10b981)" }}>
          <Shield className="h-4 w-4" /> Confirmar pedido 🔒
        </button>
      </div>
    </div>
  )
}

function MockConfirmationPage() {
  return (
    <div className="max-w-[390px] mx-auto bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-zinc-200 relative min-h-[700px]">
      {/* Status bar */}
      <div className="bg-zinc-900 text-white text-[10px] px-6 py-1.5 flex justify-between items-center">
        <span>12:01</span>
        <span>4G ●●●○ 23%</span>
      </div>

      {/* Confetti background (NOVO) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full animate-bounce"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 60}%`,
              backgroundColor: ["#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#8b5cf6"][i % 5],
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${1 + Math.random()}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center px-6 py-12">
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-3xl shadow-lg mb-4">
          🍦
        </div>

        {/* Título com animação (NOVO) */}
        <h1 className="text-2xl font-black text-zinc-900 text-center">Pedido enviado! 🎉</h1>

        {/* Estimativa de entrega (NOVO) */}
        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 w-full">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Timer className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-bold text-blue-800">Previsão de entrega</span>
          </div>
          <div className="text-3xl font-black text-blue-600 text-center">38 min</div>
          <div className="text-[10px] text-blue-500 text-center mt-1">Chega approx. às 12:39</div>
        </div>

        {/* Tracker visual (NOVO) */}
        <div className="mt-5 w-full">
          <div className="flex items-center gap-0">
            {[
              { label: "Confirmado", done: true, icon: <Check className="h-3 w-3" /> },
              { label: "Preparando", done: true, icon: <Check className="h-3 w-3" /> },
              { label: "Saiu p/ entrega", done: false, icon: <Truck className="h-3 w-3" /> },
              { label: "Entregue", done: false, icon: <MapPin className="h-3 w-3" /> },
            ].map((step, i) => (
              <div key={i} className="flex-1 flex flex-col items-center relative">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white ${step.done ? "bg-green-500" : "bg-zinc-300"}`}>
                  {step.icon}
                </div>
                <span className="text-[8px] text-zinc-500 mt-1 text-center">{step.label}</span>
                {i < 3 && (
                  <div className={`absolute top-3.5 left-1/2 w-full h-0.5 ${step.done ? "bg-green-500" : "bg-zinc-200"}`}></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Cashback (NOVO) */}
        <div className="mt-6 w-full p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-bold text-amber-800">Cashback ganho</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-black text-amber-600">+5 cash</div>
              <div className="text-[10px] text-amber-500">= R$ 5,00 para usar</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-amber-600">Próximo cupom:</div>
              <div className="text-xs font-bold text-amber-700">Faltam R$ 28</div>
              <div className="w-20 h-1.5 bg-amber-200 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: "45%" }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Botões */}
        <div className="mt-6 w-full space-y-2">
          <button className="w-full py-3 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg" style={{ background: "linear-gradient(135deg, #06b6d4, #10b981)" }}>
            <ExternalLink className="h-4 w-4" /> Acompanhar pedido
          </button>
          <button className="w-full py-3 rounded-2xl bg-zinc-100 text-zinc-700 font-bold text-sm flex items-center justify-center gap-2 border border-zinc-200">
            <Repeat className="h-4 w-4" /> Pedir novamente
          </button>
          <button className="w-full py-2 text-zinc-400 text-xs font-medium">
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function UIReviewPage() {
  const [activeTab, setActiveTab] = useState<"improvements" | "preview">("improvements")
  const [previewScreen, setPreviewScreen] = useState(0)

  const screens = [
    { label: "Menu", component: <MockMenuPage /> },
    { label: "Produto", component: <MockProductDetail /> },
    { label: "Carrinho", component: <MockCartPage /> },
    { label: "Checkout", component: <MockCheckoutPage /> },
    { label: "Confirmação", component: <MockConfirmationPage /> },
  ]

  return (
    <div className="min-h-screen bg-zinc-100">
      {/* Header */}
      <div className="bg-zinc-900 text-white px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-2xl">
              🍦
            </div>
            <div>
              <h1 className="text-2xl font-black">UI/UX Review</h1>
              <p className="text-sm text-zinc-400">Geladolate Sorveteria — Análise de Melhorias</p>
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-3 max-w-xl">
            Análise completa das 5 telas do fluxo de pedido com melhorias baseadas em psicologia de conversão, 
            design de atração, gatilhos de desejo e técnicas de redução de fricção.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-6 mt-6">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("improvements")}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === "improvements" ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 border border-zinc-200"}`}
          >
            📋 Lista de Melhorias
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === "preview" ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 border border-zinc-200"}`}
          >
            👁️ Preview das Telas
          </button>
        </div>

        {activeTab === "improvements" ? (
          <div className="pb-12">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="bg-white rounded-2xl p-4 border border-zinc-200 text-center">
                <div className="text-3xl font-black text-blue-600">30</div>
                <div className="text-xs text-zinc-500 mt-1">Melhorias identificadas</div>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-zinc-200 text-center">
                <div className="text-3xl font-black text-emerald-600">5</div>
                <div className="text-xs text-zinc-500 mt-1">Telas analisadas</div>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-zinc-200 text-center">
                <div className="text-3xl font-black text-amber-600">+35%</div>
                <div className="text-xs text-zinc-500 mt-1">Conversão estimada</div>
              </div>
            </div>

            {/* Improvement cards */}
            {improvements.map((data) => (
              <BeforeAfterCard key={data.id} data={data} />
            ))}

            {/* Summary */}
            <div className="mt-8 p-6 bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl text-white">
              <h3 className="text-lg font-bold mb-3">🎯 Resumo das Prioridades</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { priority: "Alta", items: ["Barra frete grátis", "Timer carrinho", "Trust signals", "Tracker visual"], color: "red" },
                  { priority: "Média", items: ["Pedir novamente", "Cross-sell", "Reviews", "Cashback progress"], color: "amber" },
                  { priority: "Baixa", items: ["Skeleton loading", "Compartilhar", "Favoritar", "Animações"], color: "green" },
                  { priority: "Quick Wins", items: ["Preço parcelado", "Tempo preparo", "Economia display", "Seal segurança"], color: "blue" },
                ].map((cat, i) => (
                  <div key={i} className="bg-white/10 rounded-xl p-3">
                    <div className="text-xs font-bold text-white/80 mb-2">{cat.priority}</div>
                    {cat.items.map((item, j) => (
                      <div key={j} className="text-[11px] text-white/60 flex items-center gap-1.5 mb-1">
                        <div className={`w-1.5 h-1.5 rounded-full bg-${cat.color}-400`}></div>
                        {item}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="pb-12">
            {/* Screen selector */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
              {screens.map((screen, i) => (
                <button
                  key={i}
                  onClick={() => setPreviewScreen(i)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-medium transition-all ${previewScreen === i ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 border border-zinc-200"}`}
                >
                  {screen.label}
                </button>
              ))}
            </div>

            {/* Preview */}
            <div className="flex justify-center">
              {screens[previewScreen].component}
            </div>

            {/* Annotations */}
            <div className="mt-6 max-w-[390px] mx-auto space-y-2">
              {previewScreen === 0 && (
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="text-xs font-bold text-blue-800 mb-1">Melhorias nesta tela:</div>
                  <ul className="text-[11px] text-blue-700 space-y-1">
                    <li>• Barra de progresso frete grátis (psicologia de completude)</li>
                    <li>• Badge "238 pedidos/semana" (social proof)</li>
                    <li>• Seção "Pedir novamente" (redução de fricção)</li>
                    <li>• Status do pedido em andamento (transparência)</li>
                    <li>• "Últimas 3!" badge (escassez)</li>
                    <li>• Preço parcelado visível (âncora de preço)</li>
                  </ul>
                </div>
              )}
              {previewScreen === 1 && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div className="text-xs font-bold text-emerald-800 mb-1">Melhorias nesta tela:</div>
                  <ul className="text-[11px] text-emerald-700 space-y-1">
                    <li>• Avaliações 4.7 (127 reviews) — social proof forte</li>
                    <li>• Botão favoritar (coração) — engajamento emocional</li>
                    <li>• Tempo de preparo estimado — gerencia expectativa</li>
                    <li>• "Quem pediu, também pediu" — cross-sell</li>
                    <li>• Preço parcelado — reduz resistência</li>
                  </ul>
                </div>
              )}
              {previewScreen === 2 && (
                <div className="p-3 bg-orange-50 rounded-xl border border-orange-200">
                  <div className="text-xs font-bold text-orange-800 mb-1">Melhorias nesta tela:</div>
                  <ul className="text-[11px] text-orange-700 space-y-1">
                    <li>• Timer "reserva por 09:42" — urgência artificial</li>
                    <li>• "Economizando R$ 7,80" — reforço de valor</li>
                    <li>• "Complete seu pedido" — aumenta ticket médio</li>
                    <li>• Barra frete grátis visível — gamificação</li>
                    <li>• Previsão de entrega no carrinho — transparência</li>
                  </ul>
                </div>
              )}
              {previewScreen === 3 && (
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
                  <div className="text-xs font-bold text-purple-800 mb-1">Melhorias nesta tela:</div>
                  <ul className="text-[11px] text-purple-700 space-y-1">
                    <li>• Selo "Compra 100% segura" — trust signal</li>
                    <li>• Barra de progresso (Carrinho → Pagamento → Confirmação)</li>
                    <li>• Estimativa de entrega final — manage expectativa</li>
                    <li>• Resumo com miniaturas — confirma visual</li>
                    <li>• Botão "Confirmar pedido 🔒" — segurança no CTA</li>
                  </ul>
                </div>
              )}
              {previewScreen === 4 && (
                <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-200">
                  <div className="text-xs font-bold text-yellow-800 mb-1">Melhorias nesta tela:</div>
                  <ul className="text-[11px] text-yellow-700 space-y-1">
                    <li>• Confetti animado — celebração pós-compra</li>
                    <li>• Timer regressivo de entrega — reduz ansiedade</li>
                    <li>• Tracker visual em steps — transparência total</li>
                    <li>• Cashback com progresso — gamificação de fidelidade</li>
                    <li>• Botão "Pedir novamente" — facilita recompra</li>
                    <li>• "Compartilhar pedido" — viralidade orgânica</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
