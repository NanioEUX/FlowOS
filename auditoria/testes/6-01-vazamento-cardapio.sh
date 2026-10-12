#!/usr/bin/env bash
# Fase 6.1/6.6 — Vazamento de campos internos no HTML público do cardápio
#
# Alvos: F6A-001 (/[slug] serializa `rest` inteiro nas props do client component),
#        F6A-002 (/pedido/[id] passa `include: { establishment: true }`),
#        F6A-003 (POST /api/orders responde com `include: { establishment: true }`),
#        F6A-010 (GET /api/categories devolve stockLinks/stockItem),
#        F6A-017 (GET /api/establishments?id=|slug= devolve 32 credenciais).
#
# NÃO EXECUTADO durante a auditoria (DATABASE_URL = produção; regra 4/2.5).
# A rota /api/orders exige escrita — use apenas contra ambiente de teste.
#
# Esperado: nenhuma ocorrência das strings abaixo em resposta pública.
# Obtido  : NÃO EXECUTADO.

set -uo pipefail
BASE="${BASE_URL:-http://localhost:3000}"
SLUG="${SLUG:?defina SLUG (loja alvo)}"
ESTAB="${ESTAB_ID:-}"   # opcional, se conhecido
passou=0; falhou=0

# Strings que NUNCA devem aparecer em superfície pública
PADRAO_VAZAMENTO='asaasApiKey|efiClientSecret|interClientSecret|pagarmeApiKey|metaAccessToken|evolutionApiKey|api99Key|"password"|unitCost|stockItem|stockLinks|trackingToken'

checar () { # $1 = nome, $2 = arquivo de resposta
  if grep -Eq "$PADRAO_VAZAMENTO" "$2"; then
    echo "FALHA — $1"
    grep -Eo "$PADRAO_VAZAMENTO" "$2" | sort -u | sed 's/^/        achou: /'
    falhou=$((falhou+1))
  else
    echo "OK   — $1"
    passou=$((passou+1))
  fi
}

echo "=== 1. HTML do cardápio (props do MenuPage) ==="
curl -s "$BASE/$SLUG" -o /tmp/f6-html.html
checar "GET /$SLUG (RSC payload)" /tmp/f6-html.html

echo
echo "=== 2. Página de acompanhamento (token conhecido) ==="
TOKEN="${TRACKING_TOKEN:-test-order-001}"
curl -s "$BASE/pedido/$TOKEN" -o /tmp/f6-track.html
checar "GET /pedido/$TOKEN" /tmp/f6-track.html
# o pedido precisa existir para o vazamento aparecer; 404 também vale como "sem vazamento"
if [ "$(wc -c < /tmp/f6-track.html)" -lt 4096 ]; then
  echo "        (aviso) resposta curta — token inexistente ou rota 404; repetir com token válido"
fi

echo
echo "=== 3. APIs de catálogo lidas pelo cardápio ==="
if [ -n "$ESTAB" ]; then
  curl -s "$BASE/api/categories?establishmentId=$ESTAB" -o /tmp/f6-cat.json
  checar "GET /api/categories" /tmp/f6-cat.json
fi
curl -s "$BASE/api/establishments?id=${ESTAB}" -o /tmp/f6-est.json
[ -n "$ESTAB" ] && checar "GET /api/establishments?id=" /tmp/f6-est.json
curl -s "$BASE/api/establishments?slug=$SLUG" -o /tmp/f6-est2.json
checar "GET /api/establishments?slug=$SLUG" /tmp/f6-est2.json

echo
echo "=== 4. Contagem de credenciais expostas em ?id=/?slug= ==="
if [ -s /tmp/f6-est2.json ]; then
  n=$(grep -Eo '"(asaas|efi|inter|pagarme|meta|evolution|ifood|api99|flow)[A-Za-z0-9]*":' /tmp/f6-est2.json | sort -u | wc -l | tr -d ' ')
  echo "campos de integração encontrados: $n (esperado: 0)"
  [ "$n" -eq 0 ] && passou=$((passou+1)) || falhou=$((falhou+1))
fi

echo
echo "Resultado: $passou OK · $falhou FALHA"
echo "Obtido: NÃO EXECUTADO"
