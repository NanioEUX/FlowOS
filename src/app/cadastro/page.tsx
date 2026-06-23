"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
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
    <div className="relative flex min-h-screen items-center justify-center bg-black px-5 py-12 overflow-hidden">
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-[#FF6B35]/[0.07] blur-[150px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-purple-600/[0.05] blur-[130px]" />
      </div>

      <div className="relative z-10 w-full max-w-[520px]">
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
            <h1 className="text-[28px] font-semibold tracking-[-0.8px] text-white">Criar sua conta</h1>
            <p className="mt-2 text-[15px] text-white/40 font-light">Seu cardápio online em 2 minutos</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.15em] text-white/30">Nome do estabelecimento</label>
              <input
                type="text"
                placeholder="Ex: Pizzaria do João"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full border-0 border-b border-white/[0.12] bg-transparent pb-3 text-[15px] text-white placeholder:text-white/25 focus:border-[#FF6B35]/50 focus:outline-none transition-colors"
              />
              {form.name && (
                <p className="mt-2 text-[12px] text-white/30">
                  Seu link: <span className="text-[#FF6B35]">{slug}.pedefacil.com</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.15em] text-white/30">E-mail</label>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className="w-full border-0 border-b border-white/[0.12] bg-transparent pb-3 text-[15px] text-white placeholder:text-white/25 focus:border-[#FF6B35]/50 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.15em] text-white/30">Senha</label>
                <input
                  type="password"
                  placeholder="mín. 6 caracteres"
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  className="w-full border-0 border-b border-white/[0.12] bg-transparent pb-3 text-[15px] text-white placeholder:text-white/25 focus:border-[#FF6B35]/50 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.15em] text-white/30">WhatsApp (com DDD)</label>
              <input
                type="text"
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
                className="w-full border-0 border-b border-white/[0.12] bg-transparent pb-3 text-[15px] text-white placeholder:text-white/25 focus:border-[#FF6B35]/50 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.15em] text-white/30">Categoria</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                required
                className="w-full appearance-none border-0 border-b border-white/[0.12] bg-transparent pb-3 text-[15px] text-white focus:border-[#FF6B35]/50 focus:outline-none transition-colors"
              >
                <option value="" className="bg-[#111] text-white/40">Selecione</option>
                {categories.map((c) => (
                  <option key={c.value} value={c.value} className="bg-[#111] text-white">{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.15em] text-white/30">Endereço (opcional)</label>
              <input
                type="text"
                placeholder="Ex: Rua Augusta, 1500"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full border-0 border-b border-white/[0.12] bg-transparent pb-3 text-[15px] text-white placeholder:text-white/25 focus:border-[#FF6B35]/50 focus:outline-none transition-colors"
              />
            </div>

            {error && (
              <div className="rounded-[10px] border border-red-500/20 bg-red-500/[0.06] p-3 text-[13px] text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-[52px] w-full items-center justify-center rounded-full bg-gradient-to-r from-[#FF6B35] to-[#E55A2B] text-[15px] font-semibold text-white transition-opacity hover:opacity-90 shadow-[0_0_30px_rgba(255,107,53,0.25)] disabled:opacity-50 mt-2"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? "Criando..." : "Criar cardápio grátis"}
            </button>
          </form>

          <div className="mt-8 text-center text-[14px] text-white/30">
            Já tem conta?{" "}
            <Link href="/login" className="font-medium text-[#FF6B35] hover:opacity-80 transition-opacity">
              Entrar
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
