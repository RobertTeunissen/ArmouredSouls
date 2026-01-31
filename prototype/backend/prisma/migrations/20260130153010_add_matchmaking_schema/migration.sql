-- CreateTable
CREATE TABLE "scheduled_matches" (
    "id" SERIAL NOT NULL,
    "robot1_id" INTEGER NOT NULL,
    "robot2_id" INTEGER NOT NULL,
    "league_type" VARCHAR(20) NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    "battle_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scheduled_matches_robot1_id_idx" ON "scheduled_matches"("robot1_id");

-- CreateIndex
CREATE INDEX "scheduled_matches_robot2_id_idx" ON "scheduled_matches"("robot2_id");

-- CreateIndex
CREATE INDEX "scheduled_matches_scheduled_for_status_idx" ON "scheduled_matches"("scheduled_for", "status");

-- CreateIndex
CREATE INDEX "scheduled_matches_status_idx" ON "scheduled_matches"("status");

-- CreateIndex
CREATE INDEX "robots_current_league_league_id_idx" ON "robots"("current_league", "league_id");

-- AddForeignKey
ALTER TABLE "scheduled_matches" ADD CONSTRAINT "scheduled_matches_robot1_id_fkey" FOREIGN KEY ("robot1_id") REFERENCES "robots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_matches" ADD CONSTRAINT "scheduled_matches_robot2_id_fkey" FOREIGN KEY ("robot2_id") REFERENCES "robots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_matches" ADD CONSTRAINT "scheduled_matches_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
