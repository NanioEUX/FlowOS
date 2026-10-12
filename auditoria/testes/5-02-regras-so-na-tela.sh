#!/usr/bin/env bash
# Fase 5 — Teste ESTÁTICO (só grep no código-fonte). NÃO faz rede, NÃO toca em banco.
# Pode ser executado em qualquer ambiente.
# Semântica: [CONFIRMADO] = a evidência do achado foi encontrada no código;
#            [REVER]     = o guard correspondente EXISTE (achado não reproduzível por grep).
set -u
cd "$(dirname "$0")/../.." || exit 1

conf=0; rev=0

confirmar() { # confirmar <desc> <arquivo> <regex que prova o achado>
  local desc="$1" file="$2" expr="$3"
  if [ -n "$file" ] && [ -f "$file" ] && grep -qE "$expr" "$file"; then
    echo "  [CONFIRMADO] $desc"; conf=$((conf+1))
  else
    echo "  [REVER]      $desc"; rev=$((rev+1))
  fi
}

ausente() { # ausente <desc> <arquivo> <regex do GUARD que deveria existir>
  local desc="$1" file="$2" expr="$3"
  if [ -n "$file" ] && [ -f "$file" ] && grep -qE "$expr" "$file"; then
    echo "  [REVER]      $desc (guard existe)"; rev=$((rev+1))
  else
    echo "  [CONFIRMADO] $desc (guard ausente)"; conf=$((conf+1))
  fi
}

echo "== Fase 5 — regras de negócio só na tela / ausência de guarda no servidor =="
echo "-- 5.1 pedidos --"
ausente "F5A-002 whitelist de transições de status" "src/app/api/orders/[id]/route.ts" 'allowedTransitions|VALID_TRANSITIONS|canTransition'
ausente "F5D-008 checagem de role no PATCH"        "src/app/api/orders/[id]/route.ts" 'auth\.(role|user)|role ===|role !=='
ausente "F5A-009 estorno quando o pagamento falha (order.delete)" "src/app/api/orders/route.ts" 'restoreOrderStock'
awk 'NR>=706 && NR<=713' src/app/api/orders/route.ts | grep -q isScheduled \
  && { echo "  [REVER]      F5A-031 expurgo considera isScheduled"; rev=$((rev+1)); } \
  || { echo "  [CONFIRMADO] F5A-031 expurgo de abandoned ignora isScheduled"; conf=$((conf+1)); }

echo "-- 5.2 cardápio --"
ausente "F5B-024 cupom validado (usageLimit/available)"   "src/app/api/orders/route.ts" 'usageLimit|coupon\.available'
ausente "F5B-031 canal vs availableOnline/Presencial"    "src/app/api/orders/route.ts" 'availableOnline|availablePresencial|availableWhatsapp'
ausente "F5B-032 limites minSelection/maxSelection"      "src/app/api/orders/route.ts" 'minSelection|maxSelection'
if sed -n '/^model Product /,/^}/p' prisma/schema.prisma | grep -qiE 'availableFrom|availableUntil|scheduleStart|scheduleEnd'; then
  echo "  [REVER]      F5B-030 janela de horário por produto"; rev=$((rev+1))
else
  echo "  [CONFIRMADO] F5B-030 sem janela de horário por produto no model Product"; conf=$((conf+1))
fi
ausente "F5B-013 subtotal a partir do banco (não i.price)" "src/app/api/orders/route.ts" 'product\.findMany.*items|dbPrice|serverPrice'

echo "-- 5.4 caixa --"
ausente "F5B-022 fechamento exige canCloseRegister/papel" "src/app/api/cash-register/[id]/route.ts" 'canCloseRegister|role'
ausente "F5B-027 status=open + closingAmount obrigatório" "src/app/api/cash-register/[id]/route.ts" 'status !== "open"|closingAmount === (null|undefined)'
ausente "F5B-028 whitelist de type de movimento"          "src/app/api/cash-register/[id]/movements/route.ts" 'VALID_TYPES|allowedTypes|includes\(type'
ausente "F5B-038 operador registrado (currentUserId)"     "src/app/api/cash-register/route.ts" 'currentUserId|openedBy'
if grep -qiE 'nfe|nfce|satCodigo|cnpjTomador' prisma/schema.prisma; then
  echo "  [REVER]      F5B-035 campos fiscais (NFC-e/SAT) existem"; rev=$((rev+1))
else
  echo "  [CONFIRMADO] F5B-035 nenhum campo fiscal no schema"; conf=$((conf+1))
fi
if grep -qiE '\btip\b|gorjeta|gratuity' prisma/schema.prisma; then
  echo "  [REVER]      F5B-036 gorjeta existe no schema"; rev=$((rev+1))
else
  echo "  [CONFIRMADO] F5B-036 nenhuma gorjeta (tip) no schema"; conf=$((conf+1))
fi

echo "-- 5.5 estoque --"
if grep -qE 'newQty < 0|quantity < 0' src/lib/stock.ts; then
  echo "  [REVER]      F5A-020 piso de estoque em lib/stock.ts"; rev=$((rev+1))
else
  echo "  [CONFIRMADO] F5A-020 sem piso de estoque em lib/stock.ts"; conf=$((conf+1))
fi
ausente "F5A-022 estorno no ramo 'abandoned'" "src/app/api/orders/route.ts" 'restoreOrderStock'

echo "-- 5.6 financeiro --"
ausente "F5A-018 DRE inclui CMV"              "src/app/api/financial/dre/route.ts" 'cmv|custoDeMercadoria|orderItemCost'
ausente "F5A-019 DRE filtra paymentStatus=paid" "src/app/api/financial/dre/route.ts" 'paymentStatus.*paid'
ausente "F5A-039 descontos de cupom calculados (não comentados)" "src/app/api/financial/dre/route.ts" '^[^/]*couponsDiscount \+='
confirmar "F5A-044 agrupamento diário em UTC (toISOString)" "src/app/api/financial/cash-flow/route.ts" 'toISOString'
if grep -q 'amount: -' src/app/api/expenses/route.ts; then
  echo "  [REVER]      F5A-015 despesa grava valor negativo"; rev=$((rev+1))
else
  echo "  [CONFIRMADO] F5A-015 despesa grava cashMovement.amount positivo"; conf=$((conf+1))
fi

echo "-- 5.8 assinatura/planos --"
ausente "F5C-003 assinatura no subscription/webhook" "src/app/api/subscription/webhook/route.ts" 'hmac|timingSafeEqual|signature'
ausente "F5C-012 cron de cobrança no vercel.json"   "vercel.json" 'subscription|billing|charge|cobran'

echo "-- 5.10 Meta --"
ausente "F5C-024 X-Hub-Signature-256 no webhook WhatsApp" "src/app/api/webhooks/whatsapp/route.ts" 'x-hub-signature-256'
ausente "F5C-025 expiração do metaAccessToken"            "prisma/schema.prisma" 'metaAccessTokenExpir|metaTokenExpires'
ausente "F5C-027 reset-ai-usage agendado"                 "vercel.json" 'reset-ai-usage'

echo "-- 5.11 KDS --"
ausente "F5D-003 estado offline/erro no KDS" "src/app/kds/(auth)/screen/page.tsx" 'isOffline|netDown|connectionStatus'
ausente "F5D-004 visibilitychange/Notification" "src/app/kds/(auth)/screen/page.tsx" 'visibilitychange|Notification'
if awk '/async function updateStatus/,/^  }$/' "src/app/kds/(auth)/screen/page.tsx" | grep -q 'res\.ok'; then
  echo "  [REVER]      F5D-012 updateStatus trata res.ok"; rev=$((rev+1))
else
  echo "  [CONFIRMADO] F5D-012 updateStatus não trata res.ok"; conf=$((conf+1))
fi
ausente "F5D-015 Wake Lock / tela cheia" "src/app/kds/(auth)/screen/page.tsx" 'wakeLock|requestFullscreen'
if grep -qi 'station' prisma/schema.prisma; then
  echo "  [REVER]      F5D-014 estação (station) no schema"; rev=$((rev+1))
else
  echo "  [CONFIRMADO] F5D-014 nenhuma estação no schema"; conf=$((conf+1))
fi
if grep -q 'restoreOrderStock' src/app/api/orders/route.ts; then
  echo "  [REVER]      F5D-025 GET com efeito colateral (há estorno)"; rev=$((rev+1))
else
  echo "  [CONFIRMADO] F5A-022/F5D-025 GET roda updateMany 'abandoned' sem estorno"; conf=$((conf+1))
fi

echo
echo "Resultado: $conf achado(s) CONFIRMADO por este script estático · $rev a rever (guard existente/padrão ambíguo)."
echo "obtido = ver acima (executado pelo auditor em $(date +%Y-%m-%d) — somente grep, sem rede/banco)."
echo "Os testes DINÂMICOS (5-01-transicoes-e-estoque.sh) seguem obtido = NÃO EXECUTADO."
