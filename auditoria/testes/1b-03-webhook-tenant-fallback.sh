#!/usr/bin/env bash
# Fase 1B — Resolução de tenant em webhooks (fallback establishments[0])
#
# Evidência estática:
#   src/app/api/orders/ifood-webhook/route.ts:89,91
#   src/app/api/orders/99food-webhook/route.ts:107,111
#   ... || establishments[0]
#
# Se um evento externo não corresponder a pedido existente e não casar com a
# loja informada pela plataforma, o pedido é criado NO PRIMEIRO TENANT
# cadastrado — escrita cross-tenant por via de webhook.
#
# NÃO EXECUTADO (exigiria credencial/assinatura real do iFood/99 e tocaria no
# banco de produção). Esperado: pedido recusado/ignorado quando a loja não é
# identificada. Obtido: NÃO EXECUTADO.

set -uo pipefail
BASE="${BASE_URL:-http://localhost:3000}"

echo "== caso 1: evento iFood com orderId desconhecido =="
curl -s -o /tmp/aud_1b_ifood.json -w 'http=%{http_code}\n' -X POST \
  "$BASE/api/orders/ifood-webhook" \
  -H 'Content-Type: application/json' \
  --data '{"orderId":"AUDIT-TEST-0001","code":"1","name":"Auditoria Teste","total":10.5,"address":{"street":"Rua Auditoria","number":"1","formattedAddress":"Rua Auditoria, 1"}}'
echo "corpo: $(cat /tmp/aud_1b_ifood.json)"
echo ">> esperado: 400/404/ignored (loja não identificada) e NENHUM pedido criado"
echo ">> obtido  : NÃO EXECUTADO"

echo
echo "== caso 2: evento 99Food com id externo desconhecido =="
curl -s -o /tmp/aud_1b_99.json -w 'http=%{http_code}\n' -X POST \
  "$BASE/api/orders/99food-webhook" \
  -H 'Content-Type: application/json' \
  --data '{"rideId":"AUDIT-TEST-0002","status":"accepted"}'
echo "corpo: $(cat /tmp/aud_1b_99.json)"
echo ">> esperado: sem escrita em qualquer tenant"
echo ">> obtido  : NÃO EXECUTADO"

echo
echo "VERIFICACAO MANUAL NECESSARIA (apos execucao): SELECT id,\"establishmentId\" FROM \"Order\" WHERE \"externalId\" IN ('AUDIT-TEST-0001','AUDIT-TEST-0002');"
echo "Esperado: 0 linhas ou linha do tenant correto; Obtido: NÃO EXECUTADO"
