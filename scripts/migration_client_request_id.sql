-- =============================================
-- MIGRAÇÃO: idempotência de pedido (F4B-019 / F6B-006)
--
-- Objetivo: permitir que o cliente reenvie o mesmo pedido (retry de rede,
-- duplo clique, retry do proxy) sem criar um pedido novo — e, principalmente,
-- sem COBRAR O CLIENTE DUAS VEZES quando o pagamento é online.
--
-- O QUE ESTE SQL FAZ: apenas adiciona a coluna e o índice único.
-- O QUE FALTA (e depende de decisão do dono): rodar `npx prisma db push`
-- (ou este SQL) ANTES de deployar o código que usa a coluna, e só depois
-- habilitar o header `Idempotency-Key` no `POST /api/orders`.
--
-- Como o Prisma trata NULL em índice único no Postgres (NULLs são
-- distintos entre si), os pedidos antigos — que ficam com clientRequestId
-- NULL — não conflitam entre si. Só as linhas com chave preenchida são
-- únicas por (estabelecimento, chave).
--
-- Execute no Supabase SQL Editor (ou via psql). É idempotente: pode rodar
-- mais de uma vez sem efeito colateral.
-- =============================================

-- 1. Coluna da chave de idempotência (enviada pelo cliente no header
--    `Idempotency-Key`; única por estabelecimento).
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "clientRequestId" TEXT;

-- 2. Índice único parcial — só as linhas com chave preenchida participates.
--    O nome é o mesmo que o Prisma gera para `@@unique([establishmentId,
--    clientRequestId])`, para o `db push` não tentar recriar o índice.
CREATE UNIQUE INDEX IF NOT EXISTS "Order_establishmentId_clientRequestId_key"
  ON "Order" ("establishmentId", "clientRequestId")
  WHERE "clientRequestId" IS NOT NULL;

-- =============================================
-- VERIFICAÇÃO (deve devolver 1 linha)
-- =============================================
-- SELECT indexname, indexdef FROM pg_indexes
--  WHERE tablename = 'Order' AND indexname LIKE '%clientRequestId%';

-- =============================================
-- ROLLBACK (só se precisar desfazer)
-- =============================================
-- DROP INDEX IF EXISTS "Order_establishmentId_clientRequestId_key";
-- ALTER TABLE "Order" DROP COLUMN IF EXISTS "clientRequestId";
