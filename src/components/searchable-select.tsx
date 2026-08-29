"use client"

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { Search, X } from "lucide-react"

interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string; sub?: string }[]
  placeholder?: string
  emptyText?: string
  limit?: number
}

export function SearchableSelect({ value, onChange, options, placeholder = "Buscar...", emptyText = "Nenhum resultado", limit = 15 }: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

  const selected = options.find((o) => o.value === value)
  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())).slice(0, limit)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect()
        setDropdownStyle({
          position: "fixed",
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
          zIndex: 9999,
        })
      }
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:border-green-600 focus:outline-none"
      >
        <span className={selected ? "truncate" : "text-zinc-400"}>
          {selected ? selected.label : placeholder}
        </span>
        {selected && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onChange(""); setSearch("") }} className="ml-1 text-zinc-400 hover:text-zinc-600">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div
          style={dropdownStyle}
          onMouseDown={(e) => e.stopPropagation()}
          className="rounded-lg border border-zinc-200 bg-white shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2">
            <Search className="h-3.5 w-3.5 text-zinc-400" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-xs text-zinc-700 placeholder:text-zinc-400 focus:outline-none"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-zinc-400">{emptyText}</p>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setSearch(""); setOpen(false) }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${opt.value === value ? "bg-green-50 text-green-700 font-medium" : "text-zinc-600 hover:bg-zinc-50"}`}
                >
                  {opt.label}
                  {opt.sub && <span className="ml-1 text-zinc-400">{opt.sub}</span>}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
