"use client"

import { useEffect, useCallback, useId, useRef, useState } from "react"
import { AlertTriangle, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "warning"
  confirmed?: boolean
  successTitle?: string
  successMessage?: string
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
  confirmed = false,
  successTitle,
  successMessage,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const baseId = useId()
  const titleId = `${baseId}-title`
  const messageId = `${baseId}-message`

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirmed && !busy) {
        onCancel()
        return
      }
      if (e.key !== "Tab") return

      // F8D-017: mantém o foco dentro do diálogo.
      const node = dialogRef.current
      if (!node) return
      const focusables = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    },
    [onCancel, confirmed, busy]
  )

  // F8D-017: move o foco para o diálogo ao abrir e devolve ao gatilho ao fechar.
  useEffect(() => {
    if (!open) return
    previousFocusRef.current = document.activeElement as HTMLElement
    const node = dialogRef.current
    const focusable = node?.querySelector<HTMLElement>(FOCUSABLE)
    ;(focusable || node)?.focus()

    return () => {
      previousFocusRef.current?.focus?.()
    }
  }, [open])

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown)
      return () => document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open, handleKeyDown])

  // F8C-005: trava a re-entrância enquanto a ação do "Confirmar" está em curso.
  const handleConfirm = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const result = onConfirm()
      if (result && typeof (result as Promise<void>).then === "function") {
        await result
      }
    } catch (err) {
      console.error("[ConfirmDialog] onConfirm falhou:", err)
    } finally {
      setBusy(false)
    }
  }, [busy, onConfirm])

  if (!open) return null

  if (confirmed) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <CheckCircle aria-hidden="true" className="h-5 w-5 text-green-600" />
            </div>
            <h3 id={titleId} className="text-lg font-semibold text-zinc-900">
              {successTitle || title}
            </h3>
          </div>
          {successMessage && <p className="mb-2 text-sm text-zinc-600">{successMessage}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex={-1}
        className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              variant === "danger" ? "bg-red-100" : "bg-amber-100"
            }`}
          >
            <AlertTriangle
              aria-hidden="true"
              className={`h-5 w-5 ${
                variant === "danger" ? "text-red-600" : "text-amber-600"
              }`}
            />
          </div>
          <h3 id={titleId} className="text-lg font-semibold text-zinc-900">
            {title}
          </h3>
        </div>
        <p id={messageId} className="mb-6 text-sm text-zinc-600">
          {message}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            className="flex-1"
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? "Processando..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
