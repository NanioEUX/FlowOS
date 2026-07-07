"use client"

import { useEffect, useState } from "react"

interface DonutProps {
  value: number
  total: number
  color: string
  size?: number
  strokeWidth?: number
  label?: string
  sublabel?: string
}

export function Donut({ value, total, color, size = 80, strokeWidth = 6, label, sublabel }: DonutProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setTimeout(() => setMounted(true), 100) }, [])

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const percent = total > 0 ? value / total : 0
  const offset = mounted ? circumference * (1 - percent) : circumference

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e4e4e7" strokeWidth={strokeWidth} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }}
          />
        </svg>
        {label && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs font-bold text-zinc-900">{label}</span>
            {sublabel && <span className="text-[9px] text-zinc-400">{sublabel}</span>}
          </div>
        )}
      </div>
    </div>
  )
}