-- Drop the eligibility column from team_battles.
-- Eligibility is now determined at scheduling time by checking subscriptions
-- and roster completeness directly, rather than maintaining a stale cached flag.
ALTER TABLE "team_battles" DROP COLUMN IF EXISTS "eligibility";
