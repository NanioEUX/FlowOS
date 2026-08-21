"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react"
import { FlowOSLogo } from "@/components/flowos-logo"
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

      // KDS users go to the kitchen display
      if (data.user.role === "kds") {
        localStorage.setItem("kds_token", data.token)
        localStorage.setItem("kds_user", JSON.stringify(data.user))
        localStorage.setItem("kds_establishment", JSON.stringify(data.establishment))
        router.push("/kds/screen")
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
        // KDS users go to the kitchen display
        if (loginData.user.role === "kds") {
          localStorage.setItem("kds_token", loginData.token)
          localStorage.setItem("kds_user", JSON.stringify(loginData.user))
          localStorage.setItem("kds_establishment", JSON.stringify(loginData.establishment))
          router.push("/kds/screen")
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
    <div className="relative flex min-h-screen items-center justify-center bg-flow-bg px-5 overflow-hidden">
      {/* Background glow effects */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-flow-blue/[0.07] blur-[150px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-flow-cyan/[0.05] blur-[130px]" />
      </div>

      <div className="relative z-10 w-full max-w-[440px]">
        {/* Logo */}
        <div className="mb-10 text-center">
          <Link href="/" className="inline-block">
            <FlowOSLogo size={72} />
          </Link>
        </div>

        {/* Card */}
        <div className="glass-card p-8 md:p-10">
          {!mustChangePassword ? (
            <>
              <div className="mb-8 text-center">
                <h1 className="text-[28px] font-bold tracking-[-0.04em] text-flow-white">Bem-vindo(a)</h1>
                <p className="mt-2 text-[15px] text-flow-gray font-light">Faça login para continuar</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.15em] text-flow-muted">Email</label>
                  <input
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="input-flow w-full"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.15em] text-flow-muted">Senha</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="input-flow w-full pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-flow-muted hover:text-flow-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <Link href="/esqueci-senha" className="text-[13px] text-flow-muted hover:text-flow-blue transition-colors">
                    Esqueceu a senha?
                  </Link>
                </div>

                {error && (
                  <div className="rounded-input border border-red-500/20 bg-red-500/[0.06] p-3 text-[13px] text-red-400">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex h-[52px] w-full items-center justify-center text-[15px] font-semibold disabled:opacity-50"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {loading ? "Entrando..." : "Entrar"}
                </button>
              </form>

              <div className="mt-8 text-center text-[14px] text-flow-muted">
                Não tem uma conta?{" "}
                <Link href="/cadastro" className="font-medium text-flow-blue hover:text-flow-cyan transition-colors">
                  Criar gratuitamente
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="mb-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-flow-blue/10">
                  <ShieldCheck className="h-7 w-7 text-flow-blue" />
                </div>
                <h1 className="text-[24px] font-bold tracking-[-0.04em] text-flow-white">Alterar senha</h1>
                <p className="mt-2 text-[14px] text-flow-gray font-light">
                  Primeiro acesso. Altere sua senha por segurança.
                </p>
              </div>

              {changeSuccess ? (
                <div className="rounded-input border border-flow-green/20 bg-flow-green/[0.06] p-4 text-center">
                  <p className="text-[14px] text-flow-green font-medium">Senha alterada com sucesso!</p>
                  <p className="mt-1 text-[12px] text-flow-muted">Redirecionando...</p>
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-5">
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.15em] text-flow-muted">Nova senha</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Mínimo 6 caracteres"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        className="input-flow w-full pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-flow-muted hover:text-flow-white transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.15em] text-flow-muted">Confirmar nova senha</label>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Repita a nova senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="input-flow w-full"
                    />
                  </div>

                  {changeError && (
                    <div className="rounded-input border border-red-500/20 bg-red-500/[0.06] p-3 text-[13px] text-red-400">
                      {changeError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={changeLoading}
                    className="btn-primary flex h-[52px] w-full items-center justify-center text-[15px] font-semibold disabled:opacity-50"
                  >
                    {changeLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {changeLoading ? "Alterando..." : "Alterar senha e entrar"}
                  </button>
                </form>
              )}
            </>
          )}
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
