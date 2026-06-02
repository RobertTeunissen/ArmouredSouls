-- Entity-Agnostic Tournament Schema Migration
-- Converts robot-keyed tournament system to participant-based with discriminator column.
-- Multi-step: add columns → copy data → verify → drop old columns → remove FK constraints.

-- ============================================================================
-- STEP 1: Add new columns
-- ============================================================================

-- Add participant_type to tournaments table
ALTER TABLE "tournaments" ADD COLUMN "participant_type" VARCHAR(20) NOT NULL DEFAULT 'robot';

-- Add participant columns and participant_type to tournament_matches table
ALTER TABLE "tournament_matches" ADD COLUMN "participant1_id" INTEGER;
ALTER TABLE "tournament_matches" ADD COLUMN "participant2_id" INTEGER;
ALTER TABLE "tournament_matches" ADD COLUMN "participant_type" VARCHAR(20) NOT NULL DEFAULT 'robot';

-- Add per-type championship title counters to users table
ALTER TABLE "users" ADD COLUMN "championship_titles_1v1" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "championship_titles_2v2" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "championship_titles_3v3" INTEGER NOT NULL DEFAULT 0;

-- ============================================================================
-- STEP 2: Copy data from old columns to new columns
-- ============================================================================

-- Copy robot1_id/robot2_id to participant1_id/participant2_id
UPDATE "tournament_matches" SET
    "participant1_id" = "robot1_id",
    "participant2_id" = "robot2_id",
    "participant_type" = 'robot';

-- Set participant_type on all existing tournaments
UPDATE "tournaments" SET "participant_type" = 'robot';

-- Backfill championship_titles_1v1 from existing championship_titles (all existing titles are 1v1)
UPDATE "users" SET "championship_titles_1v1" = "championship_titles";

-- ============================================================================
-- STEP 3: Verify data integrity
-- ============================================================================

-- Verify participant1_id matches robot1_id counts
DO $$
DECLARE
    robot1_count INTEGER;
    participant1_count INTEGER;
    robot2_count INTEGER;
    participant2_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO robot1_count FROM "tournament_matches" WHERE "robot1_id" IS NOT NULL;
    SELECT COUNT(*) INTO participant1_count FROM "tournament_matches" WHERE "participant1_id" IS NOT NULL;

    IF robot1_count != participant1_count THEN
        RAISE EXCEPTION 'Data migration verification failed: robot1_id non-null count (%) does not match participant1_id non-null count (%)',
            robot1_count, participant1_count;
    END IF;

    SELECT COUNT(*) INTO robot2_count FROM "tournament_matches" WHERE "robot2_id" IS NOT NULL;
    SELECT COUNT(*) INTO participant2_count FROM "tournament_matches" WHERE "participant2_id" IS NOT NULL;

    IF robot2_count != participant2_count THEN
        RAISE EXCEPTION 'Data migration verification failed: robot2_id non-null count (%) does not match participant2_id non-null count (%)',
            robot2_count, participant2_count;
    END IF;
END $$;

-- ============================================================================
-- STEP 4: Drop old columns and FK constraints
-- ============================================================================

-- Drop FK constraints on robot1_id and robot2_id (tournament_matches)
ALTER TABLE "tournament_matches" DROP CONSTRAINT "tournament_matches_robot1_id_fkey";
ALTER TABLE "tournament_matches" DROP CONSTRAINT "tournament_matches_robot2_id_fkey";

-- Drop FK constraint on winner_id (tournament_matches → robots)
ALTER TABLE "tournament_matches" DROP CONSTRAINT "tournament_matches_winner_id_fkey";

-- Drop FK constraint on winner_id (tournaments → robots)
ALTER TABLE "tournaments" DROP CONSTRAINT "tournaments_winner_id_fkey";

-- Drop old indexes on robot1_id and robot2_id
DROP INDEX "tournament_matches_robot1_id_idx";
DROP INDEX "tournament_matches_robot2_id_idx";

-- Drop old winner_id index on tournaments (will be replaced by composite index)
DROP INDEX "tournaments_winner_id_idx";

-- Drop old columns from tournament_matches
ALTER TABLE "tournament_matches" DROP COLUMN "robot1_id";
ALTER TABLE "tournament_matches" DROP COLUMN "robot2_id";

-- ============================================================================
-- STEP 5: Add new indexes
-- ============================================================================

-- Indexes on participant columns (tournament_matches)
CREATE INDEX "tournament_matches_participant1_id_idx" ON "tournament_matches"("participant1_id");
CREATE INDEX "tournament_matches_participant2_id_idx" ON "tournament_matches"("participant2_id");

-- Composite index for participant_type + status queries (tournaments)
CREATE INDEX "tournaments_participant_type_status_idx" ON "tournaments"("participant_type", "status");
