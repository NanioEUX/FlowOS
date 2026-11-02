"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Eye, EyeOff, ChevronDown } from "lucide-react"
import { FlowOSLogo } from "@/components/flowos-logo"
import { slugify } from "@/lib/utils"
import Link from "next/link"

const categories = [
  { value: "restaurante", label: "Restaurante" },
  { value: "pizzaria", label: "Pizzaria" },
  { value: "hamburgueria", label: "Hamburgueria" },
  { value: "lanchonete", label: "Lanchonete" },
  { value: "padaria", label: "Padaria / Confeitaria" },
  { value: "sorveteria", label: "Sorveteria / Açaí" },
  { value: "petiscaria", label: "Petiscaria / Bar" },
  { value: "japonesa", label: "Comida Japonesa" },
  { value: "brasileira", label: "Comida Brasileira" },
  { value: "outro", label: "Outro" },
]

export default function CadastroPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [step, setStep] = useState<1 | 2>(1)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [form, setForm] = useState({
    name: "",
    ownerName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    category: "",
    address: "",
    termsAccepted: false,
    privacyAccepted: false,
  })

  const slug = slugify(form.name)

  function handleNextStep(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!form.email || !form.password) {
      setError("Preencha e-mail e senha")
      return
    }
    if (form.password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres")
      return
    }
    if (form.password !== form.confirmPassword) {
      setError("As senhas não coincidem")
      return
    }
    setStep(2)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      if (!form.termsAccepted || !form.privacyAccepted) {
        throw new Error("É necessário aceitar os Termos de Uso e a Política de Privacidade")
      }

      const res = await fetch("/api/establishments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          phone: form.phone.replace(/\D/g, ""),
          termsVersion: "2026-11-02",
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erro ao criar")
      }

      const data = await res.json()

      localStorage.setItem("pedefacil-user", JSON.stringify({
        id: data.establishment.id,
        name: data.establishment.name,
        email: data.establishment.email,
        role: "admin",
        permissions: ["admin"],
        establishmentId: data.establishment.id,
        establishment: data.establishment,
        token: data.token,
        refreshToken: data.refreshToken,
      }))

      router.push("/dashboard/home")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "input-flow w-full"
  const labelClass = "mb-2 block text-[11px] font-semibold uppercase tracking-[0.15em] text-flow-muted"

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-flow-bg px-5 py-12 overflow-hidden">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-flow-blue/[0.07] blur-[150px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-flow-cyan/[0.05] blur-[130px]" />
      </div>

      <div className="relative z-10 w-full max-w-[520px]">
        <div className="mb-10 text-center">
          <Link href="/" className="inline-block">
            <FlowOSLogo size={72} />
          </Link>
        </div>

        <div className="glass-card p-8 md:p-10">
          <div className="mb-8 text-center">
            <h1 className="text-[28px] font-bold tracking-[-0.04em] text-flow-white">Criar sua conta</h1>
            <p className="mt-2 text-[15px] text-flow-gray font-light">Seu cardápio online em 2 minutos</p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className={`h-1.5 w-12 rounded-full transition-colors ${step === 1 ? "bg-gradient-flow" : "bg-white/10"}`} />
              <div className={`h-1.5 w-12 rounded-full transition-colors ${step === 2 ? "bg-gradient-flow" : "bg-white/10"}`} />
            </div>
          </div>

          {step === 1 ? (
            <form onSubmit={handleNextStep} className="space-y-5">
              <div>
                <label htmlFor="cadastro-email" className={labelClass}>E-mail</label>
                <input
                  id="cadastro-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="cadastro-password" className={labelClass}>Senha</label>
                <div className="relative">
                  <input
                    id="cadastro-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="mín. 6 caracteres"
                    minLength={6}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    className={`${inputClass} pr-10`}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-0 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="cadastro-confirm" className={labelClass}>Confirmar senha</label>
                <div className="relative">
                  <input
                    id="cadastro-confirm"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Repita a senha"
                    minLength={6}
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    required
                    className={`${inputClass} pr-10`}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-0 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors">
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {form.confirmPassword && form.password !== form.confirmPassword && (
                  <p className="mt-1 text-[12px] text-red-400">As senhas não coincidem</p>
                )}
              </div>

              {error && (
                <div className="rounded-[10px] border border-red-500/20 bg-red-500/[0.06] p-3 text-[13px] text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn-primary flex h-[52px] w-full items-center justify-center text-[15px] font-semibold mt-2"
              >
                Próximo
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="cadastro-name" className={labelClass}>Nome do estabelecimento</label>
                <input
                  id="cadastro-name"
                  type="text"
                  placeholder="Ex: Pizzaria do João"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className={inputClass}
                />
                {form.name && (
                  <p className="mt-2 text-[12px] text-flow-muted">
                    Seu link: <span className="text-flow-blue">{slug}.flowos.com</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="cadastro-owner" className={labelClass}>Seu nome</label>
                <input
                  id="cadastro-owner"
                  type="text"
                  autoComplete="name"
                  placeholder="Como você se chama"
                  value={form.ownerName}
                  onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="cadastro-phone" className={labelClass}>WhatsApp (com DDD)</label>
                <input
                  id="cadastro-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(11) 99999-9999"
                  value={form.phone}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "").slice(0, 11)
                    let formatted = raw
                    if (raw.length > 2) formatted = `(${raw.slice(0, 2)}) ${raw.slice(2)}`
                    if (raw.length > 7) formatted = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`
                    setForm({ ...form, phone: formatted })
                  }}
                  required
                  className={inputClass}
                />
              </div>

              <div className="relative">
                <label htmlFor="cadastro-category" className={labelClass}>Categoria</label>
                <select
                  id="cadastro-category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  required
                  className="w-full border-0 border-b border-white/[0.15] bg-transparent pb-3 pr-8 text-[15px] text-white focus:border-[#FF6B35]/50 focus:outline-none transition-colors appearance-none"
                >
                  <option value="" className="bg-[#111] text-white/50">Selecione</option>
                  {categories.map((c) => (
                    <option key={c.value} value={c.value} className="bg-[#111] text-white">{c.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 top-[38px] h-4 w-4 text-white/40" />
              </div>

              <div>
                <label htmlFor="cadastro-address" className={labelClass}>Endereço (opcional)</label>
                <input
                  id="cadastro-address"
                  type="text"
                  autoComplete="street-address"
                  placeholder="Ex: Rua Augusta, 1500"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className={inputClass}
                />
              </div>

              {error && (
                <div className="rounded-[10px] border border-red-500/20 bg-red-500/[0.06] p-3 text-[13px] text-red-400">
                  {error}
                </div>
              )}

              <div className="flex items-start gap-2 rounded-input bg-white/[0.03] p-3 border border-white/[.06]">
                <svg className="h-4 w-4 mt-0.5 flex-shrink-0 text-flow-green" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                <p className="text-[12px] text-flow-gray">7 dias grátis. Sem cartão de crédito. Cancele quando quiser.</p>
              </div>

              {/* Aceite de termos e privacidade */}
              <div className="flex items-start gap-3 rounded-input bg-white/[0.03] p-3 border border-white/[.06]">
                <input
                  id="cadastro-terms"
                  type="checkbox"
                  checked={form.termsAccepted}
                  onChange={(e) => setForm({ ...form, termsAccepted: e.target.checked })}
                  className="mt-1 rounded border-white/[.2] bg-transparent text-flow-blue focus:ring-flow-blue"
                />
                <label htmlFor="cadastro-terms" className="text-[12px] text-flow-gray leading-relaxed cursor-pointer">
                  Li e aceito os <Link href="/termos-de-uso" className="text-flow-blue underline hover:text-flow-cyan transition-colors">Termos de Uso</Link>
                </label>
              </div>
              <div className="flex items-start gap-3 rounded-input bg-white/[0.03] p-3 border border-white/[.06]">
                <input
                  id="cadastro-privacy"
                  type="checkbox"
                  checked={form.privacyAccepted}
                  onChange={(e) => setForm({ ...form, privacyAccepted: e.target.checked })}
                  className="mt-1 rounded border-white/[.2] bg-transparent text-flow-blue focus:ring-flow-blue"
                />
                <label htmlFor="cadastro-privacy" className="text-[12px] text-flow-gray leading-relaxed cursor-pointer">
                  Li e aceito a <Link href="/politica-de-privacidade" className="text-flow-blue underline hover:text-flow-cyan transition-colors">Política de Privacidade</Link>
                </label>
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-ghost flex h-[52px] items-center justify-center border border-white/[.06] px-6 text-[15px]"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex h-[52px] flex-1 items-center justify-center text-[15px] font-semibold disabled:opacity-50"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {loading ? "Criando..." : "Testar 7 dias grátis"}
                </button>
              </div>
            </form>
          )}

          <div className="mt-8 text-center text-[14px] text-flow-muted">
            Já tem conta?{" "}
            <Link href="/login" className="font-medium text-flow-blue hover:text-flow-cyan transition-colors">
              Entrar
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-[13px] text-flow-muted/50">
          <Link href="/" className="hover:text-flow-gray transition-colors">
            ← Voltar para o início
          </Link>
        </p>
      </div>
    </div>
  )
}
