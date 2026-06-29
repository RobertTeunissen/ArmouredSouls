-- Spec #44: Grand Melee — Free-for-All Battle Mode
-- Adds grand_melee to StandingsMode and MatchType enums, adds Robot counters

-- Add grand_melee to StandingsMode enum
ALTER TYPE "StandingsMode" ADD VALUE IF NOT EXISTS 'grand_melee';

-- Add grand_melee to MatchType enum
ALTER TYPE "MatchType" ADD VALUE IF NOT EXISTS 'grand_melee';

-- Add Grand Melee counters to robots table
ALTER TABLE "robots" ADD COLUMN "grand_melee_wins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "robots" ADD COLUMN "grand_melee_top3" INTEGER NOT NULL DEFAULT 0;
