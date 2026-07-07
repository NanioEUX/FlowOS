"use client"

import { useEffect, useState } from "react"
import { formatCurrency } from "@/lib/utils"

interface AreaChartProps {
  data: { date: string; total: number }[]
  height?: number
  color?: string
}

export function AreaChart({ data, height = 180, color = "#16a34a" }: AreaChartProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setTimeout(() => setMounted(true), 100) }, [])

  if (!data.length) return null

  const max = Math.max(...data.map((d) => d.total), 1)
  const w = 600
  const h = height
  const padX = 40
  const padY = 20

  const points = data.map((d, i) => {
    const x = padX + (i / (data.length - 1 || 1)) * (w - padX * 2)
    const y = h - padY - (d.total / max) * (h - padY * 2)
    return { x, y, ...d }
  })

  const linePoints = points.map((p) => `${p.x},${p.y}`).join(" ")
  const areaPoints = `${padX},${h - padY} ${linePoints} ${w - padX},${h - padY}`

  const now = new Date().toISOString().split("T")[0]

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = h - padY - pct * (h - padY * 2)
          return <line key={pct} x1={padX} y1={y} x2={w - padX} y2={y} stroke="#e4e4e7" strokeWidth="0.5" strokeDasharray="4" />
        })}

        {/* Area */}
        <polygon
          points={areaPoints}
          fill="url(#areaGrad)"
          style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.8s ease" }}
        />

        {/* Line */}
        <polyline
          points={linePoints}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: mounted ? "none" : "1000",
            strokeDashoffset: mounted ? "0" : "1000",
            transition: "stroke-dashoffset 1.2s ease",
          }}
        />

        {/* Dots */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="white" stroke={color} strokeWidth="2" style={{ opacity: mounted ? 1 : 0, transition: `opacity 0.3s ease ${i * 0.08}s` }} />
            {p.date === now && (
              <circle cx={p.x} cy={p.y} r="6" fill={color} fillOpacity={0.2} />
            )}
          </g>
        ))}
      </svg>

      {/* Labels */}
      <div className="flex justify-between px-2 -mt-1">
        {points.map((p, i) => {
          const [, m, d] = p.date.split("-")
          const isToday = p.date === now
          return (
            <span key={i} className={`text-[10px] ${isToday ? "font-bold text-green-600" : "text-zinc-400"}`}>
              {d}/{m}
            </span>
          )
        })}
      </div>
    </div>
  )
}