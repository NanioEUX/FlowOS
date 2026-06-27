"use client"

import { useEffect, useCallback } from "react"
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

type DialogStatus = "idle" | "loading" | "success"

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "warning"
  status?: DialogStatus
  successTitle?: string
  successMessage?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
  status = "idle",
  successTitle,
  successMessage,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && status === "idle") onCancel()
    },
    [onCancel, status]
  )

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown)
      return () => document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open, handleKeyDown])

  if (!open) return null

  if (status === "loading") {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50">
        <div className="mx-4 w-full max-w-md rounded-xl bg-white p-8 shadow-xl">
          <div className="flex flex-col items-center">
            <Loader2 className="mb-4 h-12 w-12 text-green-500 animate-spin" />
            <p className="text-lg font-semibold text-zinc-900">Processando...</p>
          </div>
        </div>
      </div>
    )
  }

  if (status === "success") {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50">
        <div className="mx-4 w-full max-w-md rounded-xl bg-white p-8 shadow-xl">
          <div className="flex flex-col items-center">
            <CheckCircle className="mb-4 h-12 w-12 text-green-500" />
            <p className="text-lg font-bold text-zinc-900">{successTitle || title}</p>
            {successMessage && <p className="mt-1 text-sm text-zinc-500">{successMessage}</p>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              variant === "danger" ? "bg-red-100" : "bg-amber-100"
            }`}
          >
            <AlertTriangle
              className={`h-5 w-5 ${
                variant === "danger" ? "text-red-600" : "text-amber-600"
              }`}
            />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
        </div>
        <p className="mb-6 text-sm text-zinc-600">{message}</p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            className="flex-1"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
