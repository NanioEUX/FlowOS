#!/usr/bin/env bash
# Fase 2 — Corrida na numeração de pedidos (F2-003)
# NÃO EXECUTADO (DATABASE_URL = produção; regra 2.5).
#
# Esperado: 1 pedido criado, o segundo falha com 500 OU (após correção com retry) ambos criados
#           com números consecutivos. Obtido: NÃO EXECUTADO.
set -uo pipefail
BASE="${BASE_URL:-http://localhost:3000}"
ESTAB="${ESTAB_ID:?defina ESTAB_ID}"
BODY='{"establishmentId":"'"$ESTAB"'","orderType":"delivery","paymentMethod":"online","method":"site","customerName":"Race Test","customerPhone":"47999999999","items":"[{\"id\":\"x\",\"name\":\"Teste\",\"price\":10,\"quantity\":1}]","total":10,"status":"pending"}'

rm -f /tmp/aud_race_*.out
for i in 1 2 3 4; do
  curl -s -o "/tmp/aud_race_$i.out" -w "req$i http=%{http_code} tempo=%{time_total}\n" \
    -X POST "$BASE/api/orders" -H 'Content-Type: application/json' --data "$BODY" &
done
wait
echo "--- respostas ---"
for i in 1 2 3 4; do echo "req$i: $(head -c 200 /tmp/aud_race_$i.out)"; done
echo ">> VERIFICACAO MANUAL: SELECT \"orderNumber\", count(*) FROM \"Order\" WHERE \"establishmentId\"='$ESTAB' GROUP BY 1 HAVING count(*)>1;"
echo ">> Obtido: NÃO EXECUTADO"
