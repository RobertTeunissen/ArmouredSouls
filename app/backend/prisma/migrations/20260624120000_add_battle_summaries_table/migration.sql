-- Spec #39: Battle Log Retention — Phase 1
-- Add battle_summaries table for pre-computed battle statistics
-- Add winning_side column to battles for team battle winner detection
-- Make battle_log nullable (will be NULLed after 7-day retention window)

-- 1. Create battle_summaries table
CREATE TABLE "battle_summaries" (
  "id"                 SERIAL PRIMARY KEY,
  "battle_id"          INT NOT NULL UNIQUE REFERENCES "battles"("id") ON DELETE CASCADE,
  "per_robot"          JSONB NOT NULL,
  "per_team"           JSONB,
  "damage_flows"       JSONB NOT NULL,
  "participants"       JSONB NOT NULL,
  "koth_placements"    JSONB,
  "koth_data"          JSONB,
  "starting_positions" JSONB,
  "ending_positions"   JSONB,
  "arena_radius"       DOUBLE PRECISION,
  "battle_duration"    INT NOT NULL,
  "total_events"       INT NOT NULL,
  "has_data"           BOOLEAN NOT NULL DEFAULT true,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_battle_summaries_battle_id" ON "battle_summaries"("battle_id");

-- 2. Add winning_side column to battles (1 = team 1 won, 2 = team 2 won, NULL = draw or 1v1)
ALTER TABLE "battles" ADD COLUMN "winning_side" SMALLINT;

-- 3. Make battle_log nullable (currently required — will be NULLed by retention cron)
ALTER TABLE "battles" ALTER COLUMN "battle_log" DROP NOT NULL;
