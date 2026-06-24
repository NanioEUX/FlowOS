"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react"
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

  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [changeLoading, setChangeLoading] = useState(false)
  const [changeError, setChangeError] = useState("")
  const [changeSuccess, setChangeSuccess] = useState(false)
  const [loginData, setLoginData] = useState<any>(null)

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

      if (data.user.mustChangePassword) {
        setLoginData(data)
        setMustChangePassword(true)
        return
      }

      localStorage.setItem("pedefacil-user", JSON.stringify({
        ...data.user,
        establishmentId: data.establishment.id,
        establishment: data.establishment,
        token: data.token,
        refreshToken: data.refreshToken,
      }))

      if (data.subscriptionExpired) {
        router.push("/dashboard/planos")
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

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setChangeError("")

    if (newPassword.length < 6) {
      setChangeError("A nova senha deve ter no mínimo 6 caracteres")
      return
    }
    if (newPassword !== confirmPassword) {
      setChangeError("As senhas não coincidem")
      return
    }

    setChangeLoading(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${loginData.token}`,
        },
        body: JSON.stringify({ currentPassword: password, newPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        setChangeError(data.error || "Erro ao alterar senha")
        return
      }

      setChangeSuccess(true)

      localStorage.setItem("pedefacil-user", JSON.stringify({
        ...loginData.user,
        mustChangePassword: false,
        establishmentId: loginData.establishment.id,
        establishment: loginData.establishment,
        token: loginData.token,
        refreshToken: loginData.refreshToken,
      }))

      setTimeout(() => {
        if (loginData.subscriptionExpired) {
          router.push("/dashboard/planos")
          return
        }
        if (loginData.user.role === "motoboy" && loginData.user.deliveryPerson) {
          const { slug, token: dpToken } = loginData.user.deliveryPerson
          router.push(`/${slug}/entregas/${dpToken}`)
        } else if (loginData.user.permissions?.includes("caixa")) {
          const caixaOnlyPerms = ["caixa", "pedidos", "entregas", "clientes"]
          const hasOnlyCaixaPerms = loginData.user.permissions.every((p: string) => caixaOnlyPerms.includes(p))
          if (hasOnlyCaixaPerms && !loginData.user.permissions.includes("dashboard")) {
            router.push("/caixa")
          } else {
            router.push("/dashboard/home")
          }
        } else {
          router.push("/dashboard/home")
        }
      }, 1500)
    } catch {
      setChangeError("Erro de conexão")
    } finally {
      setChangeLoading(false)
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
          {!mustChangePassword ? (
            <>
              <div className="mb-8 text-center">
                <h1 className="text-[28px] font-semibold tracking-[-0.8px] text-white">Bem vindo</h1>
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
            </>
          ) : (
            <>
              <div className="mb-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#FF6B35]/10">
                  <ShieldCheck className="h-7 w-7 text-[#FF6B35]" />
                </div>
                <h1 className="text-[24px] font-semibold tracking-[-0.8px] text-white">Alterar senha</h1>
                <p className="mt-2 text-[14px] text-white/40 font-light">
                  Este é seu primeiro acesso. Por segurança, altere sua senha antes de continuar.
                </p>
              </div>

              {changeSuccess ? (
                <div className="rounded-[10px] border border-green-500/20 bg-green-500/[0.06] p-4 text-center">
                  <p className="text-[14px] text-green-400 font-medium">Senha alterada com sucesso!</p>
                  <p className="mt-1 text-[12px] text-white/30">Redirecionando...</p>
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-5">
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.15em] text-white/30">Nova senha</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Mínimo 6 caracteres"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        className="w-full border-0 border-b border-white/[0.12] bg-transparent pb-3 pr-10 text-[15px] text-white placeholder:text-white/25 focus:border-[#FF6B35]/50 focus:outline-none transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-0 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.15em] text-white/30">Confirmar nova senha</label>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Repita a nova senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full border-0 border-b border-white/[0.12] bg-transparent pb-3 text-[15px] text-white placeholder:text-white/25 focus:border-[#FF6B35]/50 focus:outline-none transition-colors"
                    />
                  </div>

                  {changeError && (
                    <div className="rounded-[10px] border border-red-500/20 bg-red-500/[0.06] p-3 text-[13px] text-red-400">
                      {changeError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={changeLoading}
                    className="flex h-[52px] w-full items-center justify-center rounded-full bg-gradient-to-r from-[#FF6B35] to-[#E55A2B] text-[15px] font-semibold text-white transition-opacity hover:opacity-90 shadow-[0_0_30px_rgba(255,107,53,0.25)] disabled:opacity-50"
                  >
                    {changeLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {changeLoading ? "Alterando..." : "Alterar senha e entrar"}
                  </button>
                </form>
              )}
            </>
          )}
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
