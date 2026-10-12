#!/usr/bin/env bash
# Fase 4 — Confiabilidade: testes ESTÁTICOS (grep no código). Seguros: não tocam rede/banco.
# Uso: bash 4-01-confiabilidade-estatico.sh   (rodar na raiz do projeto)
# Semântica: [CONFIRMADO] = evidência do achado encontrada; [REVER] = guarda/ausência inesperada.
set -u
OK=0; FAIL=0; REV=0
confirmar() { # confirmar "descrição" "arquivo" "padrão"
  local desc="$1" arq="$2" pad="$3"
  if [ ! -e "$arq" ]; then echo "[REVER] $desc — caminho não encontrado: $arq"; REV=$((REV+1)); return; fi
  if grep -rqF -- "$pad" "$arq"; then echo "[CONFIRMADO] $desc"; OK=$((OK+1));
  else echo "[REVER] $desc — padrão ausente em $arq: $pad"; REV=$((REV+1)); fi
}
ausente() { # ausente "descrição" "arquivo" "padrão que NÃO deve existir"
  local desc="$1" arq="$2" pad="$3"
  if [ ! -e "$arq" ]; then echo "[REVER] $desc — caminho não encontrado: $arq"; REV=$((REV+1)); return; fi
  if grep -rqF -- "$pad" "$arq"; then echo "[REVER] $desc — padrão INESPERADO presente em $arq"; REV=$((REV+1));
  else echo "[CONFIRMADO] $desc"; OK=$((OK+1)); fi
}
contar() { # contar "descrição" "n" "regra" "esperado"
  local desc="$1" n="$2" regra="$3" esperado="$4"
  if [ "$regra" = "igual" ] && [ "$n" -eq "$esperado" ]; then echo "[CONFIRMADO] $desc (= $n)"; OK=$((OK+1));
  elif [ "$regra" = "menor_que" ] && [ "$n" -lt "$esperado" ]; then echo "[CONFIRMADO] $desc (< $esperado, veio $n)"; OK=$((OK+1));
  elif [ "$regra" = "maior_que" ] && [ "$n" -gt "$esperado" ]; then echo "[CONFIRMADO] $desc (> $esperado, veio $n)"; OK=$((OK+1));
  else echo "[REVER] $desc — veio $n, esperado $regra $esperado"; REV=$((REV+1)); fi
}
ausente_re() { # ausente_re "descrição" "diretório" "regex extended"
  local desc="$1" dir="$2" re="$3"
  if [ ! -e "$dir" ]; then echo "[REVER] $desc — caminho não encontrado: $dir"; REV=$((REV+1)); return; fi
  if grep -rnE -- "$re" "$dir" >/dev/null 2>&1; then echo "[REVER] $desc — regex INESPERADA presente em $dir"; REV=$((REV+1));
  else echo "[CONFIRMADO] $desc"; OK=$((OK+1)); fi
}
nao_existe() { # nao_existe "descrição" "caminho"
  local desc="$1" arq="$2"
  if [ -e "$arq" ]; then echo "[REVER] $desc — $arq EXISTE"; REV=$((REV+1));
  else echo "[CONFIRMADO] $desc"; OK=$((OK+1)); fi
}

echo "== Fase 4 — confiabilidade/operacao (estatico) =="

# 1) Erros que somem (4.1)
contar "F4A-024 catch vazio em src" "$(grep -rn 'catch {}\|catch { }' src --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')" maior_que 100
confirmar "F4A-001 ifood-webhook responde ok:true mesmo com create_error" "src/app/api/orders/ifood-webhook/route.ts" 'ok: true'
confirmar "F4A-002 asaas processWebhook fire-and-forget" "src/app/api/webhooks/asaas/route.ts" "processWebhook"
confirmar "F4A-005 orders importa deductOrderStock sem restore" "src/app/api/orders/route.ts" "deductOrderStock"
contar "F4A-005 restoreOrderStock NAO importado em orders" "$(grep -c 'restoreOrderStock' src/app/api/orders/route.ts)" igual 0
confirmar "F4A-007 caixa toast de sucesso sem res.ok na transferencia" "src/app/caixa/caixa-page.tsx" "transferida para Mesa"
confirmar "F4A-008 99food-webhook responde ok:true mesmo sem pedido (sem else)" "src/app/api/orders/99food-webhook/route.ts" 'return NextResponse.json({ ok: true, created, updated })'
confirmar "F4A-026 restoreStock engole erro com console.error" "src/lib/stock.ts" "console.error"
ausente_re "F4A-019 nenhum error tracking (sentry/datadog/posthog)" "src" "(?i)sentry|datadog|posthog"
ausente "F4A-019 nenhum global-error.tsx" "src/app" "global-error"
ausente "F4A-025 nenhum error.tsx em src/app" "src/app" "export default function Error"

# 2) Retries/timeouts/circuit breaker (4.2)
contar "F4A-010 apenas 1 AbortSignal.timeout no repo" "$(grep -rn 'AbortSignal.timeout' src --include='*.ts' --include='*.tsx' | wc -l | tr -d ' ')" igual 1
ausente_re "F4A-011 nenhum circuit breaker" "src" "(?i)circuit.?breaker"
ausente_re "F4A-012 ifood-poll sem acknowledge de eventos" "src/app/api/orders/ifood-poll" "(?i)acknowledg"

# 3) Idempotencia de webhooks (4.3)
ausente_re "F4B-019 POST /orders sem idempotencia" "src/app/api/orders/route.ts" "(?i)idempoten|clientRequestId"
ausente_re "F4B-021 nenhum model de Inbox/DeadLetter/WebhookEvent" "prisma/schema.prisma" "(?i)inbox|dead.?letter|webhookevent"
ausente_re "F4B-022 nenhum endpoint de replay de webhooks" "src/app/api" "(?i)replay|reprocess"
ausente_re "F4B-005 webhooks/99 sem verificacao de assinatura" "src/app/api/webhooks/99/route.ts" "(?i)hmac|signature|secret"
ausente_re "F4B-011 webhooks/efi sem autenticacao" "src/app/api/webhooks/efi/route.ts" "(?i)hmac|signature|secret|authorization"
ausente_re "F4B-012 payments/inter/webhook sem autenticacao" "src/app/api/payments/inter/webhook/route.ts" "(?i)hmac|signature|secret"
ausente_re "F4B-013 subscription/webhook sem token" "src/app/api/subscription/webhook/route.ts" "(?i)hmac|signature|secret|token"
confirmar "F4B-030 dispatch-99 chama despacharCorrida99 sem checar corrida existente" "src/app/api/delivery/dispatch-99/route.ts" "despacharCorrida99"
ausente_re "F4B-031 nenhuma trava por pedido (FOR UPDATE / lockVersion)" "prisma/schema.prisma" "(?i)lockVersion"
contar "F4B-031 nenhum SELECT FOR UPDATE no repo" "$(grep -rni 'FOR UPDATE' src prisma --include='*.ts' --include='*.prisma' 2>/dev/null | wc -l | tr -d ' ')" igual 0

# 4) Crons mortos / reconciliacao (4.4)
contar "F4D-007 apenas 2 crons agendados no vercel.json" "$(grep -c '"path"' vercel.json)" igual 2
ausente "F4D-007 sync-payments NAO agendado" "vercel.json" "sync-payments"
ausente "F4D-007 meta-quota NAO agendado" "vercel.json" "meta-quota"
ausente "F4D-007 reset-ai-usage NAO agendado" "vercel.json" "reset-ai-usage"
confirmar "F4A-004 sync-payments usa janela de 15 minutos" "src/app/api/cron/sync-payments/route.ts" "fifteenMinAgo"
ausente_re "F4B-024 payments/sync so cobre asaas (sem pagarme/efi/inter)" "src/app/api/payments/sync/route.ts" "(?i)pagarme|efi|inter"
ausente_re "F4D-015 ifood-webhook sem log persistente (Prisma)" "src/app/api/orders/ifood-webhook/route.ts" "prisma\.(log|create)"

# 5) PDV/KDS degradados (4.6)
ausente_re "F4C-004 nenhum navigator.onLine no repo" "src" "navigator\.onLine"
confirmar "F4C-001 caixa limpa carrinho antes do ACK do servidor" "src/app/caixa/caixa-page.tsx" "setCart([])"
ausente_re "F4C-012 kds-login emite token de 24h sem refresh" "src/app/api/auth/kds-login/route.ts" "(?i)refresh"

# 6) Logs e dados sensiveis (4.8)
confirmar "F4A-013 ifood-webhook loga todos os headers" "src/app/api/orders/ifood-webhook/route.ts" "Object.fromEntries(req.headers)"
confirmar "F4A-014 meta-discover loga tokenData inteiro" "src/app/api/establishments/[id]/meta-discover/route.ts" "Token response:"
confirmar "F4A-016 verification loga codigo de verificacao" "src/app/api/verification/route.ts" "NO PROVIDER"
ausente_re "F4A-018 nenhum logger estruturado (pino/winston)" "package.json" "\"(pino|winston|@sentry)"

# 7) Monitoramento/health (4.9/4.10)
contar "F4A-020 nenhum endpoint /api/health" "$(find src/app/api -iname '*health*' -o -iname '*healthz*' 2>/dev/null | wc -l | tr -d ' ')" igual 0
confirmar "F4D-009 monitores hardcoded ok:true no admin-saas" "src/app/admin-saas/(auth)/dashboard/page.tsx" 'supabase: { ok: true'
ausente_re "F4A-022 nenhuma rota de presenca/heartbeat do KDS" "src/app/api/kds" "(?i)presence|heartbeat"

# 8) CI/CD, testes, env (4.11/4.12)
nao_existe "F4C-022 nenhum .github/workflows" ".github"
nao_existe "F4C-022 nenhum Dockerfile na raiz" "Dockerfile"
nao_existe "F4C-019 nenhum .env.example" ".env.example"
ausente_re "F4C-020 nenhum uso de VERCEL_ENV" "src" "VERCEL_ENV"
ausente_re "F4C-021 nenhuma feature flag" "src" "(?i)featureFlag|FF_[A-Z]"
contar "F4C-038 apenas 6 arquivos de teste no produto" "$(find src -name '*.test.ts' -o -name '*.test.tsx' 2>/dev/null | wc -l | tr -d ' ')" igual 6
confirmar "F4C-023 build nao roda testes" "package.json" '"build": "rm -rf .next && next build"'
confirmar "F4C-027 db:reset usa --force-reset sem guarda" "package.json" "db push --force-reset"

# 9) Runbook/backup/ferramentas destrutivas (4.13)
contar "F4D-001 apenas 2 docs .md de produto (fora .aider/auditoria)" "$(find . -name '*.md' -not -path './node_modules/*' -not -path './auditoria/*' -not -path './.git/*' -not -name '.aider*' 2>/dev/null | wc -l | tr -d ' ')" igual 2
ausente_re "F4D-005 nenhum pg_dump/pg_restore nos scripts" "scripts" "(?i)pg_dump|pg_restore"
contar "F4D-011 contagem de pastas de migration" "$(ls -d prisma/migrations/*/ 2>/dev/null | wc -l | tr -d ' ')" igual 4
nao_existe "F4D-011 sem migration_lock.toml (schema nunca migrou de verdade)" "prisma/migrations/migration_lock.toml"
contar "F4D-011 schema tem ~47 models" "$(grep -c '^model ' prisma/schema.prisma)" maior_que 40
confirmar "F4D-025 delete-all de pedidos em producao" "src/app/api/orders/delete-all/route.ts" "deleteMany"
confirmar "F4D-025 test-dispatch usa getIfoodAuth real (sem sandbox)" "src/app/api/test-dispatch/route.ts" "getIfoodAuth"
confirmar "F4C-035 sw.js forca navigate nos clients" "public/sw.js" "client.navigate"

echo
echo "CONFIRMADO=$OK  REVER=$REV"
[ "$REV" -eq 0 ] && echo "RESULTADO: todos os achados estaticos da Fase 4 confirmados no codigo atual." || echo "RESULTADO: revise os itens [REVER]."
