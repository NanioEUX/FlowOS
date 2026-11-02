import { forwardRef, useId, type InputHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    // F8D-008: sem `id` explícito o rótulo ficava sem vínculo com o campo.
    const generatedId = useId()
    const inputId = id || generatedId

    // F8C-014: o wrapper (rótulo + campo + erro) só é renderizado quando há
    // rótulo ou erro. Sem isso, trocar um `<input>` cru do dashboard por
    // `<Input>` inseria uma `<div>` no meio de layouts `flex`/`grid` e
    // quebrava a largura do campo — adoption sem wrapper = DOM idêntico.
    const input = (
      <input
        ref={ref}
        id={inputId}
        className={cn(
          // F8C-014: classes canônicas do dashboard (era a mesma className
          // copiada ~70× pelo dashboard — ver F8C-014 no RELATORIO-FINAL).
          "flex h-10 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-500 focus:border-green-600 focus:outline-none disabled:opacity-50",
          "dark:border-white/[.12] dark:bg-white/[.03] dark:text-flow-white dark:placeholder:text-zinc-500 dark:focus:border-flow-blue dark:backdrop-blur-xl",
          error && "border-red-500",
          className
        )}
        {...props}
      />
    )

    if (!label && !error) return input

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-zinc-700 dark:text-zinc-400">
            {label}
          </label>
        )}
        {input}
        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
      </div>
    )
  }
)
Input.displayName = "Input"
