"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useEstablishmentId } from "@/hooks/use-establishment-id"
import { Star, Loader2, Save } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { fetchAuth } from "@/lib/fetch-auth"
import { formatCurrency } from "@/lib/utils"

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
        body: JSON.stringify({ loyaltyConfig: JSON.stringify(loyaltyConfig) }),
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
      <h2 className="text-2xl font-bold text-flow-white">Fidelidade</h2>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="flex items-center gap-2 font-semibold text-flow-white">
            <Star className="h-4 w-4" />
            Programa de Fidelidade
          </h3>
          <p className="text-sm text-zinc-500">Clientes acumulam pontos a cada pedido e trocam por desconto ou produto.</p>
          <label className="flex items-center gap-3 rounded-lg border border-white/[.06] p-4 cursor-pointer hover:bg-white/[.05]">
            <input
              type="checkbox"
              checked={loyaltyConfig.enabled}
              onChange={(e) => setLoyaltyConfig({ ...loyaltyConfig, enabled: e.target.checked })}
              className="h-5 w-5 rounded border-white/[.08] text-flow-blue focus:ring-green-500"
            />
            <div>
              <span className="font-medium text-flow-white">Ativar fidelidade</span>
              <p className="text-xs text-zinc-500">Clientes ganham pontos a cada R$ 1 gasto</p>
            </div>
          </label>
          {loyaltyConfig.enabled && (
            <div className="rounded-lg bg-white/[.03] p-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-300">Pontos por R$ 1</label>
                <input
                  type="number"
                  min="1"
                  value={loyaltyConfig.pointsPerReal}
                  onChange={(e) => setLoyaltyConfig({ ...loyaltyConfig, pointsPerReal: Number(e.target.value) })}
                  className="w-full rounded-lg border border-white/[.06] bg-flow-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Tipo de resgate</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLoyaltyConfig({ ...loyaltyConfig, redeemType: "discount" })}
                    className={`flex-1 rounded-lg border p-3 text-sm font-medium transition-colors ${loyaltyConfig.redeemType !== "product" ? "border-flow-blue bg-flow-blue/10 text-flow-blue" : "border-white/[.06] text-zinc-400 hover:bg-white/[.05]"}`}
                  >
                    Desconto (R$)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoyaltyConfig({ ...loyaltyConfig, redeemType: "product" })}
                    className={`flex-1 rounded-lg border p-3 text-sm font-medium transition-colors ${loyaltyConfig.redeemType === "product" ? "border-flow-blue bg-flow-blue/10 text-flow-blue" : "border-white/[.06] text-zinc-400 hover:bg-white/[.05]"}`}
                  >
                    Produto grátis
                  </button>
                </div>
              </div>

              {loyaltyConfig.redeemType !== "product" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-300">Pontos para resgatar</label>
                    <input
                      type="number"
                      min="1"
                      value={loyaltyConfig.redeemPoints}
                      onChange={(e) => setLoyaltyConfig({ ...loyaltyConfig, redeemPoints: Number(e.target.value) })}
                      className="w-full rounded-lg border border-white/[.06] bg-flow-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-300">Desconto (R$)</label>
                    <input
                      type="number"
                      min="1"
                      step="0.50"
                      value={loyaltyConfig.redeemDiscount}
                      onChange={(e) => setLoyaltyConfig({ ...loyaltyConfig, redeemDiscount: Number(e.target.value) })}
                      className="w-full rounded-lg border border-white/[.06] bg-flow-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-300">Pontos para resgatar</label>
                    <input
                      type="number"
                      min="1"
                      value={loyaltyConfig.redeemPoints}
                      onChange={(e) => setLoyaltyConfig({ ...loyaltyConfig, redeemPoints: Number(e.target.value) })}
                      className="w-full rounded-lg border border-white/[.06] bg-flow-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-300">Produto para resgate</label>
                    <select
                      value={loyaltyConfig.redeemProductId || ""}
                      onChange={(e) => setLoyaltyConfig({ ...loyaltyConfig, redeemProductId: e.target.value })}
                      className="w-full rounded-lg border border-white/[.06] bg-flow-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
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
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar alterações
        </Button>
        {saved && <span className="flex items-center gap-1 text-sm text-flow-blue"><Save className="h-4 w-4" />Salvo!</span>}
      </div>
    </div>
  )
}
