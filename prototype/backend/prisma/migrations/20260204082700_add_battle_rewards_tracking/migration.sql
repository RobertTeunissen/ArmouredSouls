-- AlterTable
ALTER TABLE "battles" ADD COLUMN "robot1_prestige_awarded" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "robot2_prestige_awarded" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "robot1_fame_awarded" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "robot2_fame_awarded" INTEGER NOT NULL DEFAULT 0;
