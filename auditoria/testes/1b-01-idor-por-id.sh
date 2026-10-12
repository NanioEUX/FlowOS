#!/usr/bin/env bash
# Fase 1B — Teste de IDOR cross-tenant (isolamento multi-tenant)
#
# SOMENTE LEITURA no repositório. Este script NÃO foi executado durante a
# auditoria porque DATABASE_URL aponta para o banco de PRODUÇÃO
# (.env:1 -> aws-1-us-east-1.pooler.supabase.com) e a regra 2.5 da auditoria
# proíbe qualquer teste contra produção.
#
# Pré-requisitos (ambiente de teste próprio, 2 lojas distintas):
#   BASE_URL       ex.: http://localhost:3000
#   TOKEN_A        JWT de um usuário do tenant A
#   TOKEN_B        JWT de um usuário do tenant B
#   ID_*_B         ids de recursos PERTENCENTES AO TENANT B
#   ESTAB_ID_B     establishmentId do tenant B
#
# Esperado: 401 (sem token), 403 ou 404 (token de outro tenant).
# Obtido  : NÃO EXECUTADO (sem ambiente de teste multi-loja — ver PROGRESSO.md).

set -uo pipefail

BASE="${BASE_URL:-http://localhost:3000}"
TOKEN_A="${TOKEN_A:?defina TOKEN_A}"
TOKEN_B="${TOKEN_B:?defina TOKEN_B}"

passou=0; falhou=0; nao_executado=0

check() {
  local nome="$1" metodo="$2" rota="$3" token="$4" corpo="${5:-}"
  local codigo
  codigo=$(curl -s -o /dev/null -w '%{http_code}' -X "$metodo" "$BASE$rota" \
    -H "Content-Type: application/json" \
    ${token:+-H "Authorization: Bearer $token"} \
    ${corpo:+--data "$corpo"})
  case "$codigo" in
    401|403|404) echo "OK   [$codigo] $nome"; passou=$((passou+1)) ;;
    200|201)     echo "FALHA [$codigo] $nome — recurso de outro tenant acessível"; falhou=$((falhou+1)) ;;
    *)           echo "NÃO VERIFICADO [$codigo] $nome"; nao_executado=$((nao_executado+1)) ;;
  esac
}

echo "== 1B-01: recursos do TENANT B acessados com token do TENANT A =="
check "produto do B: PATCH"  PATCH "/api/products/${ID_PRODUCT_B}"      "$TOKEN_A" '{"price":1}'
check "produto do B: DELETE" DELETE "/api/products/${ID_PRODUCT_B}"      "$TOKEN_A"
check "banner do B: PATCH"   PATCH "/api/admin/banners/${ID_BANNER_B}"  "$TOKEN_A" '{"title":"x"}'
check "banner do B: DELETE"  DELETE "/api/admin/banners/${ID_BANNER_B}"  "$TOKEN_A"
check "story do B: DELETE"   DELETE "/api/admin/stories/${ID_STORY_B}"   "$TOKEN_A"
check "delivery-config do B: GET"  GET  "/api/establishments/${ESTAB_ID_B}/delivery-config" "$TOKEN_A"
check "delivery-config do B: PUT"  PUT  "/api/establishments/${ESTAB_ID_B}/delivery-config" "$TOKEN_A" '{"deliveryRadiusKm":1}'
check "localizacao do B: PUT"      PUT  "/api/establishments/${ESTAB_ID_B}/location"        "$TOKEN_A" '{"addressLat":-1,"addressLng":-1}'
check "categoria do B: PATCH"      PATCH "/api/categories/${ID_CATEGORY_B}" "$TOKEN_A" '{"name":"x"}'
check "estoque do B: PATCH"        PATCH "/api/stock/${ID_STOCK_B}"         "$TOKEN_A" '{"quantity":1}'
check "despesa do B: DELETE"       DELETE "/api/expenses/${ID_EXPENSE_B}"    "$TOKEN_A"
check "caixa do B: DELETE"         DELETE "/api/cash-register/${ID_CASH_B}"  "$TOKEN_A"
check "usuario do B: PATCH"        PATCH "/api/users/${ID_USER_B}"           "$TOKEN_A" '{"name":"x"}'

echo
echo "== 1B-02: mesmas rotas SEM token (devem ser 401) =="
check "produto sem token: GET"     GET "/api/products/${ID_PRODUCT_B}" ""
check "banner sem token: DELETE"   DELETE "/api/admin/banners/${ID_BANNER_B}" ""
check "delivery-config sem token"  GET "/api/establishments/${ESTAB_ID_B}/delivery-config" ""

echo
echo "resumo: passou=$passou falhou=$falhou nao_verificado=$nao_executado"
