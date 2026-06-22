"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
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

      // Check if user must change password
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#FFF7F3] to-white p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/">
            <img src="/icons/pedefacil-logo.svg" alt="PedeFácil" className="mx-auto h-16" />
          </Link>
        </div>

        <Card className="border-zinc-200 shadow-lg">
          <CardContent className="p-8">
            <div className="mb-6 text-center">
              <h1 className="text-xl font-bold text-zinc-900">Bem-vindo de volta</h1>
              <p className="text-sm text-zinc-500">Acesse seu painel de controle</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <div className="relative">
                <Input
                  label="Senha"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-9 text-zinc-400 hover:text-zinc-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <div className="text-right">
                <Link href="/esqueci-senha" className="text-xs text-[#FF6B35] hover:underline">
                  Esqueceu a senha?
                </Link>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-[#FF6B35] hover:bg-[#E55A2B]"
                disabled={loading}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-zinc-500">
              <p>
                Não tem uma conta?{" "}
                <Link href="/cadastro" className="font-medium text-[#FF6B35] hover:underline">
                  Criar gratuitamente
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-zinc-400">
          <Link href="/" className="hover:text-[#FF6B35]">
            ← Voltar para o início
          </Link>
        </p>
      </div>
    </div>
  )
}
