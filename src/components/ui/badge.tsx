import { cn } from "@/lib/utils"
import type { HTMLAttributes } from "react"

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "success" | "warning" | "danger" | "info" | "default"
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        {
          "bg-flow-green/10 text-flow-green": variant === "success",
          "bg-amber-500/10 text-amber-400": variant === "warning",
          "bg-red-500/10 text-red-400": variant === "danger",
          "bg-flow-blue/10 text-flow-blue": variant === "info",
          "bg-white/[.05] text-zinc-400": variant === "default",
        },
        className
      )}
      {...props}
    />
  )
}
