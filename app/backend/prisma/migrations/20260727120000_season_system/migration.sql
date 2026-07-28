-- Spec #45: Season System
--
-- Purely additive migration. No DROP, no ALTER ... TYPE, no changes to any
-- existing column. Contains schema changes plus a single fail-safe backfill.
--
-- Season_Zero is deliberately NOT created here — the Season_Service creates it
-- lazily on first read (R1.6, R24.1, R24.10), so this migration holds no
-- one-shot data insertion that cannot be rerun.

-- ===== users: season columns =====
ALTER TABLE "users" ADD COLUMN "is_generated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "last_seen_season_number" INTEGER NOT NULL DEFAULT 0;

-- Backfill: classify existing system-created stables.
-- Defaults to false, so anything unmatched stays a Human_Stable and is never
-- deleted by a Season_Rollover. The `admin` account is intentionally excluded.
UPDATE "users"
SET "is_generated" = true
WHERE "username" LIKE 'auto\_wimpbot%'
   OR "username" LIKE 'auto\_averagebot%'
   OR "username" LIKE 'auto\_expertbot%'
   OR "username" LIKE 'test\_user\_%';

-- ===== seasons =====
CREATE TABLE "seasons" (
    "id" SERIAL NOT NULL,
    "season_number" INTEGER NOT NULL,
    "phase" VARCHAR(20) NOT NULL,
    "competitive_cycles_completed" INTEGER NOT NULL DEFAULT 0,
    "preparation_cycles_completed" INTEGER NOT NULL DEFAULT 0,
    "length_override_cycles" INTEGER,
    "generated_stable_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "seasons_season_number_key" ON "seasons"("season_number");
CREATE INDEX "seasons_phase_idx" ON "seasons"("phase");

-- Guard the three permitted phase values at the database level.
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_phase_check"
  CHECK ("phase" IN ('preparation', 'competitive', 'completed'));

-- ===== stable_season_archives =====
CREATE TABLE "stable_season_archives" (
    "id" SERIAL NOT NULL,
    "season_number" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "stable_name" VARCHAR(30) NOT NULL,
    "final_credits" INTEGER NOT NULL,
    "prestige_earned" INTEGER NOT NULL,
    "total_battles" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "draws" INTEGER NOT NULL,
    "win_rate" DOUBLE PRECISION NOT NULL,
    "highest_elo" INTEGER NOT NULL,
    "total_fame" INTEGER NOT NULL,
    "championship_titles" INTEGER NOT NULL,
    "championship_titles_1v1" INTEGER NOT NULL,
    "championship_titles_2v2" INTEGER NOT NULL,
    "championship_titles_3v3" INTEGER NOT NULL,
    "achievements_unlocked" INTEGER NOT NULL,
    "achievements_available" INTEGER NOT NULL,
    "achievement_ids" JSONB NOT NULL,
    "facilities" JSONB NOT NULL,
    "robot_count" INTEGER NOT NULL,
    "team_count" INTEGER NOT NULL,
    "competitive_cycles" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stable_season_archives_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stable_season_archives_season_number_user_id_key"
  ON "stable_season_archives"("season_number", "user_id");
CREATE INDEX "stable_season_archives_user_id_idx" ON "stable_season_archives"("user_id");

ALTER TABLE "stable_season_archives" ADD CONSTRAINT "stable_season_archives_season_number_fkey"
  FOREIGN KEY ("season_number") REFERENCES "seasons"("season_number")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== robot_season_archives =====
CREATE TABLE "robot_season_archives" (
    "id" SERIAL NOT NULL,
    "stable_archive_id" INTEGER NOT NULL,
    "robot_name" VARCHAR(50) NOT NULL,
    "image_url" VARCHAR(255),
    "frame_id" INTEGER NOT NULL,
    "paint_job" VARCHAR(100),
    "final_elo" INTEGER NOT NULL,
    "fame" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "draws" INTEGER NOT NULL,
    "total_battles" INTEGER NOT NULL,
    "damage_dealt_lifetime" INTEGER NOT NULL,
    "damage_taken_lifetime" INTEGER NOT NULL,
    "kills" INTEGER NOT NULL,
    "main_weapon_name" VARCHAR(100),
    "offhand_weapon_name" VARCHAR(100),
    "standings" JSONB NOT NULL,
    "teams" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "robot_season_archives_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "robot_season_archives_stable_archive_id_idx"
  ON "robot_season_archives"("stable_archive_id");

ALTER TABLE "robot_season_archives" ADD CONSTRAINT "robot_season_archives_stable_archive_id_fkey"
  FOREIGN KEY ("stable_archive_id") REFERENCES "stable_season_archives"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== season_accolades =====
CREATE TABLE "season_accolades" (
    "id" SERIAL NOT NULL,
    "season_number" INTEGER NOT NULL,
    "user_id" INTEGER,
    "category" VARCHAR(60) NOT NULL,
    "rank" INTEGER NOT NULL,
    "subject_type" VARCHAR(20) NOT NULL,
    "subject_name" VARCHAR(100) NOT NULL,
    "stable_name" VARCHAR(30) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "value_label" VARCHAR(40) NOT NULL,
    "mode" VARCHAR(20),
    "is_generated_subject" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "season_accolades_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "season_accolades_season_number_user_id_idx"
  ON "season_accolades"("season_number", "user_id");
CREATE INDEX "season_accolades_season_number_category_idx"
  ON "season_accolades"("season_number", "category");

ALTER TABLE "season_accolades" ADD CONSTRAINT "season_accolades_season_number_fkey"
  FOREIGN KEY ("season_number") REFERENCES "seasons"("season_number")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== season_standing_snapshots =====
CREATE TABLE "season_standing_snapshots" (
    "id" SERIAL NOT NULL,
    "season_number" INTEGER NOT NULL,
    "mode" VARCHAR(20) NOT NULL,
    "tier" VARCHAR(20) NOT NULL,
    "league_instance_id" VARCHAR(30) NOT NULL,
    "instance_rank" INTEGER NOT NULL,
    "entity_type" VARCHAR(10) NOT NULL,
    "entity_name" VARCHAR(100) NOT NULL,
    "stable_name" VARCHAR(30) NOT NULL,
    "league_points" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "draws" INTEGER NOT NULL,
    "is_generated_subject" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "season_standing_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "season_standing_snapshots_season_mode_tier_instance_idx"
  ON "season_standing_snapshots"("season_number", "mode", "tier", "league_instance_id");

ALTER TABLE "season_standing_snapshots" ADD CONSTRAINT "season_standing_snapshots_season_number_fkey"
  FOREIGN KEY ("season_number") REFERENCES "seasons"("season_number")
  ON DELETE CASCADE ON UPDATE CASCADE;
