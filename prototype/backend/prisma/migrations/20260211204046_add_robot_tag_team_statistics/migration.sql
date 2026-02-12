-- AlterTable
ALTER TABLE "robots" ADD COLUMN     "times_tagged_in" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "times_tagged_out" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total_tag_team_battles" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total_tag_team_draws" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total_tag_team_losses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total_tag_team_wins" INTEGER NOT NULL DEFAULT 0;
