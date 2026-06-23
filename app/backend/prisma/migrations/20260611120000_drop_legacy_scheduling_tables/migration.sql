-- Spec #41: Unified Match Scheduling
-- Drop legacy scheduling tables (all reads migrated to scheduled_matches_v2)
-- Also drop the rotating_zone column from scheduled_matches_v2 (zone rotation removed)
-- Also delete the persistent Bye Robot and its user (in-memory fabrication used instead)

-- Drop legacy tables (order matters: FK constraints)
DROP TABLE IF EXISTS "scheduled_koth_match_participants" CASCADE;
DROP TABLE IF EXISTS "scheduled_koth_matches" CASCADE;
DROP TABLE IF EXISTS "scheduled_team_battle_matches" CASCADE;
DROP TABLE IF EXISTS "scheduled_league_matches" CASCADE;

-- Drop rotating_zone column from unified scheduling table
ALTER TABLE "scheduled_matches_v2" DROP COLUMN IF EXISTS "rotating_zone";

-- Delete persistent Bye Robot and its user
DELETE FROM "robots" WHERE "name" = 'Bye Robot';
DELETE FROM "users" WHERE "username" = 'bye_robot_user';
