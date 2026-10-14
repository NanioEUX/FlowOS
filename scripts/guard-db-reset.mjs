// Guarda do db:reset (auditoria H1#12 / F4C-027): só roda com DB_ALLOW_RESET=1,
// para nunca apagar acidentalmente o banco de produção.
if (process.env.DB_ALLOW_RESET !== "1") {
  console.error(
    "[guard-db-reset] db:reset BLOQUEADO.\n" +
      "  Só use em ambiente de teste, com:\n" +
      "    DB_ALLOW_RESET=1 npm run db:reset\n" +
      "  Nunca rode force-reset contra o banco de produção."
  )
  process.exit(1)
}
console.log("[guard-db-reset] DB_ALLOW_RESET=1 — seguindo com reset...")
