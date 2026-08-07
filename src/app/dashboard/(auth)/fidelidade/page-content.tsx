"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Star, Loader2, Save, Award, Plus, Trash2, GripVertical, Shield } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { fetchAuth } from "@/lib/fetch-auth"
import { formatCurrency } from "@/lib/utils"
import { SearchableSelect } from "@/components/searchable-select"

interface Tier {
  name: string
  minSpent: number
  multiplier: number
  emoji: string
  color: string
}

interface TierConfig {
  enabled: boolean
  tiers: Tier[]
}

const DEFAULT_TIERS: Tier[] = [
  { name: "Bronze", minSpent: 0, multiplier: 1, emoji: "🥉", color: "#CD7F32" },
  { name: "Prata", minSpent: 300, multiplier: 1.5, emoji: "🥈", color: "#C0C0C0" },
  { name: "Ouro", minSpent: 800, multiplier: 2, emoji: "🥇", color: "#FFD700" },
  { name: "Diamante", minSpent: 2000, multiplier: 3, emoji: "💎", color: "#B9F2FF" },
]

export default function FidelidadePageContent() {
  const searchParams = useSearchParams()
  const hookEstablishmentId = useEstablishmentId()
  const searchParamsEstablishmentId = searchParams.get("establishment")
  const establishmentId = searchParamsEstablishmentId || hookEstablishmentId

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loyaltyConfig, setLoyaltyConfig] = useState({
    enabled: false,
    pointsPerReal: 1,
    redeemPoints: 100,
    redeemDiscount: 10,
    redeemType: "discount",
    redeemProductId: "",
  })
  const [tierConfig, setTierConfig] = useState<TierConfig>({
    enabled: false,
    tiers: DEFAULT_TIERS,
  })
  const [firstPurchaseEnabled, setFirstPurchaseEnabled] = useState(false)
  const [firstPurchaseDiscount, setFirstPurchaseDiscount] = useState(5)
  const [firstPurchaseBonus, setFirstPurchaseBonus] = useState(50)
  const [allProducts, setAllProducts] = useState<any[]>([])

  useEffect(() => {
    if (!establishmentId) return
    fetchAuth(`/api/establishments?id=${establishmentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error && data.loyaltyConfig) {
          try {
            const lc = JSON.parse(data.loyaltyConfig)
            setLoyaltyConfig((prev) => ({ ...prev, ...lc }))
          } catch {}
        }
        if (!data.error && data.tierConfig) {
          try {
            const tc = JSON.parse(data.tierConfig)
            setTierConfig((prev) => ({ ...prev, ...tc }))
          } catch {}
        }
        if (!data.error) {
          if (typeof data.firstPurchaseEnabled === "boolean") setFirstPurchaseEnabled(data.firstPurchaseEnabled)
          if (typeof data.firstPurchaseDiscount === "number") setFirstPurchaseDiscount(data.firstPurchaseDiscount)
          if (typeof data.firstPurchaseBonus === "number") setFirstPurchaseBonus(data.firstPurchaseBonus)
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

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetchAuth(`/api/establishments/${establishmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loyaltyConfig: JSON.stringify(loyaltyConfig),
          tierConfig: JSON.stringify(tierConfig),
          firstPurchaseEnabled,
          firstPurchaseDiscount,
          firstPurchaseBonus,
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

  function updateTier(index: number, field: keyof Tier, value: any) {
    setTierConfig((prev) => ({
      ...prev,
      tiers: prev.tiers.map((t, i) => (i === index ? { ...t, [field]: value } : t)),
    }))
  }

  function addTier() {
    setTierConfig((prev) => ({
      ...prev,
      tiers: [...prev.tiers, { name: "Novo Nível", minSpent: 0, multiplier: 1, emoji: "⭐", color: "#888888" }],
    }))
  }

  function removeTier(index: number) {
    setTierConfig((prev) => ({
      ...prev,
      tiers: prev.tiers.filter((_, i) => i !== index),
    }))
  }

  function moveTier(index: number, direction: "up" | "down") {
    setTierConfig((prev) => {
      const tiers = [...prev.tiers]
      const targetIndex = direction === "up" ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= tiers.length) return prev
      ;[tiers[index], tiers[targetIndex]] = [tiers[targetIndex], tiers[index]]
      return { ...prev, tiers }
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="text-2xl font-bold text-zinc-900">Fidelidade</h2>

      {/* Loyalty Config */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="flex items-center gap-2 font-semibold text-zinc-900">
            <Star className="h-4 w-4" />
            Programa de Cashback
          </h3>
          <p className="text-sm text-zinc-500">Clientes acumulam cash a cada pedido e usam como desconto.</p>
          <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-100">
            <input
              type="checkbox"
              checked={loyaltyConfig.enabled}
              onChange={(e) => setLoyaltyConfig({ ...loyaltyConfig, enabled: e.target.checked })}
              className="h-5 w-5 rounded border-white/[.08] text-green-600 focus:ring-green-500"
            />
            <div>
              <span className="font-medium text-zinc-900">Ativar cashback</span>
              <p className="text-xs text-zinc-500">Clientes ganham cash a cada R$ 1 gasto</p>
            </div>
          </label>
          {loyaltyConfig.enabled && (
            <div className="rounded-lg bg-zinc-50 p-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Cash por R$ 1</label>
                <input
                  type="number"
                  min="1"
                  value={loyaltyConfig.pointsPerReal}
                  onChange={(e) => setLoyaltyConfig({ ...loyaltyConfig, pointsPerReal: Number(e.target.value) })}
                  className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">Tipo de resgate</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLoyaltyConfig({ ...loyaltyConfig, redeemType: "discount" })}
                    className={`flex-1 rounded-lg border p-3 text-sm font-medium transition-colors ${loyaltyConfig.redeemType !== "product" ? "border-green-600 bg-green-600/10 text-green-600" : "border-zinc-200 text-zinc-400 hover:bg-zinc-100"}`}
                  >
                    Desconto (R$)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoyaltyConfig({ ...loyaltyConfig, redeemType: "product" })}
                    className={`flex-1 rounded-lg border p-3 text-sm font-medium transition-colors ${loyaltyConfig.redeemType === "product" ? "border-green-600 bg-green-600/10 text-green-600" : "border-zinc-200 text-zinc-400 hover:bg-zinc-100"}`}
                  >
                    Produto grátis
                  </button>
                </div>
              </div>

              {loyaltyConfig.redeemType !== "product" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">Cash para resgatar</label>
                    <input
                      type="number"
                      min="1"
                      value={loyaltyConfig.redeemPoints}
                      onChange={(e) => setLoyaltyConfig({ ...loyaltyConfig, redeemPoints: Number(e.target.value) })}
                      className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
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
                      className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">Cash para resgatar</label>
                    <input
                      type="number"
                      min="1"
                      value={loyaltyConfig.redeemPoints}
                      onChange={(e) => setLoyaltyConfig({ ...loyaltyConfig, redeemPoints: Number(e.target.value) })}
                      className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">Produto para resgate</label>
                    <SearchableSelect
                      value={loyaltyConfig.redeemProductId || ""}
                      onChange={(v) => setLoyaltyConfig({ ...loyaltyConfig, redeemProductId: v })}
                      options={[{ value: "", label: "Selecionar produto..." }, ...allProducts.map((p: any) => ({ value: p.id, label: `${p.name} (${formatCurrency(p.price)})` }))]}
                      placeholder="Selecionar produto..."
                    />
                  </div>
                </div>
              )}

              <p className="text-xs text-zinc-400">
                {loyaltyConfig.redeemType !== "product"
                  ? `Ex: ${loyaltyConfig.pointsPerReal} cash por R$ 1 • ${loyaltyConfig.redeemPoints} cash = R$ ${loyaltyConfig.redeemDiscount} de desconto`
                  : `Ex: ${loyaltyConfig.pointsPerReal} cash por R$ 1 • ${loyaltyConfig.redeemPoints} cash = produto selecionado`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tier Config */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="flex items-center gap-2 font-semibold text-zinc-900">
            <Award className="h-4 w-4" />
            Níveis de Fidelidade
          </h3>
          <p className="text-sm text-zinc-500">Níveis automáticos baseados no total gasto. Clientes em níveis mais altos ganham mais cash.</p>
          <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-100">
            <input
              type="checkbox"
              checked={tierConfig.enabled}
              onChange={(e) => setTierConfig({ ...tierConfig, enabled: e.target.checked })}
              className="h-5 w-5 rounded border-white/[.08] text-green-600 focus:ring-green-500"
            />
            <div>
              <span className="font-medium text-zinc-900">Ativar níveis</span>
              <p className="text-xs text-zinc-500">Clientes sobem de nível automaticamente</p>
            </div>
          </label>
          {tierConfig.enabled && (
            <div className="space-y-3">
              {tierConfig.tiers.map((tier, index) => (
                <div key={index} className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => moveTier(index, "up")}
                      disabled={index === 0}
                      className="text-zinc-400 hover:text-zinc-600 disabled:opacity-30"
                    >
                      <GripVertical className="h-3 w-3 rotate-180" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTier(index, "down")}
                      disabled={index === tierConfig.tiers.length - 1}
                      className="text-zinc-400 hover:text-zinc-600 disabled:opacity-30"
                    >
                      <GripVertical className="h-3 w-3" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={tier.emoji}
                    onChange={(e) => updateTier(index, "emoji", e.target.value)}
                    className="w-10 text-center text-lg"
                  />
                  <input
                    type="text"
                    value={tier.name}
                    onChange={(e) => updateTier(index, "name", e.target.value)}
                    className="w-28 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                  />
                  <div className="flex-1">
                    <label className="text-xs text-zinc-500">Mínimo gasto</label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-zinc-400">R$</span>
                      <input
                        type="number"
                        min="0"
                        value={tier.minSpent}
                        onChange={(e) => updateTier(index, "minSpent", Number(e.target.value))}
                        className="w-20 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                  <div className="w-20">
                    <label className="text-xs text-zinc-500">Multiplicador</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={tier.multiplier}
                        onChange={(e) => updateTier(index, "multiplier", Number(e.target.value))}
                        className="w-14 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                      />
                      <span className="text-xs text-zinc-400">x</span>
                    </div>
                  </div>
                  <input
                    type="color"
                    value={tier.color}
                    onChange={(e) => updateTier(index, "color", e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded border-0"
                  />
                  {tierConfig.tiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTier(index)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addTier}>
                <Plus className="mr-1 h-4 w-4" /> Adicionar nível
              </Button>
              <p className="text-xs text-zinc-400">
                Multiplicador: Prata ganha 1.5x mais cash, Ouro 2x, Diamante 3x
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* First Purchase */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="flex items-center gap-2 font-semibold text-zinc-900">
            <Shield className="h-4 w-4" />
            Bônus de Primeira Compra
          </h3>
          <p className="text-sm text-zinc-500">Cliente novo confirma o WhatsApp e ganha desconto + cash de bônus no primeiro pedido.</p>
          <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-100">
            <input
              type="checkbox"
              checked={firstPurchaseEnabled}
              onChange={(e) => setFirstPurchaseEnabled(e.target.checked)}
              className="h-5 w-5 rounded border-white/[.08] text-green-600 focus:ring-green-500"
            />
            <div>
              <span className="font-medium text-zinc-900">Exigir confirmação WhatsApp na 1ª compra</span>
              <p className="text-xs text-zinc-500">Anti-fraude: cliente valida número via código antes do primeiro pedido</p>
            </div>
          </label>
          {firstPurchaseEnabled && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Desconto (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="0.50"
                  value={firstPurchaseDiscount}
                  onChange={(e) => setFirstPurchaseDiscount(Number(e.target.value))}
                  className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Bônus cash</label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={firstPurchaseBonus}
                  onChange={(e) => setFirstPurchaseBonus(Number(e.target.value))}
                  className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
            </div>
          )}
          {firstPurchaseEnabled && (
            <p className="text-xs text-zinc-400">
              Ex: Cliente novo confirma WhatsApp → ganha R$ {firstPurchaseDiscount.toFixed(2)} de desconto + {firstPurchaseBonus} cash de bônus na primeira compra.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar alterações
        </Button>
        {saved && <span className="flex items-center gap-1 text-sm text-green-600"><Save className="h-4 w-4" />Salvo!</span>}
      </div>
    </div>
  )
}
