#!/usr/bin/env bash
# Auditoria Fase 9 — SaaS, Produto e Jurídico — validação ESTÁTICA (somente leitura)
# Rodar da RAIZ do projeto: bash auditoria/testes/9-01-produto-juridico-estatico.sh
# NÃO consulta rede nem banco. Só greps/reads no código.

set -u
PASS=0; FAIL=0; SKIP=0

confirmar() { # <descrição> <comando...>
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo "[CONFIRMADO] $desc"; PASS=$((PASS+1))
  else
    echo "[FALHOU] $desc"; FAIL=$((FAIL+1))
  fi
}

ausente() { # <descrição> <comando...> — confirma que NÃO existe (grep vazio / sem match)
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo "[FALHOU] $desc (encontrado, esperado ausente)"; FAIL=$((FAIL+1))
  else
    echo "[CONFIRMADO] $desc"; PASS=$((PASS+1))
  fi
}

nao_existe() { # <descrição> <caminho>
  local desc="$1" path="$2"
  if [ -e "$path" ]; then
    echo "[FALHOU] $desc (existe: $path)"; FAIL=$((FAIL+1))
  else
    echo "[CONFIRMADO] $desc"; PASS=$((PASS+1))
  fi
}

echo "=== Fase 9 — validação estática (somente leitura) ==="

# --- 9.1 Cadastro / onboarding ---
confirmar "F9A-001 POST /api/establishments não tem verifyAuth" \
  bash -c '! grep -q "verifyAuth" src/app/api/establishments/route.ts'
confirmar "F9A-001 cadastro público grava trial 7d" \
  grep -q 'trialEnds' src/app/api/establishments/route.ts
confirmar "F9A-002 não há página/rota de onboarding pós-cadastro" \
  bash -c '[ -z "$(ls src/app | grep -i onboarding)" ] && ! grep -riq "onboarding" src/app --include="*.tsx"'
confirmar "F9A-003 POST establishments devolve establishment completo sem select no create" \
  bash -c 'grep -A2 "prisma.establishment.create" src/app/api/establishments/route.ts | head -1 | grep -q "create" && grep -q "return NextResponse.json({ establishment" src/app/api/establishments/route.ts'
confirmar "F9A-004 delivery-persons GET sem verifyAuth" \
  bash -c 'sed -n "1,27p" src/app/api/delivery-persons/route.ts | grep -q "export async function GET" && ! sed -n "1,27p" src/app/api/delivery-persons/route.ts | grep -q "verifyAuth"'
confirmar "F9A-004 senha default 123456 em delivery-persons" \
  grep -q 'defaultPassword || "123456"' src/app/api/delivery-persons/route.ts
confirmar "F9A-004 retorna defaultPassword em claro" \
  grep -q 'defaultPassword: password' src/app/api/delivery-persons/route.ts
confirmar "F9A-005 localStorage grava establishment.id como id" \
  grep -q 'id: data.establishment.id' src/app/cadastro/page.tsx

# --- 9.2 Multi-loja / permissões ---
confirmar "F9A-006 users POST aceita role do body" \
  grep -q 'role: role || "atendente"' src/app/api/users/route.ts
confirmar "F9A-006 users PATCH aceita body.role" \
  grep -q 'if (body.role) data.role = body.role' "src/app/api/users/[id]/route.ts"
confirmar "F9A-007 admin-saas comissão PATCH sem verifyAuth" \
  bash -c '! grep -q "verifyAuth" "src/app/admin-saas/(auth)/estabelecimentos/[id]/api/route.ts"'
confirmar "F9A-008 sem seletor multi-loja (grep vazio)" \
  bash -c '! grep -riq "trocar.*loja\|meus estabelecimentos\|switch.*estabelecimento" src/app --include="*.tsx"'
confirmar "F9A-009 POST orders sem checar subscriptionStatus" \
  bash -c '! grep -q "subscriptionStatus" src/app/api/orders/route.ts'

# --- 9.3 Planos / cobrança ---
confirmar "F9B-001 subscription/webhook sem verifyAuth" \
  bash -c '! grep -q "verifyAuth\|asaas-access-token\|signature\|hmac" src/app/api/subscription/webhook/route.ts'
confirmar "F9B-001 webhook grava active a partir do body" \
  grep -q 'subscriptionStatus: "active"' src/app/api/subscription/webhook/route.ts
confirmar "F9B-002 subscription/create sem verifyAuth" \
  bash -c '! grep -q "verifyAuth" src/app/api/subscription/create/route.ts'
confirmar "F9B-002 branch sandbox ativa sem pagamento" \
  grep -q 'Sandbox mode' src/app/api/subscription/create/route.ts
confirmar "F9B-003 planos hardcoded starter 49 no front" \
  grep -q 'starter' "src/app/dashboard/(auth)/planos/page-content.tsx"
confirmar "F9B-003 planos hardcoded starter 49 no back" \
  grep -q 'starter: 49' src/app/api/subscription/create/route.ts
confirmar "F9B-003 sem model Plan/Subscription/Invoice no schema" \
  bash -c '! grep -qE "model (Plan|Subscription|Invoice) " prisma/schema.prisma'
confirmar "F9B-004 cobrança via /payments (não /subscriptions)" \
  grep -q 'ASAAS_API_URL}/payments' src/app/api/subscription/create/route.ts
confirmar "F9B-004 billingType UNDEFINED (não recorrente)" \
  grep -q 'billingType: "UNDEFINED"' src/app/api/subscription/create/route.ts
confirmar "F9B-007 vercel.json só tem 2 crons (sem cron de trial)" \
  bash -c '[ "$(grep -c "path" vercel.json)" = "2" ]'
confirmar "F9B-008 admin-saas planos é Placeholder" \
  grep -q 'Placeholder title="Planos' "src/app/admin-saas/(auth)/planos/page.tsx"

# --- 9.4 Métricas ---
confirmar "F9B-011 checkMonitors hardcoded ok:true" \
  grep -q 'ok: true' "src/app/admin-saas/(auth)/dashboard/page.tsx"
confirmar "F9B-012 sem telemetria de produto (analytics)" \
  bash -c '! grep -riq "posthog\|mixpanel\|umami\|plausible" src --include="*.ts" --include="*.tsx"'
confirmar "F9B-013 admin-saas logs é Placeholder" \
  grep -q 'Placeholder title="Logs' "src/app/admin-saas/(auth)/logs/page.tsx"

# --- 9.5 Suporte ---
confirmar "F9C-001 CTA 'Falar com vendas' aponta só para /cadastro (sem canal de vendas)" \
  bash -c 'grep -q "Falar com vendas" src/app/page.tsx && ! grep -qE "wa.me|mailto:.*venda|calendly|whatsapp" src/app/page.tsx'
confirmar "F9C-002 sem mailto/tel/wa.me de suporte na landing" \
  bash -c '! grep -q "mailto:\|tel:\|wa.me" src/app/page.tsx'
confirmar "F9C-003 sem helpdesk/ticketing (FAQ de marketing na landing é estático)" \
  bash -c '! grep -riq "helpdesk\|ticketing\|zendesk\|freshdesk\|intercom" src/app --include="*.tsx" --include="*.ts"'
confirmar "F9C-003 FAQ da landing é array estático (não base de conhecimento)" \
  grep -q 'const faq = \[' src/app/page.tsx

# --- 9.6 Jurídico ---
confirmar "F9C-004 sem página de termos de uso" \
  bash -c '[ -z "$(ls src/app 2>/dev/null | grep -i termo)" ]'
confirmar "F9C-004 sem string termos-de-uso em src" \
  bash -c '! grep -riq "termos-de-uso\|terms-of-service\|termsOfUse" src --include="*.ts" --include="*.tsx"'
confirmar "F9C-005 cadastro sem checkbox de aceite" \
  bash -c '! grep -qi "termsAccepted\|aceite.*termos\|checkbox.*termo" src/app/cadastro/page.tsx'
confirmar "F9C-005 schema sem campos de consentimento" \
  bash -c '! grep -q "termsAccepted\|acceptedTerms\|consent" prisma/schema.prisma'
confirmar "F9C-006 sem doc DPA/subprocessor" \
  bash -c '[ -z "$(ls docs 2>/dev/null | grep -iE "dpa|subproc|privacy|lgpd")" ] && [ ! -f DPA.md ]'
confirmar "F9C-007 política de privacidade existe mas é órfã (0 links internos)" \
  bash -c '[ -f src/app/politica-de-privacidade/page.tsx ] && [ "$(grep -rl "politica-de-privacidade" src/app --include="*.tsx" | grep -v politica-de-privacidade/page | wc -l | tr -d " ")" = "0" ]'

# --- 9.7 Offboarding ---
confirmar "F9C-010 sem endpoint de exportação de dados" \
  bash -c '! grep -riq "export.*dados\|exportar dados\|portability" src/app/api --include="*.ts"'
confirmar "F9C-011 sem cancelamento de assinatura" \
  bash -c '! grep -riq "cancelar assinatura\|cancel subscription\|cancelar conta" src --include="*.ts" --include="*.tsx"'
confirmar "F9C-012 establishments [id] só tem GET e PATCH (sem DELETE)" \
  bash -c '[ "$(grep -c "export async function" "src/app/api/establishments/[id]/route.ts")" = "2" ] && ! grep -q "export async function DELETE" "src/app/api/establishments/[id]/route.ts"'
confirmar "F9C-012 sem prisma.establishment.delete em src" \
  bash -c '! grep -rq "establishment.delete" src --include="*.ts"'
confirmar "F9C-012 sem prisma.customer.delete em src" \
  bash -c '! grep -rq "customer.delete" src --include="*.ts"'

# --- 9.8 Terceiros ---
confirmar "F9D-001 PAN/CVV processados em asaas/card" \
  bash -c 'grep -q "creditCardNumber" src/app/api/payments/asaas/card/route.ts && grep -q "creditCardCvv" src/app/api/payments/asaas/card/route.ts'
confirmar "F9D-002 webhook efi sem assinatura" \
  bash -c '! grep -qi "signature\|hmac\|verifyAuth" src/app/api/webhooks/efi/route.ts'
confirmar "F9D-002 webhook whatsapp sem assinatura" \
  bash -c '[ ! -f src/app/api/webhooks/whatsapp/route.ts ] || ! grep -qi "signature\|hmac\|verifyAuth" src/app/api/webhooks/whatsapp/route.ts'
confirmar "F9D-003 pagarme-config lê SystemConfig" \
  grep -q 'SystemConfig' src/lib/pagarme-config.ts
confirmar "F9D-004 iFood usa IFOOD_CLIENT_ID global de env" \
  grep -q 'IFOOD_CLIENT_ID' src/app/api/orders/ifood-poll/route.ts
confirmar "F9D-005 nine-food-status com comentário de API especulativa" \
  grep -q 'Will be refined once we receive actual API documentation' src/lib/integrations/nine-food-status.ts
confirmar "F9D-006 sem AbortSignal/timeouts em integrations" \
  bash -c '! grep -rq "AbortSignal\|signal:" src/lib/integrations --include="*.ts"'
confirmar "F9D-007 sem circuit breaker" \
  bash -c '! grep -riq "circuit.breaker\|CircuitBreaker" src --include="*.ts"'

# --- 9.9 Fiscal ---
confirmar "F9D-010 sem CFOP/NFe/NFSe/DANFE/SPED reais em src" \
  bash -c '! grep -rqE "\bCFOP\b|NF-e|NFe |DANFE|SPED|NFSe" src --include="*.ts" --include="*.tsx" | grep -vi "permission\|commission" | head -1 | grep -q .'
# simpler check:
confirmar "F9D-010 grep fiscal vazio (com filtro)" \
  bash -c '[ -z "$(grep -rE "CFOP|NFe|DANFE|SPED|NFSe|certificado digital" src --include="*.ts" --include="*.tsx" 2>/dev/null | grep -viE "permission|commission|meta|debug" | head -1)" ]'
confirmar "F9D-011 sem geração de recibo/nfse no produto" \
  bash -c '! grep -riq "nfse\|danfe\|recibo" src/app --include="*.ts" --include="*.tsx"'

echo ""
echo "=== Resultado: $PASS CONFIRMADO, $FAIL FALHOU, $SKIP ignorado ==="
[ "$FAIL" -eq 0 ] || exit 1
exit 0
