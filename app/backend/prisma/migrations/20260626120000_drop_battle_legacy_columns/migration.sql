-- Drop 19 deprecated Battle columns (Backlog #18 final step)
-- All read paths have been migrated to BattleParticipant data.
-- These columns were made nullable in Spec #43 and writes were stopped.

-- Backfill tagOutTimeMs from battleLog JSON for historical tag-team battles
-- (Only battles that still have battle_log — within 7-day retention window)
UPDATE "battle_participants" bp
SET "tag_out_time_ms" = (b."battle_log"->>'team1TagOutTime')::bigint
FROM "battles" b
WHERE bp."battle_id" = b."id"
  AND b."battle_type" = 'tag_team'
  AND bp."team" = 1
  AND bp."role" = 'active'
  AND bp."tag_out_time_ms" IS NULL
  AND b."battle_log" IS NOT NULL
  AND b."battle_log"->>'team1TagOutTime' IS NOT NULL;

UPDATE "battle_participants" bp
SET "tag_out_time_ms" = (b."battle_log"->>'team2TagOutTime')::bigint
FROM "battles" b
WHERE bp."battle_id" = b."id"
  AND b."battle_type" = 'tag_team'
  AND bp."team" = 2
  AND bp."role" = 'active'
  AND bp."tag_out_time_ms" IS NULL
  AND b."battle_log" IS NOT NULL
  AND b."battle_log"->>'team2TagOutTime' IS NOT NULL;

-- Drop 5 ELO tracking columns
ALTER TABLE "battles" DROP COLUMN IF EXISTS "robot1_elo_before";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "robot2_elo_before";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "robot1_elo_after";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "robot2_elo_after";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "elo_change";

-- Drop 6 tag-team robot ID / time columns
ALTER TABLE "battles" DROP COLUMN IF EXISTS "team1_active_robot_id";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "team1_reserve_robot_id";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "team2_active_robot_id";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "team2_reserve_robot_id";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "team1_tag_out_time";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "team2_tag_out_time";

-- Drop 8 tag-team per-robot stats columns
ALTER TABLE "battles" DROP COLUMN IF EXISTS "team1_active_damage_dealt";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "team1_reserve_damage_dealt";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "team2_active_damage_dealt";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "team2_reserve_damage_dealt";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "team1_active_fame_awarded";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "team1_reserve_fame_awarded";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "team2_active_fame_awarded";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "team2_reserve_fame_awarded";
