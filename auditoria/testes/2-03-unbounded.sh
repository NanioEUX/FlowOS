#!/usr/bin/env bash
# Fase 2 — Queries sem limite (F2-006)
# NÃO EXECUTADO (rota hoje exige apenas establishmentId, mas aponta para produção).
#
# Esperado: payload pequeno e limitado. Obtido: NÃO EXECUTADO.
set -uo pipefail
BASE="${BASE_URL:-http://localhost:3000}"
ESTAB="${ESTAB_ID:?defina ESTAB_ID}"

for ep in \
  "/api/orders?establishmentId=$ESTAB" \
  "/api/financial/dre?establishmentId=$ESTAB" \
  "/api/customers?establishmentId=$ESTAB" \
  "/api/delivery-persons?establishmentId=$ESTAB" \
  "/api/stock?establishmentId=$ESTAB"; do
  out=$(curl -s -o /tmp/aud_unbounded.json -w '%{http_code} %{size_download} %{time_total}' "$BASE$ep")
  n=$(python3 -c 'import json,sys;
try:
  d=json.load(open("/tmp/aud_unbounded.json")); print(len(d) if isinstance(d,list) else "obj")
except Exception: print("?")' 2>/dev/null)
  echo "$ep -> http/bytes/tempo=$out registros=$n"
done
echo ">> Obtido: NÃO EXECUTADO"
