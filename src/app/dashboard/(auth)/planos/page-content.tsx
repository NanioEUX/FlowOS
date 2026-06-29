"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, Clock, CreditCard, Zap, Building2, Star } from "lucide-react"
import { fetchAuth } from "@/lib/fetch-auth"

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: 49,
    period: "/mês",
    description: "Para quem está começando",
    features: [
      "Cardápio digital personalizado",
      "Pedidos pelo site",
      "Painel de pedidos em tempo real",
      "Frente de caixa (POS)",
      "Controle de estoque básico",
      "Suporte por e-mail",
    ],
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 99,
    period: "/mês",
    description: "Para estabelecimentos em crescimento",
    features: [
      "Tudo do Starter",
      "Entregas com motoboy",
      "Cupons de desconto",
      "Relatórios financeiros",
      "Programa de fidelidade",
      "Múltiplos atendentes",
      "Suporte prioritário",
    ],
    highlighted: true,
    badge: "Mais popular",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 199,
    period: "/mês",
    description: "Para redes e alta demanda",
    features: [
      "Tudo do Pro",
      "Múltiplas filiais",
      "API de integração",
      "Relatórios avançados",
      "Gerente de conta dedicado",
      "SLA garantido",
      "Personalização completa",
    ],
    highlighted: false,
  },
]

export default function PlanosPageContent() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState<string | null>(null)
  const [establishment, setEstablishment] = useState<any>(null)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const stored = localStorage.getItem("pedefacil-user")
    if (!stored) {
      router.replace("/login")
      return
    }
    const userData = JSON.parse(stored)
    setUser(userData)

    fetchAuth(`/api/establishments?id=${userData.establishmentId}`)
      .then((r) => r.json())
      .then((data) => {
        setEstablishment(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [router])

  async function subscribe(planId: string) {
    setSubscribing(planId)
    try {
      const res = await fetch("/api/subscription/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          establishmentId: user.establishmentId,
          plan: planId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || "Erro ao processar assinatura")
        setSubscribing(null)
        return
      }

      if (data.paymentUrl) {
        window.open(data.paymentUrl, "_blank")
      }

      if (data.paid) {
        alert("Assinatura ativada com sucesso!")
        router.push("/dashboard/home")
      }
    } catch {
      alert("Erro de conexão")
    } finally {
      setSubscribing(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-flow-blue" />
      </div>
    )
  }

  const isExpired = establishment?.subscriptionStatus === "expired" ||
    (establishment?.subscriptionStatus === "trial" && establishment?.trialEndsAt && new Date(establishment.trialEndsAt) < new Date())

  const trialEnds = establishment?.trialEndsAt ? new Date(establishment.trialEndsAt) : null
  const daysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0

  const isActive = establishment?.subscriptionStatus === "active"
  const currentPlan = plans.find((p) => p.id === establishment?.subscriptionPlan)

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-8 text-center">
        {isExpired ? (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/100/10">
              <CreditCard className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-flow-white">Assinatura expirada</h1>
            <p className="mt-2 text-zinc-500">
              Seu período de teste ou assinatura expirou. Escolha um plano para continuar usando o FlowOS.
            </p>
          </>
        ) : isActive ? (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-flow-green/10">
              <Check className="h-8 w-8 text-flow-blue" />
            </div>
            <h1 className="text-2xl font-bold text-flow-white">Plano {currentPlan?.name || "Starter"}</h1>
            <p className="mt-2 text-zinc-500">
              Sua assinatura está ativa.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/100/10">
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold text-flow-white">Seu período de teste</h1>
            <p className="mt-2 text-zinc-500">
              {daysLeft > 0
                ? `Faltam ${daysLeft} dia${daysLeft > 1 ? "s" : ""} do seu teste grátis. Escolha um plano para continuar após o término.`
                : "Seu período de teste acabou. Escolha um plano para continuar."
              }
            </p>
          </>
        )}
      </div>

      {/* Subscription Details (when active) */}
      {isActive && (
        <div className="mb-8 rounded-2xl border border-white/[.06] bg-flow-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-flow-white">Detalhes da assinatura</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-white/[.03] p-4">
              <p className="text-xs font-medium text-zinc-500">Plano</p>
              <p className="mt-1 text-lg font-bold text-flow-white">{currentPlan?.name || "Starter"}</p>
              <p className="text-sm text-zinc-400">R${currentPlan?.price || 49}/mês</p>
            </div>
            <div className="rounded-xl bg-white/[.03] p-4">
              <p className="text-xs font-medium text-zinc-500">Status</p>
              <p className="mt-1 text-lg font-bold text-flow-blue">Ativo</p>
              <p className="text-sm text-zinc-400">Pagamento em dia</p>
            </div>
            <div className="rounded-xl bg-white/[.03] p-4">
              <p className="text-xs font-medium text-zinc-500">Data de aquisição</p>
              <p className="mt-1 text-lg font-bold text-flow-white">
                {establishment?.trialStartsAt
                  ? new Date(establishment.trialStartsAt).toLocaleDateString("pt-BR")
                  : "—"
                }
              </p>
              <p className="text-sm text-zinc-400">Início do trial</p>
            </div>
            <div className="rounded-xl bg-white/[.03] p-4">
              <p className="text-xs font-medium text-zinc-500">Próxima cobrança</p>
              <p className="mt-1 text-lg font-bold text-flow-white">
                {establishment?.nextPaymentAt
                  ? new Date(establishment.nextPaymentAt).toLocaleDateString("pt-BR")
                  : "—"
                }
              </p>
              <p className="text-sm text-zinc-400">Cobrança mensal</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => alert("Em breve: alteração de forma de pagamento via Asaas")}
              className="flex items-center gap-2 rounded-lg border border-white/[.06] px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[.05]"
            >
              <CreditCard className="h-4 w-4" />
              Alterar forma de pagamento
            </button>
            <button
              onClick={() => alert("Em breve: acesso ao portal de faturas")}
              className="flex items-center gap-2 rounded-lg border border-white/[.06] px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[.05]"
            >
              <Clock className="h-4 w-4" />
              Ver histórico de faturas
            </button>
          </div>
        </div>
      )}

      {/* Trial Details (when in trial) */}
      {!isActive && !isExpired && (
        <div className="mb-8 rounded-2xl border border-amber-500/20 bg-amber-500/100/[0.03] p-6">
          <h2 className="mb-4 text-lg font-semibold text-flow-white">Detalhes do período de teste</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-flow-card p-4">
              <p className="text-xs font-medium text-zinc-500">Status</p>
              <p className="mt-1 text-lg font-bold text-amber-400">Teste grátis</p>
              <p className="text-sm text-zinc-400">{daysLeft} dia{daysLeft !== 1 ? "s" : ""} restante{daysLeft !== 1 ? "s" : ""}</p>
            </div>
            <div className="rounded-xl bg-flow-card p-4">
              <p className="text-xs font-medium text-zinc-500">Início</p>
              <p className="mt-1 text-lg font-bold text-flow-white">
                {establishment?.trialStartsAt
                  ? new Date(establishment.trialStartsAt).toLocaleDateString("pt-BR")
                  : "—"
                }
              </p>
            </div>
            <div className="rounded-xl bg-flow-card p-4">
              <p className="text-xs font-medium text-zinc-500">Término</p>
              <p className="mt-1 text-lg font-bold text-flow-white">
                {trialEnds
                  ? trialEnds.toLocaleDateString("pt-BR")
                  : "—"
                }
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-zinc-500">Escolha um plano abaixo para garantir acesso contínuo após o término do teste.</p>
        </div>
      )}

      {/* Plans */}
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrentPlan = establishment?.subscriptionPlan === plan.id && establishment?.subscriptionStatus === "active"
          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border-2 p-6 transition-all ${
                plan.highlighted
                  ? "border-flow-blue bg-flow-green/[0.03] shadow-lg shadow-green-500/10"
                  : "border-white/[.06] bg-flow-card hover:border-white/[.08]"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-flow-blue px-3 py-0.5 text-xs font-semibold text-white">
                  {plan.badge}
                </div>
              )}

              <div className="mb-4">
                <div className="flex items-center gap-2">
                  {plan.id === "starter" && <Zap className="h-5 w-5 text-flow-blue" />}
                  {plan.id === "pro" && <Star className="h-5 w-5 text-flow-blue" />}
                  {plan.id === "enterprise" && <Building2 className="h-5 w-5 text-flow-blue" />}
                  <h3 className="text-lg font-bold text-flow-white">{plan.name}</h3>
                </div>
                <p className="text-sm text-zinc-500">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold text-flow-white">R${plan.price}</span>
                <span className="text-sm text-zinc-500">{plan.period}</span>
              </div>

              <ul className="mb-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-zinc-400">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-flow-blue" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => subscribe(plan.id)}
                disabled={subscribing === plan.id || isCurrentPlan}
                className={`flex h-12 items-center justify-center rounded-xl text-sm font-semibold transition-all ${
                  isCurrentPlan
                    ? "bg-flow-blue/10 text-flow-blue cursor-default"
                    : plan.highlighted
                    ? "bg-flow-blue text-white hover:bg-green-700 shadow-lg shadow-green-600/20"
                    : "bg-zinc-900 text-white hover:bg-zinc-800"
                } disabled:opacity-50`}
              >
                {subscribing === plan.id ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isCurrentPlan ? (
                  "Plano atual"
                ) : (
                  "Assinar agora"
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Info */}
      <div className="mt-8 rounded-xl border border-white/[.06] bg-flow-card p-4 text-center">
        <p className="text-sm text-zinc-500">
          Pagamento processado com segurança via Asaas. Aceita Pix, cartão de crédito e boleto.
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          Cancele a qualquer momento. Sem multa ou fidelidade.
        </p>
      </div>
    </div>
  )
}
