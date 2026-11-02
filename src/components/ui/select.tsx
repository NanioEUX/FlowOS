import { forwardRef, useId, type SelectHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  /** Opções fixas (alternativa a `children`). */
  options?: { value: string; label: string }[]
  /** Placeholder automático. `null` remove a opção vazia. */
  placeholder?: string | null
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, options, placeholder = "Selecione...", children, ...props }, ref) => {
    // F8D-008: rótulo sempre associado ao campo, mesmo sem `id` explícito.
    const generatedId = useId()
    const fieldId = id || generatedId

    // F8C-014: sem rótulo/erro o wrapper não é renderizado — adoption de
    // `<select>` cru por `<Select>` não quebra layout flex/grid.
    const select = (
      <select
        ref={ref}
        id={fieldId}
        className={cn(
          "flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 focus:border-green-600 focus:outline-none disabled:opacity-50",
          "dark:border-white/[.12] dark:bg-white/[.03] dark:text-flow-white dark:focus:border-flow-blue",
          error && "border-red-500",
          className
        )}
        {...props}
      >
        {placeholder !== null && <option value="">{placeholder}</option>}
        {options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
        {children}
      </select>
    )

    if (!label && !error) return select

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={fieldId} className="block text-sm font-medium text-zinc-700 dark:text-zinc-400">
            {label}
          </label>
        )}
        {select}
        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
      </div>
    )
  }
)
Select.displayName = "Select"
