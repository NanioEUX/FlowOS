"use client"

import { useState, useEffect } from "react"

function useEstablishmentId(): { id: string | null; error: string | null } {
  const [id, setId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    fetch("/api/establishments/me")
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) {
          setError(data.error || "Erro")
          return
        }
        setId(data?.id || null)
        if (!data?.id) setError("Você precisa estar vinculado a um estabelecimento")
      })
      .catch((e) => setError(e.message))
  }, [])
  return { id, error }
}

interface DeliveryZone {
  id: string
  name: string
  minKm: number
  maxKm: number
  fee: number
  freeAbove: number | null
  estimatedMin: number
  enabled: boolean
  order: number
}

export default function DeliveryZonesPage() {
  const { id: establishmentId, error: authError } = useEstablishmentId()

  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [establishment, setEstablishment] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  const [location, setLocation] = useState({
    addressLat: null as number | null,
    addressLng: null as number | null,
    deliveryRadiusKm: 8,
  })

  const [newZone, setNewZone] = useState({
    name: "",
    minKm: 0,
    maxKm: 1,
    fee: 3,
    freeAbove: "" as string | number,
    estimatedMin: 30,
    enabled: true,
  })

  async function loadData() {
    if (!establishmentId) return
    setLoading(true)
    try {
      const [zonesRes, estabRes] = await Promise.all([
        fetch(`/api/establishments/${establishmentId}/delivery-zones`),
        fetch(`/api/establishments/${establishmentId}`).then((r) => r.json()),
      ])

      const zonesData = await zonesRes.json()
      setZones(Array.isArray(zonesData) ? zonesData : [])

      if (estabRes) {
        setEstablishment(estabRes)
        setLocation({
          addressLat: estabRes.addressLat ?? null,
          addressLng: estabRes.addressLng ?? null,
          deliveryRadiusKm: estabRes.deliveryRadiusKm ?? 8,
        })
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [establishmentId])

  async function captureGps() {
    if (!navigator.geolocation) {
      setError("Seu navegador não suporta geolocalização")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          ...location,
          addressLat: pos.coords.latitude,
          addressLng: pos.coords.longitude,
        })
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true }
    )
  }

  async function saveLocation() {
    if (!establishmentId) return
    setSaving(true)
    setSaved(false)
    try {
      await fetch(`/api/establishments/${establishmentId}/location`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(location),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function addZone() {
    if (!establishmentId || !newZone.name) return
    setSaving(true)
    try {
      const res = await fetch(`/api/establishments/${establishmentId}/delivery-zones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newZone,
          freeAbove: newZone.freeAbove === "" ? null : Number(newZone.freeAbove),
          order: zones.length,
        }),
      })
      const zone = await res.json()
      setZones([...zones, zone])
      setNewZone({ name: "", minKm: 0, maxKm: 1, fee: 3, freeAbove: "", estimatedMin: 30, enabled: true })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleZone(zone: DeliveryZone) {
    const updated = { ...zone, enabled: !zone.enabled }
    setZones(zones.map((z) => (z.id === zone.id ? updated : z)))
    await fetch(`/api/establishments/${establishmentId}/delivery-zones`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    })
  }

  async function deleteZone(id: string) {
    if (!confirm("Excluir essa zona?")) return
    setZones(zones.filter((z) => z.id !== id))
    await fetch(`/api/establishments/${establishmentId}/delivery-zones`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
  }

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-zinc-500">Carregando...</p>
        {authError && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-lg px-4 py-3 max-w-md">
            ⚠️ {authError}. Faça login como admin de um estabelecimento.
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Zonas de Entrega</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Configure taxa por distância. Clientes calculam taxa automática no cardápio pela localização.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
      )}

      {/* Localização do estabelecimento */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-zinc-900 mb-1">📍 Localização do estabelecimento</h2>
        <p className="text-xs text-zinc-500 mb-4">Usada como ponto de origem para cálculo de distância</p>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Latitude</label>
            <input
              type="number"
              step="0.000001"
              value={location.addressLat ?? ""}
              onChange={(e) => setLocation({ ...location, addressLat: e.target.value ? parseFloat(e.target.value) : null })}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
              placeholder="-23.5505"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Longitude</label>
            <input
              type="number"
              step="0.000001"
              value={location.addressLng ?? ""}
              onChange={(e) => setLocation({ ...location, addressLng: e.target.value ? parseFloat(e.target.value) : null })}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
              placeholder="-46.6333"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Raio máx (km)</label>
            <input
              type="number"
              value={location.deliveryRadiusKm}
              onChange={(e) => setLocation({ ...location, deliveryRadiusKm: parseInt(e.target.value) || 8 })}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={captureGps}
            className="bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            📍 Capturar GPS atual
          </button>
          <button
            onClick={saveLocation}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            {saving ? "Salvando..." : "Salvar localização"}
          </button>
          {saved && <span className="text-green-600 text-sm self-center">✅ Salvo!</span>}
        </div>
      </div>

      {/* Adicionar zona */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-zinc-900 mb-1">➕ Nova zona de entrega</h2>
        <p className="text-xs text-zinc-500 mb-4">Ex: &ldquo;Centro&rdquo; de 0 a 1km, taxa R$ 3</p>

        <div className="grid grid-cols-7 gap-2 mb-3">
          <input
            placeholder="Nome"
            value={newZone.name}
            onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
            className="col-span-2 px-3 py-2 border border-zinc-200 rounded-lg text-sm"
          />
          <input
            type="number"
            step="0.1"
            placeholder="De (km)"
            value={newZone.minKm}
            onChange={(e) => setNewZone({ ...newZone, minKm: parseFloat(e.target.value) || 0 })}
            className="px-3 py-2 border border-zinc-200 rounded-lg text-sm"
          />
          <input
            type="number"
            step="0.1"
            placeholder="Até (km)"
            value={newZone.maxKm}
            onChange={(e) => setNewZone({ ...newZone, maxKm: parseFloat(e.target.value) || 1 })}
            className="px-3 py-2 border border-zinc-200 rounded-lg text-sm"
          />
          <input
            type="number"
            step="0.1"
            placeholder="Taxa R$"
            value={newZone.fee}
            onChange={(e) => setNewZone({ ...newZone, fee: parseFloat(e.target.value) || 0 })}
            className="px-3 py-2 border border-zinc-200 rounded-lg text-sm"
          />
          <input
            type="number"
            step="0.1"
            placeholder="Grátis >R$"
            value={newZone.freeAbove}
            onChange={(e) => setNewZone({ ...newZone, freeAbove: e.target.value })}
            className="px-3 py-2 border border-zinc-200 rounded-lg text-sm"
          />
          <input
            type="number"
            placeholder="Min"
            value={newZone.estimatedMin}
            onChange={(e) => setNewZone({ ...newZone, estimatedMin: parseInt(e.target.value) || 30 })}
            className="px-3 py-2 border border-zinc-200 rounded-lg text-sm"
          />
        </div>

        <button
          onClick={addZone}
          disabled={saving || !newZone.name}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + Adicionar zona
        </button>
      </div>

      {/* Lista de zonas */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr className="text-left text-zinc-500 uppercase text-xs">
              <th className="py-3 px-4">Nome</th>
              <th className="py-3 px-4">Distância</th>
              <th className="py-3 px-4">Taxa</th>
              <th className="py-3 px-4">Grátis acima</th>
              <th className="py-3 px-4">Tempo</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.id} className="border-b border-zinc-100">
                <td className="py-3 px-4 font-medium">{z.name}</td>
                <td className="py-3 px-4 text-zinc-600">{z.minKm} - {z.maxKm} km</td>
                <td className="py-3 px-4 text-zinc-900 font-medium">R$ {z.fee.toFixed(2)}</td>
                <td className="py-3 px-4 text-zinc-600">{z.freeAbove ? `R$ ${z.freeAbove.toFixed(2)}` : "—"}</td>
                <td className="py-3 px-4 text-zinc-600">~{z.estimatedMin} min</td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => toggleZone(z)}
                    className={`text-xs px-2 py-1 rounded-full ${z.enabled ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500"}`}
                  >
                    {z.enabled ? "Ativa" : "Inativa"}
                  </button>
                </td>
                <td className="py-3 px-4">
                  <button onClick={() => deleteZone(z.id)} className="text-red-600 hover:underline text-xs">
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
            {zones.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-zinc-500 text-sm">
                  Nenhuma zona configurada. Adicione a primeira acima.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
