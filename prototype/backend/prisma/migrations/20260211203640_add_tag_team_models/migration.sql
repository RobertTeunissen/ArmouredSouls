-- AlterTable
ALTER TABLE "users" ALTER COLUMN "currency" SET DEFAULT 3000000;

-- CreateTable
CREATE TABLE "tag_teams" (
    "id" SERIAL NOT NULL,
    "stable_id" INTEGER NOT NULL,
    "active_robot_id" INTEGER NOT NULL,
    "reserve_robot_id" INTEGER NOT NULL,
    "tag_team_league" VARCHAR(20) NOT NULL DEFAULT 'bronze',
    "tag_team_league_id" VARCHAR(30) NOT NULL DEFAULT 'bronze_1',
    "tag_team_league_points" INTEGER NOT NULL DEFAULT 0,
    "cycles_in_tag_team_league" INTEGER NOT NULL DEFAULT 0,
    "total_tag_team_wins" INTEGER NOT NULL DEFAULT 0,
    "total_tag_team_losses" INTEGER NOT NULL DEFAULT 0,
    "total_tag_team_draws" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tag_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_team_matches" (
    "id" SERIAL NOT NULL,
    "team1_id" INTEGER NOT NULL,
    "team2_id" INTEGER NOT NULL,
    "tag_team_league" VARCHAR(20) NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    "battle_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_team_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tag_teams_stable_id_idx" ON "tag_teams"("stable_id");

-- CreateIndex
CREATE INDEX "tag_teams_tag_team_league_tag_team_league_id_idx" ON "tag_teams"("tag_team_league", "tag_team_league_id");

-- CreateIndex
CREATE INDEX "tag_teams_active_robot_id_idx" ON "tag_teams"("active_robot_id");

-- CreateIndex
CREATE INDEX "tag_teams_reserve_robot_id_idx" ON "tag_teams"("reserve_robot_id");

-- CreateIndex
CREATE UNIQUE INDEX "tag_teams_active_robot_id_reserve_robot_id_key" ON "tag_teams"("active_robot_id", "reserve_robot_id");

-- Add check constraint to ensure different robots
ALTER TABLE "tag_teams" ADD CONSTRAINT "tag_teams_different_robots_check" CHECK ("active_robot_id" != "reserve_robot_id");

-- CreateIndex
CREATE INDEX "tag_team_matches_team1_id_idx" ON "tag_team_matches"("team1_id");

-- CreateIndex
CREATE INDEX "tag_team_matches_team2_id_idx" ON "tag_team_matches"("team2_id");

-- CreateIndex
CREATE INDEX "tag_team_matches_scheduled_for_status_idx" ON "tag_team_matches"("scheduled_for", "status");

-- CreateIndex
CREATE INDEX "tag_team_matches_status_idx" ON "tag_team_matches"("status");

-- AddForeignKey
ALTER TABLE "tag_teams" ADD CONSTRAINT "tag_teams_stable_id_fkey" FOREIGN KEY ("stable_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_teams" ADD CONSTRAINT "tag_teams_active_robot_id_fkey" FOREIGN KEY ("active_robot_id") REFERENCES "robots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_teams" ADD CONSTRAINT "tag_teams_reserve_robot_id_fkey" FOREIGN KEY ("reserve_robot_id") REFERENCES "robots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_team_matches" ADD CONSTRAINT "tag_team_matches_team1_id_fkey" FOREIGN KEY ("team1_id") REFERENCES "tag_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_team_matches" ADD CONSTRAINT "tag_team_matches_team2_id_fkey" FOREIGN KEY ("team2_id") REFERENCES "tag_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_team_matches" ADD CONSTRAINT "tag_team_matches_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
