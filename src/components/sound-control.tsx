"use client"

import { useEffect, useRef, useState } from "react"
import { Volume2, VolumeX } from "lucide-react"

interface SoundControlProps {
  storageKey?: string
  defaultVolume?: number
  defaultEnabled?: boolean
  accentColor?: string
  onChange?: (enabled: boolean, volume: number) => void
  // Estado controlado externamente (opcional). Se omitido, usa estado interno + localStorage.
  controlledEnabled?: boolean
  controlledVolume?: number
}

export function SoundControl({
  storageKey = "atendimento_sound",
  defaultVolume = 0.7,
  defaultEnabled = true,
  accentColor = "#22c55e",
  onChange,
  controlledEnabled,
  controlledVolume,
}: SoundControlProps) {
  const [internalEnabled, setInternalEnabled] = useState(defaultEnabled)
  const [internalVolume, setInternalVolume] = useState(defaultVolume)
  const enabled = controlledEnabled ?? internalEnabled
  const volume = controlledVolume ?? internalVolume
  const setEnabled = (v: boolean | ((p: boolean) => boolean)) => {
    setInternalEnabled((prev) => {
      const next = typeof v === "function" ? v(prev) : v
      onChange?.(next, controlledVolume ?? internalVolume)
      return next
    })
  }
  const setVolume = (v: number | ((p: number) => number)) => {
    setInternalVolume((prev) => {
      const next = typeof v === "function" ? v(prev) : v
      onChange?.(controlledEnabled ?? internalEnabled, next)
      return next
    })
  }
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (controlledEnabled !== undefined) return
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (typeof parsed.enabled === "boolean") setInternalEnabled(parsed.enabled)
        if (typeof parsed.volume === "number") setInternalVolume(parsed.volume)
      }
    } catch {}
  }, [storageKey, controlledEnabled])

  useEffect(() => {
    if (controlledEnabled !== undefined) return
    try {
      localStorage.setItem(storageKey, JSON.stringify({ enabled, volume }))
    } catch {}
  }, [enabled, volume, storageKey, controlledEnabled])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
        title={enabled ? `Som ligado (${Math.round(volume * 100)}%)` : "Som desligado"}
        aria-label="Controle de som"
      >
        {enabled ? <Volume2 className="w-5 h-5 text-green-400 drop-shadow-[0_0_6px_rgba(74,222,128,0.6)]" /> : <VolumeX className="w-5 h-5 text-zinc-600" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-zinc-300">Som de novos pedidos</span>
            <button
              type="button"
              onClick={() => setEnabled((e) => !e)}
              className="text-xs font-medium px-2 py-1 rounded transition-colors"
              style={{
                backgroundColor: enabled ? `${accentColor}20` : "#3f3f46",
                color: enabled ? accentColor : "#a1a1aa",
              }}
            >
              {enabled ? "Ligado" : "Mudo"}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <VolumeX className="w-4 h-4 text-zinc-500 shrink-0" />
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(volume * 100)}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
              disabled={!enabled}
              className="flex-1 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-green-500 disabled:opacity-40"
              style={{ accentColor }}
            />
            <Volume2 className="w-4 h-4 text-zinc-300 shrink-0" />
          </div>
          <div className="mt-1 text-center text-xs text-zinc-500">{Math.round(volume * 100)}%</div>

          <button
            type="button"
            onClick={() => {
              if (enabled) {
                // Garante desbloqueio do AudioContext (política de autoplay)
                getAudioCtx()
                void playKitchenBeep(volume, 1)
              }
            }}
            disabled={!enabled}
            className="mt-3 w-full text-xs font-medium px-2 py-1.5 rounded border border-zinc-700 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 transition-colors"
          >
            Testar som
          </button>
        </div>
      )}
    </div>
  )
}

// Padrão "cozinha": 3 ciclos de bip duplo (2 tons 1000Hz de 0.3s com pausa 0.2s),
// repetindo a cada 2s. Auto-stop após o 3º ciclo.
// AudioContext é cacheado e resumido a cada chamada para vencer a política
// de autoplay do navegador (que suspende contexts sem interação prévia).
let _audioCtx: any = null

function getAudioCtx(): any {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return null
    if (!_audioCtx || _audioCtx.state === "closed") {
      _audioCtx = new AudioCtx()
    }
    const ctx = _audioCtx
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {})
    }
    return ctx
  } catch {
    return null
  }
}

export async function playKitchenBeep(volume: number = 0.7, cycles: number = 3) {
  const ctx = getAudioCtx()
  if (!ctx) return

  // Ensure AudioContext is resumed before playing (browser autoplay policy)
  if (ctx.state === "suspended") {
    try {
      await ctx.resume()
    } catch {}
  }

  const cycleGapMs = 2000
  const toneMs = 300
  const gapMs = 200
  const repeatCount = cycles

  function playBip(startMs: number) {
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.value = 1000
    gain.gain.value = 0
    osc.connect(gain)
    gain.connect(ctx.destination)

    const t0 = ctx.currentTime + startMs / 1000
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.02)
    osc.start(t0)
    gain.gain.setValueAtTime(volume, t0 + toneMs / 1000 - 0.02)
    gain.gain.linearRampToValueAtTime(0, t0 + toneMs / 1000)
    osc.stop(t0 + toneMs / 1000)
  }

  for (let i = 0; i < repeatCount; i++) {
    const base = i * cycleGapMs
    playBip(base)
    playBip(base + toneMs + gapMs)
  }
}
