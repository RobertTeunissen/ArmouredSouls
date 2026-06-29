-- Add mode column to league_history for tier change attribution
ALTER TABLE "league_history" ADD COLUMN "mode" VARCHAR(30);
