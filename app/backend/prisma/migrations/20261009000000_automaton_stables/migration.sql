-- CreateEnum
CREATE TYPE "StableType" AS ENUM ('human', 'generated', 'automaton');

-- CreateEnum
CREATE TYPE "AutomatonStatus" AS ENUM ('draft', 'active');

-- CreateEnum
CREATE TYPE "AutomatonTurnTrigger" AS ENUM ('settlement', 'preparation', 'season_open');

-- CreateEnum
CREATE TYPE "AutomatonTurnStatus" AS ENUM ('in_progress', 'completed', 'failed', 'skipped');

-- AlterTable
ALTER TABLE "robots" ADD COLUMN     "automaton_blueprint_id" INTEGER,
ADD COLUMN     "automaton_slot_index" INTEGER;

-- AlterTable
ALTER TABLE "season_accolades" ADD COLUMN     "subject_stable_type" "StableType" NOT NULL DEFAULT 'human';

-- AlterTable
ALTER TABLE "season_standing_snapshots" ADD COLUMN     "subject_stable_type" "StableType" NOT NULL DEFAULT 'human';

-- AlterTable
ALTER TABLE "stable_season_archives" ADD COLUMN     "stable_type" "StableType" NOT NULL DEFAULT 'human';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "stable_type" "StableType" NOT NULL DEFAULT 'human';

-- CreateTable
CREATE TABLE "automaton_profiles" (
    "id" SERIAL NOT NULL,
    "catalogue_key" VARCHAR(40) NOT NULL,
    "user_id" INTEGER,
    "planned_stable_name" VARCHAR(30),
    "franchise" VARCHAR(60) NOT NULL,
    "backstory" VARCHAR(400) NOT NULL,
    "strategy_key" VARCHAR(40) NOT NULL,
    "strategy_version" INTEGER NOT NULL,
    "strategy_parameters" JSONB NOT NULL,
    "team_names" JSONB NOT NULL DEFAULT '{"twoVsTwo":[],"threeVsThree":[]}',
    "event_order" JSONB NOT NULL,
    "status" "AutomatonStatus" NOT NULL DEFAULT 'draft',
    "origin" VARCHAR(20) NOT NULL,
    "activated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automaton_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automaton_robot_blueprints" (
    "id" SERIAL NOT NULL,
    "profile_id" INTEGER NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "robot_name" VARCHAR(50) NOT NULL,
    "image_url" VARCHAR(255),
    "loadout_type" VARCHAR(20) NOT NULL,
    "stance" VARCHAR(20) NOT NULL,
    "yield_threshold" INTEGER NOT NULL,
    "build_focus" VARCHAR(20) NOT NULL,
    "weapon_path" JSONB NOT NULL,
    "refinement_plan" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automaton_robot_blueprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automaton_turns" (
    "id" SERIAL NOT NULL,
    "profile_id" INTEGER NOT NULL,
    "season_number" INTEGER NOT NULL,
    "trigger" "AutomatonTurnTrigger" NOT NULL,
    "slot" INTEGER NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" "AutomatonTurnStatus" NOT NULL,
    "reason" VARCHAR(40),
    "strategy_key" VARCHAR(40) NOT NULL,
    "strategy_version" INTEGER NOT NULL,
    "start_balance" INTEGER NOT NULL,
    "end_balance" INTEGER,
    "credits_spent" INTEGER NOT NULL DEFAULT 0,
    "credits_received" INTEGER NOT NULL DEFAULT 0,
    "actions" JSONB NOT NULL DEFAULT '[]',
    "goal_outcomes" JSONB NOT NULL DEFAULT '[]',
    "duration_ms" INTEGER,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "automaton_turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automaton_strategy_drafts" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(40) NOT NULL,
    "version" INTEGER NOT NULL,
    "based_on" VARCHAR(50),
    "definition" JSONB NOT NULL,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automaton_strategy_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automaton_program_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "turns_enabled" BOOLEAN NOT NULL DEFAULT true,
    "turn_step_lease_until" TIMESTAMP(3),
    "last_sync_summary" JSONB,
    "updated_by_user_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automaton_program_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "automaton_profiles_catalogue_key_key" ON "automaton_profiles"("catalogue_key");

-- CreateIndex
CREATE UNIQUE INDEX "automaton_profiles_user_id_key" ON "automaton_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "automaton_profiles_planned_stable_name_key" ON "automaton_profiles"("planned_stable_name");

-- CreateIndex
CREATE INDEX "automaton_profiles_status_idx" ON "automaton_profiles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "automaton_robot_blueprints_profile_id_slot_index_key" ON "automaton_robot_blueprints"("profile_id", "slot_index");

-- CreateIndex
CREATE INDEX "automaton_turns_season_number_trigger_slot_idx" ON "automaton_turns"("season_number", "trigger", "slot");

-- CreateIndex
CREATE INDEX "automaton_turns_profile_id_started_at_idx" ON "automaton_turns"("profile_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "automaton_turns_profile_id_season_number_trigger_slot_key" ON "automaton_turns"("profile_id", "season_number", "trigger", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "automaton_strategy_drafts_key_version_key" ON "automaton_strategy_drafts"("key", "version");

-- CreateIndex
CREATE INDEX "robots_automaton_blueprint_id_idx" ON "robots"("automaton_blueprint_id");

-- CreateIndex
CREATE INDEX "users_stable_type_idx" ON "users"("stable_type");

-- AddForeignKey
ALTER TABLE "automaton_profiles" ADD CONSTRAINT "automaton_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automaton_robot_blueprints" ADD CONSTRAINT "automaton_robot_blueprints_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "automaton_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automaton_turns" ADD CONSTRAINT "automaton_turns_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "automaton_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robots" ADD CONSTRAINT "robots_automaton_blueprint_id_fkey" FOREIGN KEY ("automaton_blueprint_id") REFERENCES "automaton_robot_blueprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill (Spec #55 R1.2, invariant I1): every existing generated user becomes
-- stable_type 'generated'; every other existing user keeps the default 'human'.
UPDATE "users" SET "stable_type" = 'generated' WHERE "is_generated" = true;

-- Backfill archive subject types (R9.4) from the existing is_generated_subject flag.
UPDATE "season_standing_snapshots" SET "subject_stable_type" = 'generated' WHERE "is_generated_subject" = true;
UPDATE "season_accolades" SET "subject_stable_type" = 'generated' WHERE "is_generated_subject" = true;

-- Seed the single Program_Switch row (invariant I6): turns on, no lease held.
INSERT INTO "automaton_program_settings" ("id", "turns_enabled", "turn_step_lease_until", "updated_at")
VALUES (1, true, NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

