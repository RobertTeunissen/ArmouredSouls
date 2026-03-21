-- AlterTable
ALTER TABLE "robots" ADD COLUMN     "koth_best_placement" INTEGER,
ADD COLUMN     "koth_best_win_streak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "koth_current_win_streak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "koth_kills" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "koth_matches" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "koth_total_zone_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "koth_total_zone_time" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "koth_wins" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "scheduled_koth_matches" (
    "id" SERIAL NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    "battle_id" INTEGER,
    "rotating_zone" BOOLEAN NOT NULL DEFAULT false,
    "score_threshold" INTEGER,
    "time_limit" INTEGER,
    "zone_radius" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_koth_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_koth_match_participants" (
    "id" SERIAL NOT NULL,
    "match_id" INTEGER NOT NULL,
    "robot_id" INTEGER NOT NULL,

    CONSTRAINT "scheduled_koth_match_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scheduled_koth_matches_scheduled_for_status_idx" ON "scheduled_koth_matches"("scheduled_for", "status");

-- CreateIndex
CREATE INDEX "scheduled_koth_matches_status_idx" ON "scheduled_koth_matches"("status");

-- CreateIndex
CREATE INDEX "scheduled_koth_match_participants_match_id_idx" ON "scheduled_koth_match_participants"("match_id");

-- CreateIndex
CREATE INDEX "scheduled_koth_match_participants_robot_id_idx" ON "scheduled_koth_match_participants"("robot_id");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_koth_match_participants_match_id_robot_id_key" ON "scheduled_koth_match_participants"("match_id", "robot_id");

-- AddForeignKey
ALTER TABLE "scheduled_koth_matches" ADD CONSTRAINT "scheduled_koth_matches_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_koth_match_participants" ADD CONSTRAINT "scheduled_koth_match_participants_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "scheduled_koth_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_koth_match_participants" ADD CONSTRAINT "scheduled_koth_match_participants_robot_id_fkey" FOREIGN KEY ("robot_id") REFERENCES "robots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
