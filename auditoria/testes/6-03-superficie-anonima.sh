#!/usr/bin/env bash
# Fase 6.1/6.6 — Superfície anônima do cardápio (lista e escrita sem credencial)
#
# Alvos: F6A-004/005 (payment-request PATCH/GET), F6A-006/007 (customers),
#        F6A-008 (orders/customer), F6A-016/035 (pix-generate),
#        F6A-019 (daily-combos), F6A-020 (table-status), F6A-022 (reviews),
#        F6A-027 (push/subscribe), F6A-034 (dispatch-99), F6A-036 (push/order-details),
#        F6A-037 (cash-register), F6A-039 (expenses), F6A-043 (delivery-payments).
#
# NÃO EXECUTADO durante a auditoria (regra 4/2.5).
# Separado em LEITURA (apenas GET) e ESCRITA (POST/PATCH — somente ambiente de teste).
#
# Esperado: 401/403 em todas.
# Obtido  : NÃO EXECUTADO.

set -uo pipefail
BASE="${BASE_URL:-http://localhost:3000}"
ESTAB="${ESTAB_ID:?defina ESTAB_ID}"
passou=0; falhou=0

checar () { # $1 = metodo, $2 = rota, $3 = corpo
  codigo=$(curl -s -o /tmp/f6-superf.json -w '%{http_code}' -X "$1" "$BASE$2" \
    -H "Content-Type: application/json" --data "${3:-{\}}" )
  if printf '%s' "$codigo" | grep -Eq '^(401|403)$'; then
    echo "OK   [$codigo] $1 $2"; passou=$((passou+1))
  else
    echo "FALHA [$codigo] $1 $2 — anônimo obteve acesso"; falhou=$((falhou+1))
  fi
}

echo "=== LEITURA (deve ser 401/403) ==="
checar GET "/api/customers?establishmentId=$ESTAB&phone=00000000000"
checar GET "/api/orders/customer?phone=00000000000&establishmentId=$ESTAB"
checar GET "/api/payment-request?establishmentId=$ESTAB"
checar GET "/api/categories?establishmentId=$ESTAB"
checar GET "/api/products/featured?establishmentId=$ESTAB"
checar GET "/api/reviews?establishmentId=$ESTAB"
checar GET "/api/table-status?slug=inexistente-f6"
checar GET "/api/push/order-details?establishmentId=$ESTAB&phone=00000000000"
checar GET "/api/cash-register?establishmentId=$ESTAB"
checar GET "/api/expenses?establishmentId=$ESTAB"
checar GET "/api/suppliers?establishmentId=$ESTAB"
checar GET "/api/delivery-payments?establishmentId=$ESTAB"
checar GET "/api/partial-payment?establishmentId=$ESTAB"
checar GET "/api/daily-combos?establishmentId=$ESTAB"
checar GET "/api/stock?establishmentId=$ESTAB"

echo
echo "=== ESCRITA (somente ambiente de teste) ==="
checar POST "/api/pix-generate" "{\"establishmentId\":\"$ESTAB\",\"amount\":1,\"description\":\"f6\"}"
checar POST "/api/delivery/dispatch-99" '{"orderId":"f6-teste"}'
checar POST "/api/payment-request" "{\"tableNumber\":9999,\"establishmentId\":\"$ESTAB\"}"
checar PATCH "/api/payment-request" "{\"tableNumber\":9999,\"establishmentId\":\"$ESTAB\",\"paymentMethod\":\"cash\"}"
checar POST "/api/cash-register" "{\"establishmentId\":\"$ESTAB\"}"
checar POST "/api/expenses" "{\"description\":\"f6\",\"amount\":1,\"establishmentId\":\"$ESTAB\"}"
checar POST "/api/suppliers" "{\"name\":\"f6\",\"establishmentId\":\"$ESTAB\"}"
checar POST "/api/daily-combos" "{\"name\":\"f6\",\"establishmentId\":\"$ESTAB\"}"
checar POST "/api/delivery-payments" "{\"establishmentId\":\"$ESTAB\"}"
checar POST "/api/push/subscribe" "{\"endpoint\":\"https://example.invalid/p\",\"keys\":{\"p256dh\":\"x\",\"auth\":\"y\"},\"customerId\":\"f6\",\"phone\":\"00000000000\",\"establishmentId\":\"$ESTAB\"}"
checar POST "/api/reviews" "{\"establishmentId\":\"$ESTAB\",\"rating\":5,\"comment\":\"f6\",\"customerName\":\"f6\"}"

echo
echo "=== Negações esperadas sem corpo (deve ser 400/401, nunca 200) ==="
checar POST "/api/delivery-persons" '{}'

echo
echo "Resultado: $passou OK · $falhou FALHA"
echo "Obtido: NÃO EXECUTADO"
