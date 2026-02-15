-- Add per-robot damage and fame tracking for tag team battles
-- This allows displaying individual robot contributions in battle results

ALTER TABLE "battles" ADD COLUMN "team1_active_damage_dealt" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "battles" ADD COLUMN "team1_reserve_damage_dealt" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "battles" ADD COLUMN "team2_active_damage_dealt" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "battles" ADD COLUMN "team2_reserve_damage_dealt" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "battles" ADD COLUMN "team1_active_fame_awarded" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "battles" ADD COLUMN "team1_reserve_fame_awarded" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "battles" ADD COLUMN "team2_active_fame_awarded" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "battles" ADD COLUMN "team2_reserve_fame_awarded" INTEGER NOT NULL DEFAULT 0;
