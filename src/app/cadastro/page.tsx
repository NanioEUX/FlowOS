"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    category: "",
    address: "",
  })

  const slug = slugify(form.name)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/establishments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, phone: form.phone.replace(/\D/g, "") }),
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

      router.push("/dashboard/pedidos")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF7F3] to-white py-12">
      <div className="mx-auto max-w-lg px-4">
        <Link href="/" className="mb-8 flex justify-center">
          <img src="/icons/pedefacil-logo.svg" alt="PedeFácil" className="h-12" />
        </Link>

        <Card className="border-zinc-200 shadow-lg">
          <CardHeader className="text-center">
            <h1 className="text-2xl font-bold text-zinc-900">Criar sua conta</h1>
            <p className="text-sm text-zinc-500">
              Seu cardápio online em 2 minutos
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Nome do estabelecimento"
                id="name"
                placeholder="Ex: Pizzaria do João"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />

              {form.name && (
                <div className="rounded-lg bg-[#FFF7F3] p-3 text-sm text-zinc-600">
                  Seu link: <span className="font-medium text-[#FF6B35]">{slug}.pedefacil.com</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="E-mail"
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
                <Input
                  label="Senha"
                  id="password"
                  type="password"
                  placeholder="mín. 6 caracteres"
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>

              <Input
                label="WhatsApp (com DDD)"
                id="phone"
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
              />

              <Select
                label="Categoria"
                id="category"
                options={categories}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                required
              />

              <Input
                label="Endereço (opcional)"
                id="address"
                placeholder="Ex: Rua Augusta, 1500"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
              )}

              <Button
                type="submit"
                className="w-full bg-[#FF6B35] hover:bg-[#E55A2B]"
                disabled={loading}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Criar cardápio grátis
              </Button>

              <p className="text-center text-sm text-zinc-500">
                Já tem conta?{" "}
                <Link href="/login" className="font-medium text-[#FF6B35] hover:underline">
                  Entrar
                </Link>
              </p>
            </form>
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
