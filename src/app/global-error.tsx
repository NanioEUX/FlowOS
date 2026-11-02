"use client"

/**
 * F8B-003: fallback do próprio layout raiz (html/body). Precisa renderizar
 * `<html>` e `<body>` porque substitui a árvore completa.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#ffffff", color: "#18181b" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "24px", textAlign: "center" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 600, margin: 0 }}>Aplicação indisponível</h1>
          <p style={{ fontSize: "14px", color: "#52525b", margin: 0, maxWidth: "420px" }}>
            Ocorreu um erro inesperado ao carregar o FlowOS. Recarregue a página para continuar.
          </p>
          <button
            onClick={() => reset()}
            style={{ background: "#16a34a", color: "#fff", border: 0, borderRadius: "8px", padding: "10px 16px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}
          >
            Recarregar
          </button>
        </div>
      </body>
    </html>
  )
}
