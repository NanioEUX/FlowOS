#!/usr/bin/env bash
# Fase 5.1/5.5 — Teste dinâmico: máquina de estados e estoque sob concorrência.
# REGRAS: NÃO EXECUTAR CONTRA PRODUÇÃO. O DATABASE_URL do projeto aponta para produção.
# Executar SOMENTE em ambiente de teste (2 lojas, banco não-produtivo).
# obtido = NÃO EXECUTADO  (nenhum ambiente de teste disponível na auditoria)
set -u

BASE_URL="${BASE_URL:-http://localhost:3000}"
EST_ID_A="${EST_ID_A:-LOJA_A}"
EST_ID_B="${EST_ID_B:-LOJA_B}"
TOKEN_A="${TOKEN_A:-}"          # JWT de staff da loja A
TOKEN_B="${TOKEN_B:-}"          # JWT de staff da loja B
TRACKING_TOKEN="${TRACKING_TOKEN:-}"

echo "== 5-01 transições inválidas e isolation =="
echo "obtido = NÃO EXECUTADO (exige ambiente de teste; jamais produção)"
echo
echo "Passos manuais:"
echo "1. Criar pedido na loja A (POST /api/orders) e anotar orderId."
echo "2. Colocá-lo direto em 'delivered' via POST (body.status=delivered)  -> esperado: REJEITADO; hoje aceito (F5A-012)."
echo "3. PATCH /api/orders/\$orderId {\"status\":\"preparing\"} com o pedido já 'delivered'"
echo "   -> esperado: 409/422 (downgrade); hoje: 200 (F5A-002)."
echo "4. PATCH com TOKEN_B (staff da loja B) no mesmo orderId"
echo "   -> esperado: 404/403; hoje o handler compara establishmentId e devolve 404 (ok, conferir)."
echo "5. GET /api/orders?establishmentId=\$EST_ID_B sem Authorization"
echo "   -> esperado: 401; hoje: 200 com pedidos da loja B (F5A-003/F5D-001)."
echo "6. Cancelar por 'abandoned' (aguardar abandonedOrderMinutes com status pending)"
echo "   -> esperado: estoque devolvido; hoje NÃO devolvido (F5A-022)."
echo
echo "== 5-02 corrida de estoque (DESTRUTIVO — só ambiente de teste) =="
echo "obtido = NÃO EXECUTADO"
echo "Passos manuais:"
echo "1. Item com quantity=1 no estoque da loja A."
echo "2. Disparar 10 POST /api/orders em paralelo (xargs -P10) com 1 unidade cada."
echo "3. Esperado: 1 sucesso + 9 recusas; hoje possíveis: todos criados e quantity=-9"
echo "   (deductProductStock sem piso/trava — F5A-020 / lib/stock.ts:84)."
echo "4. Conferir: SELECT quantity FROM \"StockItem\" WHERE id=...  -> deve ser 0 ou 1, nunca negativo."
echo
echo "== 5-03 regras só na tela =="
echo "obtido = NÃO EXECUTADO (rotas anônimas gravam em banco — jamais em produção)"
echo "Passos manuais:"
echo "1. POST /api/categories {\"type\":\"category\",\"name\":\"x\",\"establishmentId\":\$EST_ID_B} sem token"
echo "   -> esperado: 401; hoje: 201 (F5B-002)."
echo "2. POST /api/orders com cupom: couponId válido com usageLimit atingido"
echo "   -> esperado: 400; hoje aceita e só faz timesUsed++ (F5B-024)."
echo "3. POST /api/orders com item availableOnline=false e method=site"
echo "   -> esperado: 400; hoje aceita (F5B-031)."
echo "4. PATCH /api/cash-register/<fechado> com closingAmount ausente"
echo "   -> esperado: 409 (já fechado) e divergência registrada; hoje reabre e mascara (F5B-027)."
echo
echo "FIM — nenhum request disparado por este script."
