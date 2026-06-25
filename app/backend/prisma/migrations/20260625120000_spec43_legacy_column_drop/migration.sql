-- Spec #43: Legacy Column Drop
-- Drops dead scheduling table, makes Battle ELO/tag-team columns nullable,
-- removes 26 Robot columns and 14 TeamBattle columns.

-- DropForeignKey
ALTER TABLE "scheduled_matches" DROP CONSTRAINT IF EXISTS "scheduled_matches_battle_id_fkey";
ALTER TABLE "scheduled_matches" DROP CONSTRAINT IF EXISTS "scheduled_matches_robot1_id_fkey";
ALTER TABLE "scheduled_matches" DROP CONSTRAINT IF EXISTS "scheduled_matches_robot2_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "robots_current_league_idx";
DROP INDEX IF EXISTS "robots_current_league_league_id_idx";
DROP INDEX IF EXISTS "team_battles_team_league_id_idx";
DROP INDEX IF EXISTS "team_battles_team_size_tag_team_league_tag_team_league_id_idx";
DROP INDEX IF EXISTS "team_battles_team_size_team_league_idx";

-- AlterTable: Make Battle ELO + tag-team columns nullable
ALTER TABLE "battles" ADD COLUMN IF NOT EXISTS "winning_side" SMALLINT;
ALTER TABLE "battles" ALTER COLUMN "battle_log" DROP NOT NULL;
ALTER TABLE "battles" ALTER COLUMN "team1_active_damage_dealt" DROP NOT NULL;
ALTER TABLE "battles" ALTER COLUMN "team1_reserve_damage_dealt" DROP NOT NULL;
ALTER TABLE "battles" ALTER COLUMN "team2_active_damage_dealt" DROP NOT NULL;
ALTER TABLE "battles" ALTER COLUMN "team2_reserve_damage_dealt" DROP NOT NULL;
ALTER TABLE "battles" ALTER COLUMN "team1_active_fame_awarded" DROP NOT NULL;
ALTER TABLE "battles" ALTER COLUMN "team1_reserve_fame_awarded" DROP NOT NULL;
ALTER TABLE "battles" ALTER COLUMN "team2_active_fame_awarded" DROP NOT NULL;
ALTER TABLE "battles" ALTER COLUMN "team2_reserve_fame_awarded" DROP NOT NULL;
ALTER TABLE "battles" ALTER COLUMN "robot1_elo_before" DROP NOT NULL;
ALTER TABLE "battles" ALTER COLUMN "robot2_elo_before" DROP NOT NULL;
ALTER TABLE "battles" ALTER COLUMN "robot1_elo_after" DROP NOT NULL;
ALTER TABLE "battles" ALTER COLUMN "robot2_elo_after" DROP NOT NULL;
ALTER TABLE "battles" ALTER COLUMN "elo_change" DROP NOT NULL;

-- AlterTable: Drop 26 Robot legacy columns
ALTER TABLE "robots" DROP COLUMN IF EXISTS "best_win_streak";
ALTER TABLE "robots" DROP COLUMN IF EXISTS "current_league";
ALTER TABLE "robots" DROP COLUMN IF EXISTS "current_lose_streak";
ALTER TABLE "robots" DROP COLUMN IF EXISTS "current_win_streak";
ALTER TABLE "robots" DROP COLUMN IF EXISTS "cycles_in_current_league";
ALTER TABLE "robots" DROP COLUMN IF EXISTS "koth_best_placement";
ALTER TABLE "robots" DROP COLUMN IF EXISTS "koth_best_win_streak";
ALTER TABLE "robots" DROP COLUMN IF EXISTS "koth_current_win_streak";
ALTER TABLE "robots" DROP COLUMN IF EXISTS "koth_kills";
ALTER TABLE "robots" DROP COLUMN IF EXISTS "koth_matches";
ALTER TABLE "robots" DROP COLUMN IF EXISTS "koth_total_zone_score";
ALTER TABLE "robots" DROP COLUMN IF EXISTS "koth_total_zone_time";
ALTER TABLE "robots" DROP COLUMN IF EXISTS "koth_wins";
ALTER TABLE "robots" DROP COLUMN IF EXISTS "league_id";
ALTER TABLE "robots" DROP COLUMN IF EXISTS "league_points";
ALTER TABLE "robots" DROP COLUMN IF EXISTS "times_tagged_in";
ALTER TABLE "robots" DROP COLUMN IF EXISTS "times_tagged_out";
ALTER TABLE "robots" DROP COLUMN IF EXISTS "total_league_1v1_draws";
ALTER TABLE "robots" DROP COLUMN IF EXISTS "total_league_1v1_losses";
ALTER TABLE "robots" DROP COLUMN IF EXISTS "total_league_1v1_wins";
ALTER TABLE "robots" DROP COLUMN IF EXISTS "total_league_2v2_wins";
ALTER TABLE "robots" DROP COLUMN IF EXISTS "total_league_3v3_wins";
ALTER TABLE "robots" DROP COLUMN IF EXISTS "total_tag_team_battles";
ALTER TABLE "robots" DROP COLUMN IF EXISTS "total_tag_team_draws";
ALTER TABLE "robots" DROP COLUMN IF EXISTS "total_tag_team_losses";
ALTER TABLE "robots" DROP COLUMN IF EXISTS "total_tag_team_wins";

-- AlterTable: Drop 14 TeamBattle legacy columns
ALTER TABLE "team_battles" DROP COLUMN IF EXISTS "cycles_in_league";
ALTER TABLE "team_battles" DROP COLUMN IF EXISTS "cycles_in_tag_team_league";
ALTER TABLE "team_battles" DROP COLUMN IF EXISTS "tag_team_league";
ALTER TABLE "team_battles" DROP COLUMN IF EXISTS "tag_team_league_id";
ALTER TABLE "team_battles" DROP COLUMN IF EXISTS "tag_team_lp";
ALTER TABLE "team_battles" DROP COLUMN IF EXISTS "team_league";
ALTER TABLE "team_battles" DROP COLUMN IF EXISTS "team_league_id";
ALTER TABLE "team_battles" DROP COLUMN IF EXISTS "team_lp";
ALTER TABLE "team_battles" DROP COLUMN IF EXISTS "total_league_draws";
ALTER TABLE "team_battles" DROP COLUMN IF EXISTS "total_league_losses";
ALTER TABLE "team_battles" DROP COLUMN IF EXISTS "total_league_wins";
ALTER TABLE "team_battles" DROP COLUMN IF EXISTS "total_tag_team_draws";
ALTER TABLE "team_battles" DROP COLUMN IF EXISTS "total_tag_team_losses";
ALTER TABLE "team_battles" DROP COLUMN IF EXISTS "total_tag_team_wins";

-- DropTable: Legacy scheduling table
DROP TABLE IF EXISTS "scheduled_matches";

-- CreateTable: Battle Summaries (Spec #39)
CREATE TABLE IF NOT EXISTS "battle_summaries" (
    "id" SERIAL NOT NULL,
    "battle_id" INTEGER NOT NULL,
    "per_robot" JSONB NOT NULL,
    "per_team" JSONB,
    "damage_flows" JSONB NOT NULL,
    "participants" JSONB NOT NULL,
    "koth_placements" JSONB,
    "koth_data" JSONB,
    "starting_positions" JSONB,
    "ending_positions" JSONB,
    "arena_radius" DOUBLE PRECISION,
    "battle_duration" INTEGER NOT NULL,
    "total_events" INTEGER NOT NULL,
    "has_data" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "battle_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "battle_summaries_battle_id_key" ON "battle_summaries"("battle_id");

-- AddForeignKey
ALTER TABLE "battle_summaries" DROP CONSTRAINT IF EXISTS "battle_summaries_battle_id_fkey";
ALTER TABLE "battle_summaries" ADD CONSTRAINT "battle_summaries_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex (idempotent — only if old name exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'scheduled_match_participants_participant_id_participant_type_id') THEN
    ALTER INDEX "scheduled_match_participants_participant_id_participant_type_id" RENAME TO "scheduled_match_participants_participant_id_participant_typ_idx";
  END IF;
END $$;
