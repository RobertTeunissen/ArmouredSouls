-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN "battle_id" INTEGER;

-- CreateIndex
CREATE INDEX "audit_logs_battle_id_idx" ON "audit_logs"("battle_id");

-- CreateIndex
CREATE INDEX "audit_logs_cycle_number_battle_id_idx" ON "audit_logs"("cycle_number", "battle_id");
