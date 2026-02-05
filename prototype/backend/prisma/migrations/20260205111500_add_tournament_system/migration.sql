-- AlterTable
ALTER TABLE "battles" ADD COLUMN "tournament_id" INTEGER,
ADD COLUMN "tournament_round" INTEGER;

-- AlterTable (Update battleType comment to reflect new options)
COMMENT ON COLUMN "battles"."battle_type" IS '"league", "tournament"';

-- CreateTable
CREATE TABLE "tournaments" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "tournament_type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "current_round" INTEGER NOT NULL DEFAULT 1,
    "max_rounds" INTEGER NOT NULL,
    "total_participants" INTEGER NOT NULL,
    "winner_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_matches" (
    "id" SERIAL NOT NULL,
    "tournament_id" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "match_number" INTEGER NOT NULL,
    "robot1_id" INTEGER,
    "robot2_id" INTEGER,
    "winner_id" INTEGER,
    "battle_id" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "is_bye_match" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "tournament_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tournaments_status_idx" ON "tournaments"("status");

-- CreateIndex
CREATE INDEX "tournaments_winner_id_idx" ON "tournaments"("winner_id");

-- CreateIndex
CREATE INDEX "tournament_matches_tournament_id_round_idx" ON "tournament_matches"("tournament_id", "round");

-- CreateIndex
CREATE INDEX "tournament_matches_status_idx" ON "tournament_matches"("status");

-- CreateIndex
CREATE INDEX "tournament_matches_robot1_id_idx" ON "tournament_matches"("robot1_id");

-- CreateIndex
CREATE INDEX "tournament_matches_robot2_id_idx" ON "tournament_matches"("robot2_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_matches_battle_id_key" ON "tournament_matches"("battle_id");

-- CreateIndex
CREATE INDEX "battles_tournament_id_idx" ON "battles"("tournament_id");

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "robots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_robot1_id_fkey" FOREIGN KEY ("robot1_id") REFERENCES "robots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_robot2_id_fkey" FOREIGN KEY ("robot2_id") REFERENCES "robots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "robots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
