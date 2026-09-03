"use client"

import { useState } from "react"

export function CommissionEditor({ establishmentId, currentPercentage, pagarmeFee }: { establishmentId: string; currentPercentage: number; pagarmeFee: number }) {
  const [value, setValue] = useState(currentPercentage)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const netProfit = Math.max(0, value - pagarmeFee)

  async function save() {
    setSaving(true)
    setSaved(false)
    await fetch(`/admin-saas/estabelecimentos/${establishmentId}/api`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saasCommissionPercentage: value }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={0}
          max={100}
          step={0.01}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-20 px-3 py-1.5 border border-zinc-300 rounded-lg text-sm"
        />
        <span className="text-zinc-500 text-sm">%</span>
        <button
          onClick={save}
          disabled={saving}
          className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Salvando..." : saved ? "✓ Salvo" : "Salvar"}
        </button>
      </div>
      <div className="text-xs text-zinc-400 space-y-0.5">
        <p>Estabelecimento recebe: <span className="text-zinc-600">{(100 - value).toFixed(2)}%</span></p>
        <p>Pagar.me cobra: <span className="text-zinc-600">{pagarmeFee}%</span></p>
        <p>Líquido SaaS: <span className="text-green-600 font-medium">{netProfit.toFixed(2)}%</span></p>
      </div>
    </div>
  )
}
