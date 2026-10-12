#!/usr/bin/env bash
# Fase 1B — Rotas sem verifyAuth (leitura/escrita anônima cross-tenant)
#
# NÃO EXECUTADO durante a auditoria (banco de produção em DATABASE_URL).
# Objetivo: provar que as rotas abaixo respondem sem qualquer credencial e
# aceitam establishmentId vindo da query string do cliente.
#
# Esperado: 401 em todas.
# Obtido  : NÃO EXECUTADO.

set -uo pipefail
BASE="${BASE_URL:-http://localhost:3000}"
ESTAB="${ESTAB_ID:?defina ESTAB_ID (tenant alvo)}"
passou=0; falhou=0

# Amostra representativa das 51 rotas mapeadas (F1A-005 / F1B-005)
ROTAS=(
  "GET  /api/orders?establishmentId=$ESTAB&status=pending"
  "GET  /api/dashboard?establishmentId=$ESTAB"
  "GET  /api/financial/dre?establishmentId=$ESTAB"
  "GET  /api/financial/cash-flow?establishmentId=$ESTAB"
  "GET  /api/cash-register?establishmentId=$ESTAB"
  "GET  /api/categories?establishmentId=$ESTAB"
  "GET  /api/stock?establishmentId=$ESTAB"
  "GET  /api/expenses?establishmentId=$ESTAB"
  "GET  /api/suppliers?establishmentId=$ESTAB"
  "GET  /api/customers?establishmentId=$ESTAB"
  "GET  /api/delivery-persons?establishmentId=$ESTAB"
  "GET  /api/establishments?id=$ESTAB"
  "GET  /api/orders/customer?phone=00000000000"
  "GET  /api/push/diagnose?establishmentId=$ESTAB"
  "POST /api/delivery-persons"
  "POST /api/cash-register"
  "POST /api/test-dispatch"
  "POST /api/asaas-test"
)

for item in "${ROTAS[@]}"; do
  metodo="${item%% *}"; rota="${item#* }"
  codigo=$(curl -s -o /dev/null -w '%{http_code}' -X "$metodo" "$BASE$rota" \
    -H "Content-Type: application/json" --data '{}')
  if [ "$codigo" = "401" ] || [ "$codigo" = "403" ]; then
    echo "OK   [$codigo] $metodo $rota"; passou=$((passou+1))
  else
    echo "FALHA [$codigo] $metodo $rota — anônimo obteve acesso"; falhou=$((falhou+1))
  fi
done

echo
echo "resumo: bloqueou=$passou exposto=$falhou"
