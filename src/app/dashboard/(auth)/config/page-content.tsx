"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Save, Loader2, Eye, EyeOff, CreditCard, Banknote, Bike, Store, Clock, Star } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { fetchAuth } from "@/lib/fetch-auth"
import { formatCurrency } from "@/lib/utils"

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

export default function ConfigPage() {
  const searchParams = useSearchParams()
  const hookEstablishmentId = useEstablishmentId()
  const searchParamsEstablishmentId = searchParams.get("establishment")
  const establishmentId = searchParamsEstablishmentId || hookEstablishmentId
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [form, setForm] = useState({
    name: "",
    phone: "",
    category: "",
    address: "",
    logo: "",
    cover: "",
    asaasApiKey: "",
    asaasWalletId: "",
    deliveryFeeType: "free",
    deliveryFeeAmount: "0",
    deliveryFreeAbove: "0",
  })
  const [paymentConfig, setPaymentConfig] = useState({ online: true, delivery: true, pickup: true })
  const [orderConfig, setOrderConfig] = useState({ delivery: true, pickup: true })
  const [businessHours, setBusinessHours] = useState([
    { day: "Segunda", open: "09:00", close: "22:00", active: true },
    { day: "Terça", open: "09:00", close: "22:00", active: true },
    { day: "Quarta", open: "09:00", close: "22:00", active: true },
    { day: "Quinta", open: "09:00", close: "22:00", active: true },
    { day: "Sexta", open: "09:00", close: "22:00", active: true },
    { day: "Sábado", open: "09:00", close: "23:00", active: true },
    { day: "Domingo", open: "00:00", close: "00:00", active: false },
  ])
  const [loyaltyConfig, setLoyaltyConfig] = useState({ enabled: false, pointsPerReal: 1, redeemPoints: 100, redeemDiscount: 10, redeemType: "discount", redeemProductId: "" })
  const [allProducts, setAllProducts] = useState<any[]>([])

  useEffect(() => {
    if (!establishmentId) return
    fetchAuth(`/api/establishments?id=${establishmentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setForm({
            name: data.name || "",
            phone: data.phone || "",
            category: data.category || "",
            address: data.address || "",
            logo: data.logo || "",
            cover: data.cover || "",
            asaasApiKey: data.asaasApiKey || "",
            asaasWalletId: data.asaasWalletId || "",
            deliveryFeeType: data.deliveryFeeType || "free",
            deliveryFeeAmount: String(data.deliveryFeeAmount || "0"),
            deliveryFreeAbove: String(data.deliveryFreeAbove || "0"),
          })
          if (data.paymentConfig) {
            try { setPaymentConfig(JSON.parse(data.paymentConfig)) } catch {}
          }
          if (data.orderConfig) {
            try { setOrderConfig(JSON.parse(data.orderConfig)) } catch {}
          }
          if (data.businessHours) {
            try { setBusinessHours(JSON.parse(data.businessHours)) } catch {}
          }
          if (data.loyaltyConfig) {
            try {
              const lc = JSON.parse(data.loyaltyConfig)
              setLoyaltyConfig({ ...loyaltyConfig, ...lc })
            } catch {}
          }
        }
      })
    fetchAuth(`/api/categories?establishmentId=${establishmentId}`)
      .then((r) => r.json())
      .then((cats) => {
        if (Array.isArray(cats)) {
          setAllProducts(cats.flatMap((c: any) => c.products || []))
        }
      })
  }, [establishmentId])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)

    try {
      const res = await fetchAuth(`/api/establishments/${establishmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          deliveryFeeAmount: form.deliveryFeeType === "free" ? 0 : Number(form.deliveryFeeAmount),
          deliveryFreeAbove: form.deliveryFeeType === "free_above" ? Number(form.deliveryFreeAbove) : 0,
          paymentConfig: JSON.stringify(paymentConfig),
          orderConfig: JSON.stringify(orderConfig),
          businessHours: JSON.stringify(businessHours),
          loyaltyConfig: JSON.stringify(loyaltyConfig),
        }),
      })

      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="text-2xl font-bold text-zinc-900">Configurações</h2>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Dados do Estabelecimento */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">Dados do Estabelecimento</h3>
            <Input label="Nome" id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="WhatsApp (com DDD)" id="phone" placeholder="11999999999" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Select label="Categoria" id="category" options={categories} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <Input label="Endereço" id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </CardContent>
        </Card>

        {/* Asaas */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">Asaas (Pagamentos Online)</h3>
            <p className="text-sm text-zinc-500">
             
            </p>
            <div className="relative">
              <Input label="API Key" id="asaasApiKey" type={showKey ? "text" : "password"} placeholder="asaas_api_key_..." value={form.asaasApiKey} onChange={(e) => setForm({ ...form, asaasApiKey: e.target.value })} />
              <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-8 text-zinc-400 hover:text-zinc-600">
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Tipos de Pedido */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">Tipos de Pedido</h3>
            <p className="text-sm text-zinc-500">Habilite ou desabilite os tipos de pedido disponíveis no cardápio.</p>
            <div className="space-y-3">
              <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-50">
                <input type="checkbox" checked={orderConfig.delivery} onChange={(e) => setOrderConfig({ ...orderConfig, delivery: e.target.checked })} className="h-5 w-5 rounded border-zinc-300 text-green-600 focus:ring-green-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <Bike className="h-4 w-4 text-zinc-600" />
                    <span className="font-medium text-zinc-900">Entrega</span>
                  </div>
                  <p className="text-xs text-zinc-500">Cliente recebe em casa</p>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-50">
                <input type="checkbox" checked={orderConfig.pickup} onChange={(e) => setOrderConfig({ ...orderConfig, pickup: e.target.checked })} className="h-5 w-5 rounded border-zinc-300 text-green-600 focus:ring-green-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-zinc-600" />
                    <span className="font-medium text-zinc-900">Retirada</span>
                  </div>
                  <p className="text-xs text-zinc-500">Cliente busca no local</p>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Taxa de Entrega */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">Taxa de Entrega</h3>
            <p className="text-sm text-zinc-500">Configure como a taxa de entrega é calculada.</p>
            <div className="space-y-4">
              <div className="space-y-2">
                {[
                  { value: "free", label: "Grátis", desc: "Sem taxa de entrega" },
                  { value: "fixed", label: "Taxa fixa", desc: "Valor único por pedido" },
                  { value: "free_above", label: "Grátis acima de R$ X", desc: "Cobra taxa só em pedidos abaixo de um valor" },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-50">
                    <input
                      type="radio"
                      name="deliveryFeeType"
                      value={opt.value}
                      checked={form.deliveryFeeType === opt.value}
                      onChange={(e) => setForm({ ...form, deliveryFeeType: e.target.value })}
                      className="h-4 w-4 border-zinc-300 text-green-600 focus:ring-green-500"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-zinc-900">{opt.label}</span>
                      <p className="text-xs text-zinc-500">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              {form.deliveryFeeType !== "free" && (
                <div className="rounded-lg bg-zinc-50 p-4 space-y-3">
                  <Input label="Valor da taxa (R$)" id="deliveryFeeAmount" type="number" step="0.01" min="0" placeholder="5,00" value={form.deliveryFeeAmount} onChange={(e) => setForm({ ...form, deliveryFeeAmount: e.target.value })} />
                  {form.deliveryFeeType === "free_above" && (
                    <Input label="Grátis a partir de (R$)" id="deliveryFreeAbove" type="number" step="0.01" min="0" placeholder="50,00" value={form.deliveryFreeAbove} onChange={(e) => setForm({ ...form, deliveryFreeAbove: e.target.value })} />
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Formas de Pagamento */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">Formas de Pagamento</h3>
            <p className="text-sm text-zinc-500">Quais formas de pagamento o cliente vê na hora de fechar o pedido.</p>
            <div className="space-y-3">
              <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-50">
                <input type="checkbox" checked={paymentConfig.online} onChange={(e) => setPaymentConfig({ ...paymentConfig, online: e.target.checked })} className="h-5 w-5 rounded border-zinc-300 text-green-600 focus:ring-green-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-zinc-600" />
                    <span className="font-medium text-zinc-900">Online (Pix / Cartão)</span>
                  </div>
                  <p className="text-xs text-zinc-500">Cliente paga na hora via Asaas</p>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-50">
                <input type="checkbox" checked={paymentConfig.delivery} onChange={(e) => setPaymentConfig({ ...paymentConfig, delivery: e.target.checked })} className="h-5 w-5 rounded border-zinc-300 text-green-600 focus:ring-green-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-zinc-600" />
                    <span className="font-medium text-zinc-900">Pagar na Entrega</span>
                  </div>
                  <p className="text-xs text-zinc-500">Cliente paga em dinheiro/cartão na entrega</p>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-50">
                <input type="checkbox" checked={paymentConfig.pickup} onChange={(e) => setPaymentConfig({ ...paymentConfig, pickup: e.target.checked })} className="h-5 w-5 rounded border-zinc-300 text-green-600 focus:ring-green-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-zinc-600" />
                    <span className="font-medium text-zinc-900">Pagar na Retirada</span>
                  </div>
                  <p className="text-xs text-zinc-500">Cliente paga ao buscar</p>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Horário de Funcionamento */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="flex items-center gap-2 font-semibold text-zinc-900">
              <Clock className="h-4 w-4" />
              Horário de Funcionamento
            </h3>
            <p className="text-sm text-zinc-500">Configure os horários. Fora desse horário, o cardápio informa que está fechado.</p>
            <div className="space-y-2">
              {businessHours.map((h, i) => (
                <div key={h.day} className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                  <label className="flex items-center gap-2 min-w-[120px]">
                    <input
                      type="checkbox"
                      checked={h.active}
                      onChange={(e) => {
                        const updated = [...businessHours]
                        updated[i] = { ...updated[i], active: e.target.checked }
                        setBusinessHours(updated)
                      }}
                      className="h-4 w-4 rounded border-zinc-300 text-green-600 focus:ring-green-500"
                    />
                    <span className={`text-sm font-medium ${h.active ? "text-zinc-900" : "text-zinc-400"}`}>{h.day?.trim()}</span>
                  </label>
                  {h.active ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={h.open}
                        onChange={(e) => {
                          const updated = [...businessHours]
                          updated[i] = { ...updated[i], open: e.target.value }
                          setBusinessHours(updated)
                        }}
                        className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                      />
                      <span className="text-xs text-zinc-400">até</span>
                      <input
                        type="time"
                        value={h.close}
                        onChange={(e) => {
                          const updated = [...businessHours]
                          updated[i] = { ...updated[i], close: e.target.value }
                          setBusinessHours(updated)
                        }}
                        className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-400">Fechado</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Fidelidade */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="flex items-center gap-2 font-semibold text-zinc-900">
              <Star className="h-4 w-4" />
              Programa de Fidelidade
            </h3>
            <p className="text-sm text-zinc-500">Clientes acumulam pontos a cada pedido e trocam por desconto ou produto.</p>
            <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-50">
              <input
                type="checkbox"
                checked={loyaltyConfig.enabled}
                onChange={(e) => setLoyaltyConfig({ ...loyaltyConfig, enabled: e.target.checked })}
                className="h-5 w-5 rounded border-zinc-300 text-green-600 focus:ring-green-500"
              />
              <div>
                <span className="font-medium text-zinc-900">Ativar fidelidade</span>
                <p className="text-xs text-zinc-500">Clientes ganham pontos a cada R$ 1 gasto</p>
              </div>
            </label>
            {loyaltyConfig.enabled && (
              <div className="rounded-lg bg-zinc-50 p-4 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Pontos por R$ 1</label>
                  <input
                    type="number"
                    min="1"
                    value={loyaltyConfig.pointsPerReal}
                    onChange={(e) => setLoyaltyConfig({ ...loyaltyConfig, pointsPerReal: Number(e.target.value) })}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">Tipo de resgate</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setLoyaltyConfig({ ...loyaltyConfig, redeemType: "discount" })}
                      className={`flex-1 rounded-lg border p-3 text-sm font-medium transition-colors ${loyaltyConfig.redeemType !== "product" ? "border-green-500 bg-green-50 text-green-700" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}
                    >
                      Desconto (R$)
                    </button>
                    <button
                      type="button"
                      onClick={() => setLoyaltyConfig({ ...loyaltyConfig, redeemType: "product" })}
                      className={`flex-1 rounded-lg border p-3 text-sm font-medium transition-colors ${loyaltyConfig.redeemType === "product" ? "border-green-500 bg-green-50 text-green-700" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}
                    >
                      Produto grátis
                    </button>
                  </div>
                </div>

                {loyaltyConfig.redeemType !== "product" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700">Pontos para resgatar</label>
                      <input
                        type="number"
                        min="1"
                        value={loyaltyConfig.redeemPoints}
                        onChange={(e) => setLoyaltyConfig({ ...loyaltyConfig, redeemPoints: Number(e.target.value) })}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700">Desconto (R$)</label>
                      <input
                        type="number"
                        min="1"
                        step="0.50"
                        value={loyaltyConfig.redeemDiscount}
                        onChange={(e) => setLoyaltyConfig({ ...loyaltyConfig, redeemDiscount: Number(e.target.value) })}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700">Pontos para resgatar</label>
                      <input
                        type="number"
                        min="1"
                        value={loyaltyConfig.redeemPoints}
                        onChange={(e) => setLoyaltyConfig({ ...loyaltyConfig, redeemPoints: Number(e.target.value) })}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700">Produto para resgate</label>
                      <select
                        value={loyaltyConfig.redeemProductId || ""}
                        onChange={(e) => setLoyaltyConfig({ ...loyaltyConfig, redeemProductId: e.target.value })}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                      >
                        <option value="">Selecionar produto...</option>
                        {allProducts.map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name} ({formatCurrency(p.price)})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <p className="text-xs text-zinc-400">
                  {loyaltyConfig.redeemType !== "product"
                    ? `Ex: ${loyaltyConfig.pointsPerReal} ponto(s) por R$ 1 • ${loyaltyConfig.redeemPoints} pontos = R$ ${loyaltyConfig.redeemDiscount} de desconto`
                    : `Ex: ${loyaltyConfig.pointsPerReal} ponto(s) por R$ 1 • ${loyaltyConfig.redeemPoints} pontos = produto selecionado`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar alterações
          </Button>
          {saved && <span className="flex items-center gap-1 text-sm text-green-600"><Save className="h-4 w-4" />Salvo!</span>}
        </div>
      </form>
    </div>
  )
}
