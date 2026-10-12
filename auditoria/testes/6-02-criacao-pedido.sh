#!/usr/bin/env bash
# Fase 6.3/6.6 — Regras de negócio da criação de pedido (POST /api/orders)
#
# Alvos: F6B-001 (body.status/body.method), F6B-002 (fidelidade do body),
#        F6B-003 (produto de outra loja / indisponível), F6B-004 (loja fechada),
#        F6B-006 (idempotência), F6A-023 (availableOnline ignorado),
#        F6A-024 (loja suspensa), F6B-013 (cupom cru), F6B-018 (agendamento cru),
#        F1C-201/202 (preço e desconto do body).
#
# NÃO EXECUTADO durante a auditoria (DATABASE_URL = produção).
# => SCRIPT DESTRUTIVO: cria pedidos reais. RODAR SOMENTE em ambiente de teste.
#
# Esperado: 400/409/422 em todos os casos abaixo (servidor como fonte de verdade).
# Obtido  : NÃO EXECUTADO.

set -uo pipefail
BASE="${BASE_URL:-http://localhost:3000}"
ESTAB="${ESTAB_ID:?defina ESTAB_ID}"
OUTRO="${OUTRO_ESTAB_ID:?defina OUTRO_ESTAB_ID (segundo tenant)}"
PROD="${PROD_ID:?defina PROD_ID (produto do ESTAB)}"
PROD_OUTRO="${PROD_OUTRO_ID:?defina PROD_OUTRO_ID (produto do OUTRO)}"
passou=0; falhou=0

POST () { # $1 = nome, $2 = json
  codigo=$(curl -s -o /tmp/f6-order.json -w '%{http_code}' -X POST "$BASE/api/orders" \
    -H "Content-Type: application/json" --data "$2")
  if printf '%s' "$codigo" | grep -Eq '^(400|401|403|409|422)$'; then
    echo "OK   [$codigo] $1"; passou=$((passou+1))
  else
    echo "FALHA [$codigo] $1 — servidor aceitou regra inválida"
    head -c 300 /tmp/f6-order.json; echo; falhou=$((falhou+1))
  fi
}

HOJE=$(date -u +%Y-%m-%d)

echo "=== 1. Preço adulterado (F1C-201) — item 90% mais barato ==="
POST "preço do body ignorado" "{\"establishmentId\":\"$ESTAB\",\"orderType\":\"delivery\",\"paymentMethod\":\"cash\",\"method\":\"site\",\"customer\":{\"name\":\"Auditor\",\"phone\":\"00000000000\",\"address\":\"Rua X 1\",\"city\":\"Sao Paulo\",\"state\":\"SP\",\"zip\":\"00000-000\"},\"items\":[{\"productId\":\"$PROD\",\"name\":\"Item\",\"quantity\":1,\"price\":0.01,\"options\":[]}],\"subtotal\":0.01,\"total\":0.01,\"deliveryFee\":0,\"deliveryDiscount\":0,\"couponDiscount\":0,\"loyaltyDiscount\":0,\"firstPurchaseDiscount\":0}"

echo
echo "=== 2. body.status (F6B-001) — tentar entrar já 'delivered' ==="
POST "status vindo do body" "{\"establishmentId\":\"$ESTAB\",\"orderType\":\"delivery\",\"paymentMethod\":\"cash\",\"method\":\"whatsapp\",\"status\":\"delivered\",\"customer\":{\"name\":\"Auditor\",\"phone\":\"00000000000\",\"address\":\"Rua X 1\",\"city\":\"Sao Paulo\",\"state\":\"SP\",\"zip\":\"00000-000\"},\"items\":[{\"productId\":\"$PROD\",\"name\":\"Item\",\"quantity\":1,\"price\":10,\"options\":[]}],\"subtotal\":10,\"total\":10}"

echo
echo "=== 3. Produto de OUTRO tenant (F6B-003) ==="
POST "produto cross-tenant" "{\"establishmentId\":\"$ESTAB\",\"orderType\":\"delivery\",\"paymentMethod\":\"cash\",\"method\":\"site\",\"customer\":{\"name\":\"Auditor\",\"phone\":\"00000000000\",\"address\":\"Rua X 1\",\"city\":\"Sao Paulo\",\"state\":\"SP\",\"zip\":\"00000-000\"},\"items\":[{\"productId\":\"$PROD_OUTRO\",\"name\":\"Alheio\",\"quantity\":1,\"price\":10,\"options\":[]}],\"subtotal\":10,\"total\":10}"

echo
echo "=== 4. Fidelidade sem saldo (F6B-002) ==="
POST "loyaltyDiscount sem saldo" "{\"establishmentId\":\"$ESTAB\",\"orderType\":\"delivery\",\"paymentMethod\":\"cash\",\"method\":\"site\",\"customer\":{\"name\":\"Auditor\",\"phone\":\"00000000000\",\"address\":\"Rua X 1\",\"city\":\"Sao Paulo\",\"state\":\"SP\",\"zip\":\"00000-000\"},\"items\":[{\"productId\":\"$PROD\",\"name\":\"Item\",\"quantity\":1,\"price\":10,\"options\":[]}],\"subtotal\":10,\"total\":10,\"loyaltyDiscount\":10,\"loyaltyPointsUsed\":999999}"

echo
echo "=== 5. Quantidade absurda ==="
POST "quantity = 99999" "{\"establishmentId\":\"$ESTAB\",\"orderType\":\"delivery\",\"paymentMethod\":\"cash\",\"method\":\"site\",\"customer\":{\"name\":\"Auditor\",\"phone\":\"00000000000\",\"address\":\"Rua X 1\",\"city\":\"Sao Paulo\",\"state\":\"SP\",\"zip\":\"00000-000\"},\"items\":[{\"productId\":\"$PROD\",\"name\":\"Item\",\"quantity\":99999,\"price\":10,\"options\":[]}],\"subtotal\":999990,\"total\":999990}"

echo
echo "=== 6. Agendamento no passado / sem janela (F6B-018) ==="
POST "deliveryDate no passado" "{\"establishmentId\":\"$ESTAB\",\"orderType\":\"delivery\",\"paymentMethod\":\"cash\",\"method\":\"site\",\"isScheduled\":true,\"deliveryDate\":\"2000-01-01T10:00:00.000Z\",\"customer\":{\"name\":\"Auditor\",\"phone\":\"00000000000\",\"address\":\"Rua X 1\",\"city\":\"Sao Paulo\",\"state\":\"SP\",\"zip\":\"00000-000\"},\"items\":[{\"productId\":\"$PROD\",\"name\":\"Item\",\"quantity\":1,\"price\":10,\"options\":[]}],\"subtotal\":10,\"total\":10}"

echo
echo "=== 7. Cupom inexistente/de outra loja (F6B-013) ==="
POST "couponId arbitrário" "{\"establishmentId\":\"$ESTAB\",\"orderType\":\"delivery\",\"paymentMethod\":\"cash\",\"method\":\"site\",\"customer\":{\"name\":\"Auditor\",\"phone\":\"00000000000\",\"address\":\"Rua X 1\",\"city\":\"Sao Paulo\",\"state\":\"SP\",\"zip\":\"00000-000\"},\"items\":[{\"productId\":\"$PROD\",\"name\":\"Item\",\"quantity\":1,\"price\":10,\"options\":[]}],\"subtotal\":10,\"total\":10,\"couponId\":\"nao-existe\"}"

echo
echo "=== 8. Idempotência (F6B-006) — 2 POSTs idênticos, 1 pedido só ==="
BODY="{\"establishmentId\":\"$ESTAB\",\"orderType\":\"delivery\",\"paymentMethod\":\"cash\",\"method\":\"site\",\"customer\":{\"name\":\"Auditor\",\"phone\":\"99999999999\",\"address\":\"Rua Y 2\",\"city\":\"Sao Paulo\",\"state\":\"SP\",\"zip\":\"00000-000\"},\"items\":[{\"productId\":\"$PROD\",\"name\":\"Item\",\"quantity\":1,\"price\":10,\"options\":[]}],\"subtotal\":10,\"total\":10}"
for i in 1 2; do
  curl -s -X POST "$BASE/api/orders" -H "Content-Type: application/json" \
    -H "Idempotency-Key: f6-teste-$i" --data "$BODY" -o /tmp/f6-idem-$i.json
done
id1=$(grep -Eo '"id":"[^"]+"' /tmp/f6-idem-1.json | head -1)
id2=$(grep -Eo '"id":"[^"]+"' /tmp/f6-idem-2.json | head -1)
if [ -n "$id1" ] && [ "$id1" = "$id2" ]; then
  echo "OK   — mesmo pedido devolvido nas 2 chamadas ($id1)"; passou=$((passou+1))
else
  echo "FALHA — 2 pedidos distintos: $id1 vs $id2"; falhou=$((falhou+1))
fi

echo
echo "Resultado: $passou OK · $falhou FALHA"
echo "Obtido: NÃO EXECUTADO"
