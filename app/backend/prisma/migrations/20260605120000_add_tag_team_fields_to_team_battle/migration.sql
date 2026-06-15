-- Add tag team league tracking fields to team_battles
ALTER TABLE "team_battles" ADD COLUMN "tag_team_lp" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "team_battles" ADD COLUMN "tag_team_league" VARCHAR(20) NOT NULL DEFAULT 'bronze';
ALTER TABLE "team_battles" ADD COLUMN "tag_team_league_id" VARCHAR(30) NOT NULL DEFAULT 'bronze_1';
ALTER TABLE "team_battles" ADD COLUMN "cycles_in_tag_team_league" INTEGER NOT NULL DEFAULT 0;

-- Add tag team performance tracking fields to team_battles
ALTER TABLE "team_battles" ADD COLUMN "total_tag_team_wins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "team_battles" ADD COLUMN "total_tag_team_losses" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "team_battles" ADD COLUMN "total_tag_team_draws" INTEGER NOT NULL DEFAULT 0;

-- Rename existing league performance columns for clarity
-- (Column rename, not drop+add — preserves existing data)
ALTER TABLE "team_battles" RENAME COLUMN "total_wins" TO "total_league_wins";
ALTER TABLE "team_battles" RENAME COLUMN "total_losses" TO "total_league_losses";
ALTER TABLE "team_battles" RENAME COLUMN "total_draws" TO "total_league_draws";

-- Add composite index for tag team matchmaking queries
CREATE INDEX "team_battles_team_size_tag_team_league_tag_team_league_id_idx" ON "team_battles"("team_size", "tag_team_league", "tag_team_league_id");
