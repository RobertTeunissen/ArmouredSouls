-- Spec #51: cascade a team membership when its robot is deleted.
--
-- `team_battle_members` has two required parents. `team_id` has always cascaded;
-- `robot_id` was RESTRICT, so deleting a robot that belonged to any team raised
-- "Foreign key constraint violated on the constraint: team_battle_members_robot_id_fkey".
--
-- That is not a hypothetical. `resetService.resetUserAccount` deletes the user's robots
-- and only afterwards deletes their teams, so POST /api/onboarding/reset-account failed
-- with a rolled-back transaction for any player who had ever formed a team. The same
-- constraint accounted for 120 errors in a single Heavy_Tier run, where it aborted test
-- cleanup part-way and left rows behind for the next suite to trip over.
--
-- A membership row cannot outlive either parent, so RESTRICT was the wrong rule on both
-- ends. `seasonPurgeService` already deletes memberships before robots by hand; that
-- ordering stays, because being explicit is worth keeping, but it is no longer the only
-- thing standing between a robot delete and a 500.

ALTER TABLE "team_battle_members"
  DROP CONSTRAINT "team_battle_members_robot_id_fkey";

ALTER TABLE "team_battle_members"
  ADD CONSTRAINT "team_battle_members_robot_id_fkey"
  FOREIGN KEY ("robot_id") REFERENCES "robots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
