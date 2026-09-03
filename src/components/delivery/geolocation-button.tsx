"use client"

import { useState } from "react"

export interface DeliveryInfo {
  available: boolean
  distanceKm?: number
  fee?: number
  estimatedMin?: number
  zoneName?: string
  freeAbove?: number | null
  reason?: string
  lat?: number
  lng?: number
}

interface Props {
  establishmentId: string
  orderTotal: number
  onResult: (info: DeliveryInfo) => void
}

export function GeolocationButton({ establishmentId, orderTotal, onResult }: Props) {
  const [loading, setLoading] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [info, setInfo] = useState<DeliveryInfo | null>(null)
  const [error, setError] = useState("")

  async function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Seu navegador não tem geolocalização")
      return
    }

    setLoading(true)
    setError("")

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setCoords({ lat, lng })

        try {
          const res = await fetch(
            `/api/delivery/calculate?est=${establishmentId}&lat=${lat}&lng=${lng}`
          )
          const data = await res.json()
          setInfo({ ...data, lat, lng })
          onResult({ ...data, lat, lng })
        } catch (e: any) {
          setError("Erro ao calcular entrega")
        } finally {
          setLoading(false)
        }
      },
      (err) => {
        setError(err.message || "Permissão negada")
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  function reset() {
    setCoords(null)
    setInfo(null)
    onResult({ available: false })
    setError("")
  }

  if (coords && info) {
    if (!info.available) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
          <div className="flex items-start gap-2">
            <span>❌</span>
            <div className="flex-1">
              <p className="font-medium text-red-900">Fora da área de entrega</p>
              <p className="text-xs text-red-700 mt-0.5">
                {info.reason || "Não entregamos nessa localização"}
                {info.distanceKm && ` (${info.distanceKm}km)`}
              </p>
              <button
                onClick={reset}
                className="text-xs text-red-700 underline mt-1"
              >
                Tentar outra localização
              </button>
            </div>
          </div>
        </div>
      )
    }

    const finalFee =
      info.freeAbove && orderTotal >= info.freeAbove ? 0 : info.fee || 0
    const isFree = finalFee === 0 && info.fee && info.fee > 0

    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
        <div className="flex items-start gap-2">
          <span>✅</span>
          <div className="flex-1">
            <p className="font-medium text-green-900">Entrega disponível</p>
            <p className="text-xs text-green-700 mt-0.5">
              📍 {info.distanceKm}km • ⏱️ ~{info.estimatedMin} min
              {info.zoneName && ` • ${info.zoneName}`}
            </p>
            <p className="text-sm font-semibold text-green-900 mt-1">
              {isFree ? (
                <span>🎉 Grátis (acima de R$ {info.freeAbove?.toFixed(2)})</span>
              ) : finalFee > 0 ? (
                <span>Taxa: R$ {finalFee.toFixed(2)}</span>
              ) : (
                <span>Taxa: Grátis</span>
              )}
            </p>
            <button
              onClick={reset}
              className="text-xs text-green-700 underline mt-1"
            >
              Alterar localização
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={useMyLocation}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 border border-zinc-200 text-zinc-700 text-sm font-medium px-4 py-2.5 rounded-lg transition-all"
      >
        <span>📍</span>
        <span>{loading ? "Calculando..." : "Usar minha localização"}</span>
      </button>
      {error && (
        <p className="text-xs text-red-600 mt-1.5">{error}</p>
      )}
    </div>
  )
}
