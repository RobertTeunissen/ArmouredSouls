-- CreateTable: team_battles (Team Battle model for 2v2 and 3v3 team compositions)
CREATE TABLE "team_battles" (
    "id" SERIAL NOT NULL,
    "stable_id" INTEGER NOT NULL,
    "team_size" INTEGER NOT NULL,
    "team_name" VARCHAR(32) NOT NULL,
    "team_lp" INTEGER NOT NULL DEFAULT 0,
    "team_league" VARCHAR(20) NOT NULL DEFAULT 'bronze',
    "team_league_id" VARCHAR(30) NOT NULL DEFAULT 'bronze_1',
    "cycles_in_league" INTEGER NOT NULL DEFAULT 0,
    "total_wins" INTEGER NOT NULL DEFAULT 0,
    "total_losses" INTEGER NOT NULL DEFAULT 0,
    "total_draws" INTEGER NOT NULL DEFAULT 0,
    "eligibility" VARCHAR(20) NOT NULL DEFAULT 'ELIGIBLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_battles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: team_battle_members (Team Battle Member model)
CREATE TABLE "team_battle_members" (
    "id" SERIAL NOT NULL,
    "team_id" INTEGER NOT NULL,
    "robot_id" INTEGER NOT NULL,
    "slot_index" INTEGER NOT NULL,

    CONSTRAINT "team_battle_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable: scheduled_team_battle_matches (Scheduled Team Battle Match model)
CREATE TABLE "scheduled_team_battle_matches" (
    "id" SERIAL NOT NULL,
    "team1_id" INTEGER NOT NULL,
    "team2_id" INTEGER,
    "team_size" INTEGER NOT NULL,
    "team_battle_league" VARCHAR(20) NOT NULL,
    "team_battle_league_id" VARCHAR(30) NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_team_battle_matches_pkey" PRIMARY KEY ("id")
);

-- Add team battle win counters to robots table
ALTER TABLE "robots" ADD COLUMN "total_league_2v2_wins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "robots" ADD COLUMN "total_league_3v3_wins" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex: team_battles
CREATE INDEX "team_battles_stable_id_idx" ON "team_battles"("stable_id");
CREATE INDEX "team_battles_team_league_id_idx" ON "team_battles"("team_league_id");
CREATE INDEX "team_battles_team_size_team_league_idx" ON "team_battles"("team_size", "team_league");

-- CreateIndex: team_battle_members
CREATE UNIQUE INDEX "team_battle_members_team_id_slot_index_key" ON "team_battle_members"("team_id", "slot_index");
CREATE UNIQUE INDEX "team_battle_members_team_id_robot_id_key" ON "team_battle_members"("team_id", "robot_id");
CREATE INDEX "team_battle_members_robot_id_idx" ON "team_battle_members"("robot_id");

-- CreateIndex: scheduled_team_battle_matches
CREATE INDEX "scheduled_team_battle_matches_status_team_size_idx" ON "scheduled_team_battle_matches"("status", "team_size");
CREATE INDEX "scheduled_team_battle_matches_team1_id_idx" ON "scheduled_team_battle_matches"("team1_id");
CREATE INDEX "scheduled_team_battle_matches_team2_id_idx" ON "scheduled_team_battle_matches"("team2_id");

-- AddForeignKey: team_battles.stable_id → users.id
ALTER TABLE "team_battles" ADD CONSTRAINT "team_battles_stable_id_fkey" FOREIGN KEY ("stable_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: team_battle_members.team_id → team_battles.id
ALTER TABLE "team_battle_members" ADD CONSTRAINT "team_battle_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team_battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: team_battle_members.robot_id → robots.id
ALTER TABLE "team_battle_members" ADD CONSTRAINT "team_battle_members_robot_id_fkey" FOREIGN KEY ("robot_id") REFERENCES "robots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: scheduled_team_battle_matches.team1_id → team_battles.id
ALTER TABLE "scheduled_team_battle_matches" ADD CONSTRAINT "scheduled_team_battle_matches_team1_id_fkey" FOREIGN KEY ("team1_id") REFERENCES "team_battles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: scheduled_team_battle_matches.team2_id → team_battles.id
ALTER TABLE "scheduled_team_battle_matches" ADD CONSTRAINT "scheduled_team_battle_matches_team2_id_fkey" FOREIGN KEY ("team2_id") REFERENCES "team_battles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
