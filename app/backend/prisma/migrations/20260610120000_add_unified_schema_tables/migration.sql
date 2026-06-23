-- Database Unification (Spec #40)
-- Creates unified tables: standings, scheduled_matches_v2, financial_ledger, leaderboard_cache
-- Also adds MatchType and StandingsMode enums

-- MatchType enum
CREATE TYPE "MatchType" AS ENUM ('league_1v1', 'league_2v2', 'league_3v3', 'tag_team', 'koth', 'tournament_1v1', 'tournament_2v2', 'tournament_3v3');

-- StandingsMode enum
CREATE TYPE "StandingsMode" AS ENUM ('league_1v1', 'league_2v2', 'league_3v3', 'tag_team', 'koth', 'tournament_1v1', 'tournament_2v2', 'tournament_3v3');

-- Unified scheduling table
CREATE TABLE "scheduled_matches_v2" (
    "id" SERIAL NOT NULL,
    "match_type" "MatchType" NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "battle_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tournament_id" INTEGER,
    "round" INTEGER,
    "match_number" INTEGER,
    "is_bye_match" BOOLEAN,
    "league_type" VARCHAR(20),
    "league_instance_id" VARCHAR(30),
    "rotating_zone" BOOLEAN,
    "score_threshold" INTEGER,
    "time_limit" INTEGER,
    "zone_radius" INTEGER,
    "cancel_reason" TEXT,

    CONSTRAINT "scheduled_matches_v2_pkey" PRIMARY KEY ("id")
);

-- Scheduled match participants
CREATE TABLE "scheduled_match_participants" (
    "id" SERIAL NOT NULL,
    "scheduled_match_id" INTEGER NOT NULL,
    "participant_type" VARCHAR(10) NOT NULL,
    "participant_id" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_match_participants_pkey" PRIMARY KEY ("id")
);

-- Unified standings table
CREATE TABLE "standings" (
    "id" SERIAL NOT NULL,
    "entity_type" VARCHAR(10) NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "mode" "StandingsMode" NOT NULL,
    "tier" VARCHAR(20) NOT NULL DEFAULT 'bronze',
    "league_instance_id" VARCHAR(30) NOT NULL DEFAULT 'bronze_1',
    "league_points" INTEGER NOT NULL DEFAULT 0,
    "cycles_in_tier" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "current_win_streak" INTEGER NOT NULL DEFAULT 0,
    "best_win_streak" INTEGER NOT NULL DEFAULT 0,
    "current_lose_streak" INTEGER NOT NULL DEFAULT 0,
    "total_matches" INTEGER,
    "total_kills" INTEGER,
    "total_zone_score" DOUBLE PRECISION,
    "total_zone_time" DOUBLE PRECISION,
    "best_placement" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "standings_pkey" PRIMARY KEY ("id")
);

-- Financial ledger
CREATE TABLE "financial_ledger" (
    "id" SERIAL NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "robot_id" INTEGER,
    "transaction_type" VARCHAR(30) NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_ledger_pkey" PRIMARY KEY ("id")
);

-- Leaderboard cache
CREATE TABLE "leaderboard_cache" (
    "id" SERIAL NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "rank" INTEGER NOT NULL,
    "entity_type" VARCHAR(10) NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaderboard_cache_pkey" PRIMARY KEY ("id")
);

-- Add tag_out_time_ms to battle_participants (enhanced participant roles)
ALTER TABLE "battle_participants" ADD COLUMN IF NOT EXISTS "tag_out_time_ms" BIGINT;

-- Indexes: scheduled_matches_v2
CREATE INDEX "scheduled_matches_v2_status_scheduled_for_idx" ON "scheduled_matches_v2"("status", "scheduled_for");
CREATE INDEX "scheduled_matches_v2_match_type_status_idx" ON "scheduled_matches_v2"("match_type", "status");
CREATE INDEX "scheduled_matches_v2_tournament_id_round_idx" ON "scheduled_matches_v2"("tournament_id", "round");
CREATE INDEX "scheduled_matches_v2_battle_id_idx" ON "scheduled_matches_v2"("battle_id");

-- Indexes: scheduled_match_participants
CREATE UNIQUE INDEX "scheduled_match_participants_scheduled_match_id_slot_key" ON "scheduled_match_participants"("scheduled_match_id", "slot");
CREATE INDEX "scheduled_match_participants_participant_id_participant_type_idx" ON "scheduled_match_participants"("participant_id", "participant_type");
CREATE INDEX "scheduled_match_participants_scheduled_match_id_idx" ON "scheduled_match_participants"("scheduled_match_id");

-- Indexes: standings
CREATE UNIQUE INDEX "standings_entity_type_entity_id_mode_key" ON "standings"("entity_type", "entity_id", "mode");
CREATE INDEX "standings_mode_tier_league_instance_id_idx" ON "standings"("mode", "tier", "league_instance_id");
CREATE INDEX "standings_mode_league_points_idx" ON "standings"("mode", "league_points" DESC);
CREATE INDEX "standings_entity_type_entity_id_idx" ON "standings"("entity_type", "entity_id");

-- Indexes: financial_ledger
CREATE INDEX "financial_ledger_user_id_cycle_number_idx" ON "financial_ledger"("user_id", "cycle_number");
CREATE INDEX "financial_ledger_transaction_type_cycle_number_idx" ON "financial_ledger"("transaction_type", "cycle_number");
CREATE INDEX "financial_ledger_robot_id_idx" ON "financial_ledger"("robot_id");
CREATE INDEX "financial_ledger_cycle_number_idx" ON "financial_ledger"("cycle_number");

-- Indexes: leaderboard_cache
CREATE INDEX "leaderboard_cache_category_generation_rank_idx" ON "leaderboard_cache"("category", "generation", "rank");
CREATE INDEX "leaderboard_cache_entity_type_entity_id_idx" ON "leaderboard_cache"("entity_type", "entity_id");

-- Foreign keys
ALTER TABLE "scheduled_match_participants" ADD CONSTRAINT "scheduled_match_participants_scheduled_match_id_fkey" FOREIGN KEY ("scheduled_match_id") REFERENCES "scheduled_matches_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Add feature_flags column to cycle_metadata (for migration rollback safety)
ALTER TABLE "cycle_metadata" ADD COLUMN IF NOT EXISTS "feature_flags" JSONB NOT NULL DEFAULT '{}';
