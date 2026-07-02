import { forwardRef, type ButtonHTMLAttributes } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline"
  size?: "sm" | "md" | "lg"
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
          "dark:focus:ring-flow-blue dark:focus:ring-offset-flow-bg",
          {
            "bg-green-600 text-white hover:bg-green-700 dark:bg-gradient-flow dark:hover:brightness-110 dark:shadow-glow-blue dark:focus:ring-flow-blue": variant === "primary",
            "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-white/[.05] dark:text-zinc-300 dark:hover:bg-white/[.08]": variant === "secondary",
            "hover:bg-zinc-100 text-zinc-700 dark:hover:bg-white/[.05] dark:text-zinc-400 dark:hover:text-zinc-200": variant === "ghost",
            "bg-red-600 text-white hover:bg-red-700": variant === "danger",
            "border border-zinc-300 bg-white hover:bg-zinc-50 dark:border-white/[.06] dark:bg-transparent dark:hover:bg-white/[.05] dark:text-zinc-300": variant === "outline",
          },
          {
            "h-8 px-3 text-sm": size === "sm",
            "h-10 px-4 text-sm": size === "md",
            "h-12 px-6 text-base": size === "lg",
          },
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"
