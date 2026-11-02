/**
 * Imprime HTML em popup sem usar document.write (F6A-015).
 * O HTML vai como Blob URL (mesma origem → onload/print/afterprint funcionam).
 *
 * F8C-016: o popup bloqueado não usa mais `alert()` nativo (bloqueante em
 * tablet de caixa) — quem chama recebe o status e mostra toast + retry.
 */
export type PrintStatus = "printing" | "blocked" | "closed"

export interface PrintOptions {
  /** Mensagem exibida quando o navegador bloqueia o pop-up. */
  blockedMessage?: string
  /** Recebe o andamento: "printing" | "blocked" | "closed". */
  onStatus?: (status: PrintStatus) => void
}

export function printHtmlPopup(html: string, options: PrintOptions = {}): void {
  const { blockedMessage = "Permita pop-ups para imprimir o cupom", onStatus } = options
  const blob = new Blob([html], { type: "text/html;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, "_blank")
  if (!win) {
    URL.revokeObjectURL(url)
    onStatus?.("blocked")
    return
  }
  onStatus?.("printing")
  win.onload = () => {
    win.onafterprint = () => {
      try {
        win.close()
      } catch {}
      URL.revokeObjectURL(url)
      onStatus?.("closed")
    }
    win.focus()
    win.print()
  }
  // Fallback: revoga a URL se o diálogo nunca fechar (janela deixada aberta)
  setTimeout(() => URL.revokeObjectURL(url), 120000)
}
