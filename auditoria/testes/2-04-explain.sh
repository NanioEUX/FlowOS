#!/usr/bin/env bash
# Fase 2 — EXPLAIN ANALYZE das queries mais pesadas (F2-010 / F2-006)
# NÃO EXECUTADO: exige conexão com banco — DATABASE_URL aponta para PRODUÇÃO (regra 2.5).
# Executar SOMENTE em ambiente de teste/restauração local.
set -uo pipefail
PGURL="${TEST_DATABASE_URL:?defina TEST_DATABASE_URL (ambiente de teste, NUNCA a produção)}"

psql "$PGURL" -v ON_ERROR_STOP=1 <<'SQL'
-- 1. plano do cardápio (produto por tenant)
EXPLAIN (ANALYZE, BUFFERS) SELECT id,name,price FROM "Product" WHERE "establishmentId"='X' AND "isActive"=true;
-- 2. listagem de pedidos sem take (o pior caso)
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM "Order" WHERE "establishmentId"='X' ORDER BY "createdAt" DESC;
-- 3. alertas: varredura completa de estoque
EXPLAIN (ANALYZE, BUFFERS) SELECT quantity,"minQuantity" FROM "StockItem" WHERE "establishmentId"='X';
-- 4. numeração de pedido (F2-003)
EXPLAIN (ANALYZE, BUFFERS) SELECT COALESCE(MAX("orderNumber"),0)+1 FROM "Order" WHERE "establishmentId"='X';
-- 5. índices realmente existentes
SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename;
-- 6. tamanhos (crescimento / F2-017)
SELECT relname, n_live_tup, pg_size_pretty(pg_total_relation_size(c.oid)) FROM pg_stat_user_tables s
 JOIN pg_class c ON c.relname=s.relname ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 20;
SQL
echo ">> Obtido: NÃO EXECUTADO (sem ambiente de banco de teste)"
