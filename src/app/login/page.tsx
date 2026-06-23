"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Erro ao fazer login")
        return
      }

      localStorage.setItem("pedefacil-user", JSON.stringify({
        ...data.user,
        establishmentId: data.establishment.id,
        establishment: data.establishment,
        token: data.token,
        refreshToken: data.refreshToken,
      }))

      if (data.user.mustChangePassword) {
        router.push("/trocar-senha")
        return
      }

      if (data.user.role === "motoboy" && data.user.deliveryPerson) {
        const { slug, token: dpToken } = data.user.deliveryPerson
        router.push(`/${slug}/entregas/${dpToken}`)
      } else if (data.user.permissions?.includes("caixa")) {
        const caixaOnlyPerms = ["caixa", "pedidos", "entregas", "clientes"]
        const hasOnlyCaixaPerms = data.user.permissions.every((p: string) => caixaOnlyPerms.includes(p))
        if (hasOnlyCaixaPerms && !data.user.permissions.includes("dashboard")) {
          router.push("/caixa")
        } else {
          router.push("/dashboard/home")
        }
      } else {
        router.push("/dashboard/home")
      }
    } catch {
      setError("Erro de conexão")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black px-5 overflow-hidden">
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-[#FF6B35]/[0.07] blur-[150px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-purple-600/[0.05] blur-[130px]" />
      </div>

      <div className="relative z-10 w-full max-w-[480px]">
        {/* Logo */}
        <div className="mb-10 text-center">
          <Link href="/" className="inline-block">
            <div className="relative inline-block">
              <div className="absolute inset-0 rounded-2xl bg-[#FF6B35]/15 blur-[40px]" />
              <img src="/icons/pedefacil-logo.svg" alt="PedeFácil" className="relative h-16 md:h-20" />
            </div>
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-[20px] border border-white/[0.08] bg-white/[0.03] p-8 md:p-10 backdrop-blur-xl">
          <div className="mb-8 text-center">
            <h1 className="text-[28px] font-semibold tracking-[-0.8px] text-white">Bem-vindo de volta</h1>
            <p className="mt-2 text-[15px] text-white/40 font-light">Acesse seu painel de controle</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.15em] text-white/30">Email</label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border-0 border-b border-white/[0.12] bg-transparent pb-3 text-[15px] text-white placeholder:text-white/25 focus:border-[#FF6B35]/50 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.15em] text-white/30">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full border-0 border-b border-white/[0.12] bg-transparent pb-3 pr-10 text-[15px] text-white placeholder:text-white/25 focus:border-[#FF6B35]/50 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="text-right">
              <Link href="/esqueci-senha" className="text-[13px] text-white/35 hover:text-[#FF6B35] transition-colors">
                Esqueceu a senha?
              </Link>
            </div>

            {error && (
              <div className="rounded-[10px] border border-red-500/20 bg-red-500/[0.06] p-3 text-[13px] text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-[52px] w-full items-center justify-center rounded-full bg-gradient-to-r from-[#FF6B35] to-[#E55A2B] text-[15px] font-semibold text-white transition-opacity hover:opacity-90 shadow-[0_0_30px_rgba(255,107,53,0.25)] disabled:opacity-50"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="mt-8 text-center text-[14px] text-white/30">
            Não tem uma conta?{" "}
            <Link href="/cadastro" className="font-medium text-[#FF6B35] hover:opacity-80 transition-opacity">
              Criar gratuitamente
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-[13px] text-white/20">
          <Link href="/" className="hover:text-white/40 transition-colors">
            ← Voltar para o início
          </Link>
        </p>
      </div>
    </div>
  )
}
