-- Step 1: Add matchMode column as nullable initially
ALTER TABLE "scheduled_team_battle_matches" ADD COLUMN "match_mode" VARCHAR(20);

-- Step 2: Backfill existing rows based on teamSize
UPDATE "scheduled_team_battle_matches" SET "match_mode" = 'league_2v2' WHERE "team_size" = 2;
UPDATE "scheduled_team_battle_matches" SET "match_mode" = 'league_3v3' WHERE "team_size" = 3;

-- Step 3: Set column to NOT NULL after backfill
ALTER TABLE "scheduled_team_battle_matches" ALTER COLUMN "match_mode" SET NOT NULL;

-- Step 4: Add composite index on [status, matchMode]
CREATE INDEX "scheduled_team_battle_matches_status_match_mode_idx" ON "scheduled_team_battle_matches"("status", "match_mode");
