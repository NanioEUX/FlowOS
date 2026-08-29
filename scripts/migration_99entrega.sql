-- =============================================
-- MIGRAÇÃO: 99Entrega - Adicionar colunas e tabela
-- Execute este SQL no Supabase SQL Editor ANTES do deploy
-- =============================================

-- 1. Adicionar colunas na tabela Establishment (entrega híbrida)
ALTER TABLE "Establishment" ADD COLUMN IF NOT EXISTS "tipoEntregaAtiva" TEXT NOT NULL DEFAULT 'propria';
ALTER TABLE "Establishment" ADD COLUMN IF NOT EXISTS "api99Key" TEXT;
ALTER TABLE "Establishment" ADD COLUMN IF NOT EXISTS "api99EmployeeId" TEXT;

-- 2. Adicionar colunas na tabela Order (rastreamento 99)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "entregaProvedor" TEXT DEFAULT 'propria';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "entrega99RideId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "entregaStatusProvedor" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "entregaPrecoCusto" DECIMAL(10,2);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "entregaLinkRastreamento" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "entregaPinCode" TEXT;

-- 3. Criar tabela de logs de webhooks 99
CREATE TABLE IF NOT EXISTS "LogWebhook99" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "pedidoId" TEXT,
    "rideId" TEXT,
    "payload" JSONB NOT NULL,
    "statusProcessamento" TEXT NOT NULL DEFAULT 'pendente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LogWebhook99_pkey" PRIMARY KEY ("id")
);
