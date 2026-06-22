"use client"

import { useState } from "react"
import { Loader2, Mail, CheckCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Erro ao enviar email")
        return
      }

      setSuccess(true)
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
            {success ? (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <h1 className="text-xl font-bold text-zinc-900">Email enviado!</h1>
                <p className="mt-2 text-sm text-zinc-500">
                  Se o email <strong>{email}</strong> estiver cadastrado, você receberá um link para redefinir sua senha.
                </p>
                <p className="mt-2 text-xs text-zinc-400">
                  O link expira em 1 hora. Verifique sua caixa de entrada e spam.
                </p>
                <div className="mt-6">
                  <Link href="/login">
                    <Button className="w-full bg-[#FF6B35] hover:bg-[#E55A2B]">
                      Voltar para o login
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF0E6]">
                    <Mail className="h-6 w-6 text-[#FF6B35]" />
                  </div>
                  <h1 className="text-xl font-bold text-zinc-900">Esqueceu sua senha?</h1>
                  <p className="mt-2 text-sm text-zinc-500">
                    Informe seu email e enviaremos um link para redefinir sua senha.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    label="Email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />

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
                    {loading ? "Enviando..." : "Enviar link de redefinição"}
                  </Button>
                </form>

                <div className="mt-6 text-center text-sm text-zinc-500">
                  <p>
                    Lembrou da senha?{" "}
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
