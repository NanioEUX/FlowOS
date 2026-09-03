"use client"

import { useState } from "react"

export function CommissionEditor({ establishmentId, currentPercentage }: { establishmentId: string; currentPercentage: number }) {
  const [value, setValue] = useState(currentPercentage)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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
    <div className="flex items-center gap-3">
      <input
        type="number"
        min={0}
        max={100}
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
  )
}
