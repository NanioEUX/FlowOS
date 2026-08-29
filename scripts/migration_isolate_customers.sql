-- Migration: Isolate customers per establishment
-- Problem: phone has global @unique, so only ONE customer record per phone exists
-- across ALL establishments. This causes data leakage.
--
-- Fix: Remove global unique, add per-establishment unique constraint.

-- Step 1: Remove the global unique constraint on phone
ALTER TABLE "Customer" DROP CONSTRAINT IF EXISTS "Customer_phone_key";

-- Step 2: Add per-establishment unique constraint
-- This ensures each phone can exist once per establishment, but not globally
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_establishmentId_phone_unique"
  UNIQUE ("establishmentId", "phone");
