-- CreateIndex
CREATE INDEX "battle_participants_elo_before_idx" ON "battle_participants"("elo_before");

-- CreateIndex
CREATE INDEX "battle_participants_final_hp_idx" ON "battle_participants"("final_hp");

-- CreateIndex
CREATE INDEX "battles_winner_id_idx" ON "battles"("winner_id");

-- CreateIndex
CREATE INDEX "robots_total_battles_idx" ON "robots"("total_battles");
