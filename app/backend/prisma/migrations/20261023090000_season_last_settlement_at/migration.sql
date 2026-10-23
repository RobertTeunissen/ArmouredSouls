-- Persistent evidence of a successful daily settlement in either season phase.
-- Preparation settlements deliberately leave cycle_metadata.last_cycle_at (and
-- the global cycle counter) untouched, so the admin dashboard needs this to
-- tell a missed preparation settlement from a healthy one. Additive and
-- nullable: existing seasons read as "no settlement stamped yet".
ALTER TABLE "seasons" ADD COLUMN "last_settlement_at" TIMESTAMP(3);
