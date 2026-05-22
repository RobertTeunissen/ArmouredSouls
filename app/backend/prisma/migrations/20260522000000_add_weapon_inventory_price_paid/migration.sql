-- Add price_paid column to weapon_inventory.
-- Three-phase migration to safely add a NOT NULL column to a table with existing rows:
--   1. Add column as nullable
--   2. Backfill existing rows with the current catalog price (best-effort approximation
--      since pre-spec purchases have no recorded discount; new purchases will store the
--      actual discounted price.)
--   3. Set NOT NULL constraint after backfill

-- Phase 1: Add nullable column
ALTER TABLE "weapon_inventory" ADD COLUMN "price_paid" INTEGER;

-- Phase 2: Backfill existing rows with the catalog price from the weapons table
UPDATE "weapon_inventory" wi
SET "price_paid" = w."cost"
FROM "weapons" w
WHERE wi."weapon_id" = w."id";

-- Phase 3: Enforce NOT NULL after backfill
ALTER TABLE "weapon_inventory" ALTER COLUMN "price_paid" SET NOT NULL;
