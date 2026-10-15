/**
 * Imprime HTML em popup sem usar document.write (F6A-015).
 * O HTML vai como Blob URL (mesma origem → onload/print/afterprint funcionam).
 * Mantém o comportamento atual: popup bloqueado → alert; imprime e fecha.
 */
export function printHtmlPopup(
  html: string,
  blockedMessage = "Permita pop-ups para imprimir o cupom"
): boolean {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, "_blank")
  if (!win) {
    URL.revokeObjectURL(url)
    alert(blockedMessage)
    return false
  }
  win.onload = () => {
    win.onafterprint = () => {
      try {
        win.close()
      } catch {}
      URL.revokeObjectURL(url)
    }
    win.focus()
    win.print()
  }
  // Fallback: revoga a URL se o diálogo nunca fechar (janela deixada aberta)
  setTimeout(() => URL.revokeObjectURL(url), 120000)
  return true
}
