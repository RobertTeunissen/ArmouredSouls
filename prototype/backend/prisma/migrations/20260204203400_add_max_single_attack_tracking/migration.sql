-- AlterTable
ALTER TABLE "battles" ADD COLUMN "max_single_attack_damage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "max_single_attack_robot_id" INTEGER;
