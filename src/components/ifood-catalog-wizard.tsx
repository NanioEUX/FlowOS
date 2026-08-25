"use client"

import { useState, useEffect } from "react"
import { ShoppingBag, Download, Check, ChevronDown, ChevronUp, Loader2, X, Package, AlertTriangle, CheckCircle, Image as ImageIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { fetchAuth } from "@/lib/fetch-auth"
import { formatCurrency } from "@/lib/utils"

interface IfoodItem {
  id: string
  name: string
  description: string
  price: number
  originalPrice: number
  imagePath: string | null
  status: string
  hasPromotion: boolean
  hasOptions: boolean
}

interface IfoodCategory {
  ifoodCategoryId: string
  ifoodName: string
  itemCount: number
  items: IfoodItem[]
  mappedCategoryId: string | null
  mappedCategoryName: string | null
}

interface ExistingCategory {
  id: string
  name: string
}

interface ImportResults {
  created: number
  imagesDownloaded: number
  imagesFailed: number
  errors: string[]
}

export function IfoodCatalogWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"loading" | "review" | "importing" | "done">("loading")
  const [categories, setCategories] = useState<IfoodCategory[]>([])
  const [existingCategories, setExistingCategories] = useState<ExistingCategory[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({})
  const [categoryMappings, setCategoryMappings] = useState<Record<string, string>>({})
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<ImportResults | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    loadCatalog()
  }, [])

  async function loadCatalog() {
    try {
      const res = await fetchAuth("/api/ifood-catalog")
      const data = await res.json()
      if (!res.ok) {
        console.error("[ifood-wizard] Error:", data)
        setError(data.error || "Erro ao carregar catálogo")
        return
      }
      setCategories(data.categories)
      setExistingCategories(data.existingCategories)
      setTotalItems(data.totalItems)

      // Auto-select all items and expand first category
      const selected: Record<string, boolean> = {}
      const expanded: Record<string, boolean> = {}
      const mappings: Record<string, string> = {}

      data.categories.forEach((cat: IfoodCategory, idx: number) => {
        expanded[cat.ifoodCategoryId] = idx === 0
        mappings[cat.ifoodCategoryId] = cat.mappedCategoryId || ""
        cat.items.forEach((item) => {
          selected[item.id] = true
        })
      })

      setSelectedItems(selected)
      setExpandedCategories(expanded)
      setCategoryMappings(mappings)
      setStep("review")
    } catch {
      setError("Erro de conexão ao buscar catálogo")
    }
  }

  function toggleItem(itemId: string) {
    setSelectedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }))
  }

  function toggleCategory(categoryId: string) {
    const cat = categories.find((c) => c.ifoodCategoryId === categoryId)
    if (!cat) return

    const allSelected = cat.items.every((item) => selectedItems[item.id])
    const newSelected = { ...selectedItems }
    cat.items.forEach((item) => {
      newSelected[item.id] = !allSelected
    })
    setSelectedItems(newSelected)
  }

  function toggleExpand(categoryId: string) {
    setExpandedCategories((prev) => ({ ...prev, [categoryId]: !prev[categoryId] }))
  }

  function updateCategoryMapping(ifoodCategoryId: string, targetCategoryId: string) {
    setCategoryMappings((prev) => ({ ...prev, [ifoodCategoryId]: targetCategoryId }))
  }

  const selectedCount = Object.values(selectedItems).filter(Boolean).length

  async function handleImport() {
    setImporting(true)
    setStep("importing")

    const itemsToImport: any[] = []
    categories.forEach((cat) => {
      cat.items.forEach((item) => {
        if (selectedItems[item.id]) {
          itemsToImport.push({
            ...item,
            targetCategoryId: categoryMappings[cat.ifoodCategoryId] || null,
            ifoodCategoryName: cat.ifoodName,
          })
        }
      })
    })

    try {
      const res = await fetchAuth("/api/ifood-catalog/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsToImport }),
      })
      const data = await res.json()
      setResults(data)
      setStep("done")
    } catch {
      setError("Erro ao importar produtos")
      setStep("review")
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardContent className="p-0 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <ShoppingBag className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-900">Importar Cardápio do iFood</h2>
                <p className="text-sm text-zinc-500">
                  {step === "loading" && "Buscando itens do iFood..."}
                  {step === "review" && `${selectedCount} de ${totalItems} itens selecionados`}
                  {step === "importing" && "Importando produtos..."}
                  {step === "done" && "Importação concluída"}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Loading */}
            {step === "loading" && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-red-600" />
                <p className="mt-4 text-sm text-zinc-500">Buscando catálogo do iFood...</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Review */}
            {step === "review" && (
              <div className="space-y-4">
                {categories.map((cat) => (
                  <div key={cat.ifoodCategoryId} className="rounded-lg border border-zinc-200 bg-white">
                    {/* Category Header */}
                    <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleCategory(cat.ifoodCategoryId)}
                          className="flex h-5 w-5 items-center justify-center rounded border border-zinc-300"
                        >
                          {cat.items.every((item) => selectedItems[item.id]) && (
                            <Check className="h-3 w-3 text-green-600" />
                          )}
                        </button>
                        <button
                          onClick={() => toggleExpand(cat.ifoodCategoryId)}
                          className="flex items-center gap-2"
                        >
                          <span className="font-semibold text-zinc-900">{cat.ifoodName}</span>
                          <span className="text-xs text-zinc-500">({cat.itemCount} itens)</span>
                          {expandedCategories[cat.ifoodCategoryId] ? (
                            <ChevronUp className="h-4 w-4 text-zinc-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-zinc-400" />
                          )}
                        </button>
                      </div>

                      {/* Category Mapping */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">→</span>
                        <select
                          value={categoryMappings[cat.ifoodCategoryId] || ""}
                          onChange={(e) => updateCategoryMapping(cat.ifoodCategoryId, e.target.value)}
                          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 focus:border-green-500 focus:outline-none"
                        >
                          <option value="">Criar nova categoria</option>
                          {existingCategories.map((ec) => (
                            <option key={ec.id} value={ec.id}>
                              {ec.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Items */}
                    {expandedCategories[cat.ifoodCategoryId] && (
                      <div className="divide-y divide-zinc-100">
                        {cat.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                            <button
                              onClick={() => toggleItem(item.id)}
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-300"
                            >
                              {selectedItems[item.id] && <Check className="h-3 w-3 text-green-600" />}
                            </button>

                            {item.imagePath ? (
                              <img
                                src={item.imagePath}
                                alt={item.name}
                                className="h-12 w-12 shrink-0 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                                <ImageIcon className="h-5 w-5 text-zinc-400" />
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-zinc-900 truncate">{item.name}</p>
                              {item.description && (
                                <p className="text-xs text-zinc-500 truncate">{item.description}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                {item.hasPromotion && (
                                  <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                                    PROMOÇÃO
                                  </span>
                                )}
                                {item.hasOptions && (
                                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                    OPÇÕES
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              {item.hasPromotion ? (
                                <>
                                  <p className="text-xs text-zinc-400 line-through">
                                    {formatCurrency(item.originalPrice)}
                                  </p>
                                  <p className="font-bold text-green-600">{formatCurrency(item.price)}</p>
                                </>
                              ) : (
                                <p className="font-bold text-zinc-900">{formatCurrency(item.price)}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Importing */}
            {step === "importing" && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                <p className="mt-4 text-sm text-zinc-500">Importando {selectedCount} produtos...</p>
                <p className="text-xs text-zinc-400">Baixando imagens e criando categorias</p>
              </div>
            )}

            {/* Done */}
            {step === "done" && results && (
              <div className="space-y-4">
                <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
                  <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
                  <h3 className="mt-3 text-lg font-bold text-green-800">Importação Concluída!</h3>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg border border-zinc-200 bg-white p-4 text-center">
                    <Package className="mx-auto h-6 w-6 text-green-600" />
                    <p className="mt-2 text-2xl font-bold text-zinc-900">{results.created}</p>
                    <p className="text-xs text-zinc-500">Produtos criados</p>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-white p-4 text-center">
                    <ImageIcon className="mx-auto h-6 w-6 text-blue-600" />
                    <p className="mt-2 text-2xl font-bold text-zinc-900">{results.imagesDownloaded}</p>
                    <p className="text-xs text-zinc-500">Imagens baixadas</p>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-white p-4 text-center">
                    <AlertTriangle className="mx-auto h-6 w-6 text-amber-500" />
                    <p className="mt-2 text-2xl font-bold text-zinc-900">{results.imagesFailed}</p>
                    <p className="text-xs text-zinc-500">Imagens com falha</p>
                  </div>
                </div>

                {results.errors.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-700 mb-2">Erros encontrados:</p>
                    <ul className="space-y-1">
                      {results.errors.map((err, i) => (
                        <li key={i} className="text-xs text-amber-600">• {err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-zinc-200 px-6 py-4">
            {step === "review" && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500">
                  {selectedCount} itens selecionados
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onClose}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={selectedCount === 0}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Importar {selectedCount} produtos
                  </Button>
                </div>
              </div>
            )}

            {step === "done" && (
              <div className="flex justify-end">
                <Button onClick={onClose}>Fechar</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
