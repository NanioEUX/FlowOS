"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Users, Plus, Pencil, Trash2, X, Loader2, Shield, Eye, EyeOff, Check, Copy, ExternalLink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { fetchAuth } from "@/lib/fetch-auth"

const ALL_PERMISSIONS = [
  { value: "dashboard", label: "Dashboard", desc: "Visão geral do dia" },
  { value: "caixa", label: "Caixa", desc: "Ponto de venda (POS)" },
  { value: "pedidos", label: "Pedidos", desc: "Gerenciar pedidos" },
  { value: "clientes", label: "Clientes", desc: "Gerenciar clientes" },
  { value: "cardapio", label: "Cardápio", desc: "Gerenciar cardápio" },
  { value: "estoque", label: "Estoque", desc: "Gerenciar estoque" },
  { value: "entregas", label: "Entregas", desc: "Gerenciar entregas" },
  { value: "financeiro", label: "Financeiro", desc: "Relatórios financeiros" },
  { value: "relatorios", label: "Relatórios", desc: "Ver relatórios" },
  { value: "config", label: "Configurações", desc: "Configurações do estabelecimento" },
  { value: "usuarios", label: "Usuários", desc: "Gerenciar usuários" },
]

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  atendente: "Atendente",
  motoboy: "Motoboy",
}

const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  admin: [],
  atendente: ["caixa"],
  motoboy: ["entregas"],
}

const ALL_PERMISSIONS_VALUES = ALL_PERMISSIONS.map((p) => p.value)

const ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "atendente", label: "Atendente" },
  { value: "motoboy", label: "Motoboy" },
]

export default function UsuariosPage() {
  const searchParams = useSearchParams()
  const hookEstablishmentId = useEstablishmentId()
  const searchParamsEstablishmentId = searchParams.get("establishment")
  const establishmentId = searchParamsEstablishmentId || hookEstablishmentId
  const [users, setUsers] = useState<any[]>([])
  const [deliveryPersons, setDeliveryPersons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", role: "atendente", permissions: ["caixa"] as string[], canCloseRegister: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function loadUsers() {
    if (!establishmentId) return
    setLoading(true)
    const [usersRes, deliveryRes] = await Promise.all([
      fetchAuth(`/api/users?establishmentId=${establishmentId}`),
      fetchAuth(`/api/delivery-persons?establishmentId=${establishmentId}`),
    ])
    if (usersRes.ok) setUsers(await usersRes.json())
    if (deliveryRes.ok) setDeliveryPersons(await deliveryRes.json())
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [establishmentId])

  function openNew() {
    setEditingUser(null)
    setForm({ name: "", email: "", phone: "", password: "123456", role: "atendente", permissions: ["caixa"], canCloseRegister: false })
    setError("")
    setShowForm(true)
  }

  function handleRoleChange(role: string) {
    if (role === "motoboy") {
      setForm({ ...form, role, permissions: ["entregas"] })
    } else if (role === "admin") {
      setForm({ ...form, role, permissions: [...ALL_PERMISSIONS_VALUES] })
    } else {
      setForm({ ...form, role, permissions: ["caixa"] })
    }
  }

  function openEdit(user: any) {
    setEditingUser(user)
    const deliveryPerson = user.role === "motoboy" ? deliveryPersons.find((dp) => dp.userId === user.id) : null
    setForm({
      name: user.name,
      email: user.email,
      phone: deliveryPerson?.phone || "",
      password: "",
      role: user.role,
      permissions: JSON.parse(user.permissions || '["caixa"]'),
      canCloseRegister: user.canCloseRegister || false,
    })
    setError("")
    setShowForm(true)
  }

  function togglePermission(perm: string) {
    setForm((prev) => {
      const has = prev.permissions.includes(perm)
      return {
        ...prev,
        permissions: has ? prev.permissions.filter((p) => p !== perm) : [...prev.permissions, perm],
      }
    })
  }

  async function saveUser() {
    if (!establishmentId || !form.name) return
    if (!editingUser && form.role !== "motoboy" && !form.email) return
    if (!editingUser && form.role !== "motoboy" && !form.password) {
      setError("Senha é obrigatória para novos usuários")
      return
    }
    if (form.permissions.length === 0) {
      setError("Selecione pelo menos uma permissão")
      return
    }

    setSaving(true)
    setError("")

    try {
      if (editingUser) {
        const body: any = { name: form.name, email: form.email, role: form.role, permissions: form.permissions, canCloseRegister: form.canCloseRegister }
        if (form.password) body.password = form.password
        await fetchAuth(`/api/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      } else if (form.role === "motoboy") {
        // motoboy: delivery-persons API creates both user + deliveryPerson
        const res = await fetchAuth("/api/delivery-persons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            phone: form.phone || "00000000000",
            email: form.email || undefined,
            establishmentId,
            defaultPassword: form.password || "123456",
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || "Erro ao criar")
          setSaving(false)
          return
        }
      } else {
        const res = await fetchAuth("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            password: form.password,
            role: form.role,
            permissions: form.permissions,
            canCloseRegister: form.canCloseRegister,
            establishmentId,
            mustChangePassword: true,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || "Erro ao criar")
          setSaving(false)
          return
        }
      }
      setShowForm(false)
      loadUsers()
    } catch {
      setError("Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }

  async function deleteUser(id: string) {
    if (!confirm("Remover este usuário?")) return
    await fetchAuth(`/api/users/${id}`, { method: "DELETE" })
    loadUsers()
  }

  async function toggleActive(user: any) {
    await fetchAuth(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    })
    loadUsers()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-900">Usuários</h2>
        <Button onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      {users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center">
          <Users className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-2 text-sm text-zinc-500">Nenhum usuário cadastrado</p>
          <p className="text-xs text-zinc-400">Crie o primeiro atendente para começar</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((user) => {
            const perms = JSON.parse(user.permissions || '["caixa"]')
            const deliveryPerson = user.role === "motoboy" ? deliveryPersons.find((dp) => dp.userId === user.id) : null
            return (
              <Card key={user.id} className={!user.isActive ? "opacity-50" : ""}>
                <CardContent className="p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-zinc-900">{user.name}</p>
                        {user.role === "admin" && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                            Admin
                          </span>
                        )}
                        {user.role === "motoboy" && (
                          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                            Motoboy
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleActive(user)} className={`rounded p-1 ${user.isActive ? "text-green-500 hover:text-green-700" : "text-zinc-400 hover:text-zinc-600"}`}>
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => openEdit(user)} className="rounded p-1 text-zinc-400 hover:text-zinc-600">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteUser(user.id)} className="rounded p-1 text-red-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {perms.map((p: string) => (
                      <span key={p} className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
                        {ALL_PERMISSIONS.find((ap) => ap.value === p)?.label || p}
                      </span>
                    ))}
                    {user.canCloseRegister && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        Fecha Caixa
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">{editingUser ? "Editar Usuário" : "Novo Usuário"}</h3>
                <button onClick={() => setShowForm(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <Input
                  label="Nome"
                  placeholder="Nome do usuário"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Senha</label>
                  <Input
                    type="password"
                    placeholder={editingUser ? "Deixe vazio para manter" : "123456 (padrão)"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                  {!editingUser && (
                    <p className="mt-1 text-xs text-zinc-400">
                      Senha padrão: 123456 (usuário deverá trocar no primeiro login)
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Perfil</label>
                  <div className="flex gap-2">
                    {ROLES.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setForm({ ...form, role: value, permissions: value === "motoboy" ? ["entregas"] : form.permissions })}
                        className={`flex-1 rounded-lg border p-2 text-sm font-medium transition-colors ${
                          form.role === value
                            ? "border-[#FF6B35] bg-[#FFF0E6] text-[#FF6B35]"
                            : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {form.role === "motoboy" && (
                  <>
                    <Input
                      label="Email"
                      type="email"
                      placeholder="motoboy@email.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                    <Input
                      label="WhatsApp (com DDD)"
                      placeholder="11999999999"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </>
                )}

                {form.role !== "motoboy" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">Permissões</label>
                    <div className="grid grid-cols-2 gap-2">
                      {ALL_PERMISSIONS.map((perm) => (
                        <button
                          key={perm.value}
                          type="button"
                          onClick={() => togglePermission(perm.value)}
                          className={`flex items-center gap-2 rounded-lg border p-2 text-left text-sm transition-colors ${
                            form.permissions.includes(perm.value)
                              ? "border-[#FF6B35] bg-[#FFF0E6] text-[#FF6B35]"
                              : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                          }`}
                        >
                          <div className={`flex h-4 w-4 items-center justify-center rounded border ${
                            form.permissions.includes(perm.value)
                              ? "border-[#FF6B35] bg-[#FF6B35]"
                              : "border-zinc-300"
                          }`}>
                            {form.permissions.includes(perm.value) && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <div>
                            <p className="font-medium">{perm.label}</p>
                            <p className="text-[10px] text-zinc-400">{perm.desc}</p>
                          </div>
                        </button>
                      ))}
                      {form.permissions.includes("caixa") && form.role !== "motoboy" && (
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, canCloseRegister: !form.canCloseRegister })}
                          className={`flex items-center gap-2 rounded-lg border p-2 text-left text-sm transition-colors ${
                            form.canCloseRegister
                              ? "border-amber-400 bg-amber-50 text-amber-700"
                              : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                          }`}
                        >
                          <div className={`flex h-4 w-4 items-center justify-center rounded border ${
                            form.canCloseRegister
                              ? "border-amber-500 bg-amber-500"
                              : "border-zinc-300"
                          }`}>
                            {form.canCloseRegister && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <div>
                            <p className="font-medium">Fecha Caixa</p>
                            <p className="text-[10px] text-zinc-400">Fechar e transferir</p>
                          </div>
                        </button>
                      )}
                    </div>
                    {form.role === "admin" && (
                      <p className="mt-2 text-xs text-zinc-400">
                        Administradores podem ter todas as permissões ou apenas algumas
                      </p>
                    )}
                  </div>
                )}

                {error && <p className="text-sm text-red-500">{error}</p>}

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                  <Button className="flex-1" onClick={saveUser} disabled={saving}>
                    {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    {editingUser ? "Salvar" : "Criar"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
