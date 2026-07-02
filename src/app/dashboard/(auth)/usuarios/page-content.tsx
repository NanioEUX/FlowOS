"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Users, Plus, Pencil, Trash2, X, Loader2, Shield, Eye, EyeOff, Check, Copy, ExternalLink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { fetchAuth } from "@/lib/fetch-auth"
import { useToast } from "@/components/toast"
import { ConfirmDialog } from "@/components/confirm-dialog"

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
  const { toast } = useToast()
  const [users, setUsers] = useState<any[]>([])
  const [deliveryPersons, setDeliveryPersons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", role: "atendente", permissions: ["caixa", "pedidos"] as string[], canCloseRegister: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; name: string; isAdmin: boolean }>({ open: false, id: "", name: "", isAdmin: false })

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
    setForm({ name: "", email: "", phone: "", password: "123456", role: "atendente", permissions: ["caixa", "pedidos"], canCloseRegister: false })
    setError("")
    setShowForm(true)
  }

  function handleRoleChange(role: string) {
    if (role === "motoboy") {
      setForm({ ...form, role, permissions: ["entregas"] })
    } else if (role === "admin") {
      setForm({ ...form, role, permissions: [...ALL_PERMISSIONS_VALUES] })
    } else {
      setForm({ ...form, role, permissions: ["caixa", "pedidos"] })
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
      toast(editingUser ? "Usuário atualizado" : "Usuário criado com sucesso", "success")
      loadUsers()
    } catch {
      setError("Erro ao salvar")
      toast("Erro ao salvar usuário", "error")
    } finally {
      setSaving(false)
    }
  }

  function handleDeleteUser(user: any) {
    const adminCount = users.filter((u) => u.role === "admin" && u.isActive).length
    const isLastAdmin = user.role === "admin" && adminCount <= 1
    setDeleteConfirm({ open: true, id: user.id, name: user.name, isAdmin: isLastAdmin })
  }

  async function confirmDeleteUser() {
    if (deleteConfirm.isAdmin) {
      toast("Não é possível excluir o último administrador", "error")
      setDeleteConfirm({ open: false, id: "", name: "", isAdmin: false })
      return
    }
    await fetchAuth(`/api/users/${deleteConfirm.id}`, { method: "DELETE" })
    toast("Usuário removido com sucesso", "success")
    setDeleteConfirm({ open: false, id: "", name: "", isAdmin: false })
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
        <div className="rounded-xl border border-dashed border-white/[.08] p-12 text-center">
          <Users className="mx-auto h-8 w-8 text-zinc-700" />
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
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
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
                      <button onClick={() => toggleActive(user)} className={`rounded p-1 ${user.isActive ? "text-green-600 hover:text-green-600" : "text-zinc-400 hover:text-zinc-400"}`}>
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => openEdit(user)} className="rounded p-1 text-zinc-400 hover:text-zinc-400">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDeleteUser(user)} className="rounded p-1 text-red-400 hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {perms.map((p: string) => (
                      <span key={p} className="rounded-full bg-green-600/10 px-2 py-0.5 text-[10px] font-medium text-green-600">
                        {ALL_PERMISSIONS.find((ap) => ap.value === p)?.label || p}
                      </span>
                    ))}
                    {user.canCloseRegister && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
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
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Nome</label>
                  <input
                    placeholder="Nome do usuário"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Email</label>
                  <input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Senha</label>
                  <input
                    type="password"
                    placeholder={editingUser ? "Deixe vazio para manter" : "123456 (padrão)"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
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
                            : "border-zinc-200 text-zinc-400 hover:bg-zinc-100"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {form.role === "motoboy" && (
                  <>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-zinc-700">Email</label>
                      <input
                        type="email"
                        placeholder="motoboy@email.com"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-zinc-700">WhatsApp (com DDD)</label>
                      <input
                        placeholder="11999999999"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none"
                      />
                    </div>
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
                              : "border-zinc-200 text-zinc-400 hover:bg-zinc-100"
                          }`}
                        >
                          <div className={`flex h-4 w-4 items-center justify-center rounded border ${
                            form.permissions.includes(perm.value)
                              ? "border-[#FF6B35] bg-[#FF6B35]"
                              : "border-white/[.08]"
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
                              ? "border-amber-400 bg-amber-500/10 text-amber-400"
                              : "border-zinc-200 text-zinc-400 hover:bg-zinc-100"
                          }`}
                        >
                          <div className={`flex h-4 w-4 items-center justify-center rounded border ${
                            form.canCloseRegister
                              ? "border-amber-500 bg-amber-500/100"
                              : "border-white/[.08]"
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

      <ConfirmDialog
        open={deleteConfirm.open}
        title="Remover usuário"
        message={
          deleteConfirm.isAdmin
            ? "Não é possível excluir o último administrador do sistema. Crie outro admin antes de excluir este."
            : `Tem certeza que deseja remover o usuário "${deleteConfirm.name}"? Esta ação não pode ser desfeita.`
        }
        confirmLabel={deleteConfirm.isAdmin ? "Entendi" : "Remover"}
        variant="danger"
        onConfirm={confirmDeleteUser}
        onCancel={() => setDeleteConfirm({ open: false, id: "", name: "", isAdmin: false })}
      />
    </div>
  )
}
