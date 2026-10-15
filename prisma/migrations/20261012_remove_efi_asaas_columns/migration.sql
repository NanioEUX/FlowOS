-- Migration: Remove Efi (Gerencianet) and Asaas columns from Establishment
-- Generated: 2026-10-12
-- ATENÇÃO: Revise antes de aplicar. Estas colunas não são mais usadas pelo código.

-- Efi (Gerencianet)
ALTER TABLE "Establishment" DROP COLUMN IF EXISTS "efiClientId";
ALTER TABLE "Establishment" DROP COLUMN IF EXISTS "efiClientSecret";
ALTER TABLE "Establishment" DROP COLUMN IF EXISTS "efiPixKey";
ALTER TABLE "Establishment" DROP COLUMN IF EXISTS "efiCertificate";
ALTER TABLE "Establishment" DROP COLUMN IF EXISTS "efiEnvironment";
ALTER TABLE "Establishment" DROP COLUMN IF EXISTS "efiWebhookToken";

-- Asaas
ALTER TABLE "Establishment" DROP COLUMN IF EXISTS "asaasApiKey";
ALTER TABLE "Establishment" DROP COLUMN IF EXISTS "asaasWalletId";
ALTER TABLE "Establishment" DROP COLUMN IF EXISTS "asaasCustomerId";
ALTER TABLE "Establishment" DROP COLUMN IF EXISTS "asaasSubscriptionId";
