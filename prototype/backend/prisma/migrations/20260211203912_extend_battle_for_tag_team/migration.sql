-- AlterTable
ALTER TABLE "battles" ADD COLUMN     "team1_active_robot_id" INTEGER,
ADD COLUMN     "team1_reserve_robot_id" INTEGER,
ADD COLUMN     "team1_tag_out_time" BIGINT,
ADD COLUMN     "team2_active_robot_id" INTEGER,
ADD COLUMN     "team2_reserve_robot_id" INTEGER,
ADD COLUMN     "team2_tag_out_time" BIGINT;

-- CreateIndex
CREATE INDEX "battles_battle_type_idx" ON "battles"("battle_type");
