-- =============================================
-- MIGRAÇÃO: aceite de termos e consentimento (F9C-005)
--
-- Objetivo: registrar, no banco, o aceite dos Termos de Uso / Política de
-- Privacidade no cadastro e o consentimento de marketing do cliente — dados
-- exigidos pela LGPD (art. 8, art. 18 § 2º e art. 18 V) e exigidos pelo
-- checklist de go-live (item 19: "Termos publicados + aceite + consentimento
-- gravado").
--
-- IMPORTANTE: este SQL SÓ cria as colunas. Ele não cria os Termos de Uso
-- (jurídico — F9C-004/006), não adiciona o checkbox no cadastro (código) e
-- não implementa a exportação/anonimização (F9C-010/F1D-006).
--
-- Execute no Supabase SQL Editor. É idempotente.
-- =============================================

-- ---------- Establishment (cadastro da loja) ----------
-- Momento em que o lojista aceitou os Termos de Uso e a Política de Privacidade.
ALTER TABLE "Establishment" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "Establishment" ADD COLUMN IF NOT EXISTS "privacyPolicyAcceptedAt" TIMESTAMP(3);
-- Versão do documento aceito (ex.: "2026-11-01") — para provar o que foi
-- aceito na data, mesmo que o documento mude depois.
ALTER TABLE "Establishment" ADD COLUMN IF NOT EXISTS "termsVersion" TEXT;

-- ---------- Customer (titular dos dados) ----------
-- Consentimento para comunicações de marketing (newsletter/promoções).
-- `false` por padrão: sem consentimento explícito, não há marketing.
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "marketingConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "marketingConsentAt" TIMESTAMP(3);

-- Pedido de eliminação/anonimização dos dados (LGPD art. 18 V).
-- A anonimização em si é feita pelo endpoint (feature futura — F1D-006);
-- aqui só fica o rastro do pedido.
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "dataDeletionRequestedAt" TIMESTAMP(3);
-- Data em que os dados foram efetivamente anonimizados (após o pedido).
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "anonymizedAt" TIMESTAMP(3);

-- =============================================
-- VERIFICAÇÃO
-- =============================================
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_name IN ('Customer','Establishment')
--    AND column_name IN ('termsAcceptedAt','privacyPolicyAcceptedAt','termsVersion',
--                        'marketingConsent','marketingConsentAt',
--                        'dataDeletionRequestedAt','anonymizedAt')
--  ORDER BY table_name, column_name;

-- =============================================
-- ROLLBACK
-- =============================================
-- ALTER TABLE "Customer" DROP COLUMN IF EXISTS "marketingConsent";
-- ALTER TABLE "Customer" DROP COLUMN IF EXISTS "marketingConsentAt";
-- ALTER TABLE "Customer" DROP COLUMN IF EXISTS "dataDeletionRequestedAt";
-- ALTER TABLE "Customer" DROP COLUMN IF EXISTS "anonymizedAt";
-- ALTER TABLE "Establishment" DROP COLUMN IF EXISTS "termsAcceptedAt";
-- ALTER TABLE "Establishment" DROP COLUMN IF EXISTS "privacyPolicyAcceptedAt";
-- ALTER TABLE "Establishment" DROP COLUMN IF EXISTS "termsVersion";
