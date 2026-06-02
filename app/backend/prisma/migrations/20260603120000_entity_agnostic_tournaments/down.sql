-- Down Migration: Restore robot-keyed tournament schema
-- Reverses the entity-agnostic migration by restoring robot1_id/robot2_id columns and FK constraints.

-- ============================================================================
-- STEP 1: Re-add old columns to tournament_matches
-- ============================================================================

ALTER TABLE "tournament_matches" ADD COLUMN "robot1_id" INTEGER;
ALTER TABLE "tournament_matches" ADD COLUMN "robot2_id" INTEGER;

-- ============================================================================
-- STEP 2: Copy data back from participant columns (only for robot-type matches)
-- ============================================================================

UPDATE "tournament_matches" SET
    "robot1_id" = "participant1_id",
    "robot2_id" = "participant2_id"
WHERE "participant_type" = 'robot';

-- ============================================================================
-- STEP 3: Restore FK constraints
-- ============================================================================

-- Restore FK on robot1_id → robots.id
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_robot1_id_fkey"
    FOREIGN KEY ("robot1_id") REFERENCES "robots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Restore FK on robot2_id → robots.id
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_robot2_id_fkey"
    FOREIGN KEY ("robot2_id") REFERENCES "robots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Restore FK on winner_id → robots.id (tournament_matches)
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_winner_id_fkey"
    FOREIGN KEY ("winner_id") REFERENCES "robots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Restore FK on winner_id → robots.id (tournaments)
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_winner_id_fkey"
    FOREIGN KEY ("winner_id") REFERENCES "robots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- STEP 4: Restore old indexes
-- ============================================================================

CREATE INDEX "tournament_matches_robot1_id_idx" ON "tournament_matches"("robot1_id");
CREATE INDEX "tournament_matches_robot2_id_idx" ON "tournament_matches"("robot2_id");
CREATE INDEX "tournaments_winner_id_idx" ON "tournaments"("winner_id");

-- ============================================================================
-- STEP 5: Drop new columns and indexes
-- ============================================================================

-- Drop new indexes
DROP INDEX "tournament_matches_participant1_id_idx";
DROP INDEX "tournament_matches_participant2_id_idx";
DROP INDEX "tournaments_participant_type_status_idx";

-- Drop new columns from tournament_matches
ALTER TABLE "tournament_matches" DROP COLUMN "participant1_id";
ALTER TABLE "tournament_matches" DROP COLUMN "participant2_id";
ALTER TABLE "tournament_matches" DROP COLUMN "participant_type";

-- Drop participant_type from tournaments
ALTER TABLE "tournaments" DROP COLUMN "participant_type";

-- Drop per-type championship title counters from users
ALTER TABLE "users" DROP COLUMN "championship_titles_1v1";
ALTER TABLE "users" DROP COLUMN "championship_titles_2v2";
ALTER TABLE "users" DROP COLUMN "championship_titles_3v3";
