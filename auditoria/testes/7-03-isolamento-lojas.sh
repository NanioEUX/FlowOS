#!/usr/bin/env bash
# Fase 7.8 — Teste 6: isolamento por loja e por cliente
#
# "Logar como cliente da loja A e tentar ler pedidos da loja B e de outro cliente
#  via chamadas diretas à API."
#
# Alvos: F7A-004/F7B-003 (orders/customer anônimo), F7A-005 (addresses por
#        customerId), F7A-006/F7B-004 (customers ?phone=), F7A-007 (payment-request),
#        F7B-002 (GET /api/orders), F7B-016 (sem checagem de tenant).
#
# NÃO EXECUTADO durante a auditoria (regra 2.5). Somente LEITURA (GET) — nenhum
# endpoint de escrita é tocado.
#
# Esperado: 401/403 em TODAS as chamadas, inclusive sem token nenhum.
# Obtido  : NÃO EXECUTADO.

set -uo pipefail
BASE="${BASE_URL:-http://localhost:3000}"
LOJA_A="${ESTAB_ID_A:?defina ESTAB_ID_A (loja do atacante)}"
LOJA_B="${ESTAB_ID_B:?defina ESTAB_ID_B (loja vítima)}"
CLIENTE_A="${CLIENTE_ID_A:?defina CLIENTE_ID_A (customerId da loja A)}"
CLIENTE_B="${CLIENTE_ID_B:?defina CLIENTE_ID_B (customerId vítima da loja B)}"
TELEFONE_B="${TELEFONE_B:?defina TELEFONE_B (telefone da vítima)}"
passou=0; falhou=0

GET () { # $1 = nome, $2 = rota
  c=$(curl -s -o /tmp/f7-iso.json -w '%{http_code}' "$BASE$2" -H "Content-Type: application/json")
  if printf '%s' "$c" | grep -Eq '^(401|403)$'; then
    echo "OK   [$c] $1"; passou=$((passou+1))
  else
    echo "FALHA [$c] $1 — sem token algum"
    head -c 200 /tmp/f7-iso.json | sed 's/^/        /'; echo
    falhou=$((falhou+1))
  fi
}

echo "=== A. Cliente da loja A lendo a LOJA B ==="
GET "pedidos da loja B"              "/api/orders?establishmentId=$LOJA_B&status=pending"
GET "histórico do cliente da B"      "/api/orders/customer?phone=$TELEFONE_B&establishmentId=$LOJA_B"
GET "cadastro do cliente da B"       "/api/customers?phone=$TELEFONE_B&establishmentId=$LOJA_B"
GET "categorias da loja B"           "/api/categories?establishmentId=$LOJA_B"
GET "caixa da loja B"                "/api/cash-register?establishmentId=$LOJA_B"
GET "mesas da loja B"                "/api/payment-request?establishmentId=$LOJA_B"
GET "cota Meta da loja B"            "/api/establishments/$LOJA_B/meta-quota"

echo
echo "=== B. Cliente A lendo OUTRO CLIENTE (mesma loja) ==="
GET "endereços do cliente B"         "/api/addresses?customerId=$CLIENTE_B&establishmentId=$LOJA_B"
GET "pedidos do cliente B"           "/api/orders/customer?phone=$TELEFONE_B&establishmentId=$LOJA_A"
GET "despesas da loja B"             "/api/expenses?establishmentId=$LOJA_B"
GET "fornecedores da loja B"         "/api/suppliers?establishmentId=$LOJA_B"

echo
echo "=== C. Com JWT de staff da loja A (se houver TOKEN_A) ==="
TOKEN_A="${TOKEN_A:-}"
if [ -n "$TOKEN_A" ]; then
  c=$(curl -s -o /tmp/f7-iso2.json -w '%{http_code}' "$BASE/api/establishments/$LOJA_B" \
      -H "Authorization: Bearer $TOKEN_A")
  if [ "$c" = "401" ] || [ "$c" = "403" ]; then
    echo "OK   [$c] GET /api/establishments/<loja B> com JWT da loja A"; passou=$((passou+1))
  else
    echo "FALHA [$c] GET /api/establishments/<loja B> com JWT da loja A (cross-tenant)"
    falhou=$((falhou+1))
  fi
  for rota in meta-quota meta-create-template meta-consumption-reset; do
    c=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/establishments/$LOJA_B/$rota" \
        -H "Authorization: Bearer $TOKEN_A")
    if [ "$c" = "401" ] || [ "$c" = "403" ]; then
      echo "OK   [$c] $rota cross-tenant"; passou=$((passou+1))
    else
      echo "FALHA [$c] $rota com JWT da loja A (F7B-009)"; falhou=$((falhou+1))
    fi
  done
else
  echo "        TOKEN_A não definido — item C NÃO TESTADO"
fi

echo
echo "=== D. Identidade: a sessão da loja A vale na loja B? ==="
echo "        sessão = flag localStorage flowos-session-verified-<slug> (por slug)"
echo "        → por design NÃO vale entre lojas; confirmar no navegador"
echo "        (F7A-015: irrelevante, pois nenhuma rota exige a sessão)"

echo
echo "Resultado: $passou OK · $falhou FALHA"
echo "Obtido: NÃO EXECUTADO"
