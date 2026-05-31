-- AlterTable
ALTER TABLE "robots" ADD COLUMN     "total_league_1v1_losses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total_league_1v1_wins" INTEGER NOT NULL DEFAULT 0;
