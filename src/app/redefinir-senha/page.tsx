"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, Lock, CheckCircle, Eye, EyeOff } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"

function RedefinirSenhaForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [invalidToken, setInvalidToken] = useState(false)

  useEffect(() => {
    if (!token) {
      setInvalidToken(true)
    }
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("As senhas não coincidem")
      return
    }

    if (password.length < 6) {
      setError("Senha deve ter no mínimo 6 caracteres")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Erro ao redefinir senha")
        return
      }

      setSuccess(true)
      setTimeout(() => {
        router.push("/login")
      }, 3000)
    } catch {
      setError("Erro de conexão")
    } finally {
      setLoading(false)
    }
  }

  if (invalidToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#FFF7F3] to-white p-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <Link href="/">
              <img src="/icons/pedefacil-logo.svg" alt="PedeFácil" className="mx-auto h-16" />
            </Link>
          </div>

          <Card className="border-zinc-200 shadow-lg">
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <Lock className="h-6 w-6 text-red-600" />
              </div>
              <h1 className="text-xl font-bold text-zinc-900">Link inválido</h1>
              <p className="mt-2 text-sm text-zinc-500">
                O link de redefinição de senha é inválido ou está faltando.
              </p>
              <div className="mt-6">
                <Link href="/esqueci-senha">
                  <Button className="w-full bg-[#FF6B35] hover:bg-[#E55A2B]">
                    Solicitar novo link
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
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
            {success ? (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <h1 className="text-xl font-bold text-zinc-900">Senha redefinida!</h1>
                <p className="mt-2 text-sm text-zinc-500">
                  Sua senha foi atualizada com sucesso.
                </p>
                <p className="mt-2 text-xs text-zinc-400">
                  Redirecionando para o login...
                </p>
              </div>
            ) : (
              <>
                <div className="mb-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF0E6]">
                    <Lock className="h-6 w-6 text-[#FF6B35]" />
                  </div>
                  <h1 className="text-xl font-bold text-zinc-900">Redefinir senha</h1>
                  <p className="mt-2 text-sm text-zinc-500">
                    Crie uma nova senha para sua conta.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="relative">
                    <Input
                      label="Nova senha"
                      type={showPassword ? "text" : "password"}
                      placeholder="mín. 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
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

                  <Input
                    label="Confirmar senha"
                    type={showPassword ? "text" : "password"}
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />

                  {password && confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-500">As senhas não coincidem</p>
                  )}

                  {error && (
                    <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-[#FF6B35] hover:bg-[#E55A2B]"
                    disabled={loading || !password || !confirmPassword || password !== confirmPassword}
                  >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {loading ? "Redefinindo..." : "Redefinir senha"}
                  </Button>
                </form>

                <div className="mt-6 text-center text-sm text-zinc-500">
                  <p>
                    <Link href="/login" className="font-medium text-[#FF6B35] hover:underline">
                      Voltar para o login
                    </Link>
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#FF6B35]" />
      </div>
    }>
      <RedefinirSenhaForm />
    </Suspense>
  )
}
