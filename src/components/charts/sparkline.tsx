"use client"

import { useEffect, useState } from "react"

interface SparklineProps {
  data: number[]
  color?: string
  height?: number
  className?: string
}

export function Sparkline({ data, color = "#16a34a", height = 40, className = "" }: SparklineProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setTimeout(() => setMounted(true), 50) }, [])

  if (!data.length) return null

  const max = Math.max(...data, 1)
  const min = 0
  const range = max - min || 1
  const w = 200
  const h = height
  const padding = 2

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (w - padding * 2)
    const y = h - padding - ((v - min) / range) * (h - padding * 2)
    return `${x},${y}`
  }).join(" ")

  const areaPoints = `${padding},${h} ${points} ${w - padding},${h}`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon
        points={areaPoints}
        fill={`url(#spark-${color.replace("#", "")})`}
        style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: mounted ? "none" : "500",
          strokeDashoffset: mounted ? "0" : "500",
          transition: "stroke-dashoffset 1s ease",
        }}
      />
    </svg>
  )
}