"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Lock, Eye, EyeOff } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { fetchAuth } from "@/lib/fetch-auth"

export default function TrocarSenhaPage() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem")
      return
    }

    if (newPassword.length < 6) {
      setError("Senha deve ter no mínimo 6 caracteres")
      return
    }

    if (currentPassword === newPassword) {
      setError("A nova senha deve ser diferente da atual")
      return
    }

    setLoading(true)

    try {
      const res = await fetchAuth("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Erro ao trocar senha")
        return
      }

      // Update local storage
      const stored = localStorage.getItem("pedefacil-user")
      if (stored) {
        const userData = JSON.parse(stored)
        userData.mustChangePassword = false
        localStorage.setItem("pedefacil-user", JSON.stringify(userData))
      }

      // Redirect based on role
      const userData = JSON.parse(localStorage.getItem("pedefacil-user") || "{}")
      if (userData.role === "motoboy") {
        router.push(`/${userData.establishment?.slug}/entregas/${userData.deliveryPerson?.token}`)
      } else if (userData.permissions?.includes("caixa")) {
        const caixaOnlyPerms = ["caixa", "pedidos", "entregas", "clientes"]
        const hasOnlyCaixaPerms = userData.permissions.every((p: string) => caixaOnlyPerms.includes(p))
        if (hasOnlyCaixaPerms && !userData.permissions.includes("dashboard")) {
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
          <img src="/icons/pedefacil-logo.svg" alt="PedeFácil" className="mx-auto h-16" />
        </div>

        <Card className="border-zinc-200 shadow-lg">
          <CardContent className="p-8">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                <Lock className="h-6 w-6 text-amber-600" />
              </div>
              <h1 className="text-xl font-bold text-zinc-900">Trocar senha</h1>
              <p className="mt-2 text-sm text-zinc-500">
                Por segurança, você precisa criar uma nova senha no primeiro login.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Input
                  label="Senha atual"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
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
                label="Nova senha"
                type={showPassword ? "text" : "password"}
                placeholder="mín. 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
              />

              <Input
                label="Confirmar nova senha"
                type={showPassword ? "text" : "password"}
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />

              {newPassword && confirmPassword && newPassword !== confirmPassword && (
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
                disabled={loading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {loading ? "Trocando..." : "Trocar senha"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
