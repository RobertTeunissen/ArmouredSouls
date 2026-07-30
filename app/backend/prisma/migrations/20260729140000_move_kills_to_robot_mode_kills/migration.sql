-- Retire `standings.total_kills` in favour of `robot_mode_kills`.
--
-- `total_kills` only ever worked for koth and grand_melee, the two modes whose
-- standings rows are robot-scoped. For the team modes a standing belongs to the
-- team, so there was nowhere to record a robot's own destructions. Now that
-- `robot_mode_kills` covers all nine modes there is no reason to keep a second,
-- partial home for the same fact.
--
-- Carry the existing koth and grand_melee counts across first. Both sides are
-- robot-scoped and hold the same figure, so this is a straight copy. ON CONFLICT
-- adds to whatever the new tally has already recorded, which keeps the migration
-- safe to re-run and correct if a battle lands between the two statements.

INSERT INTO "robot_mode_kills" ("robot_id", "mode", "kills", "created_at", "updated_at")
SELECT s."entity_id", s."mode", s."total_kills", NOW(), NOW()
FROM "standings" s
WHERE s."entity_type" = 'robot'
  AND s."mode" IN ('koth', 'grand_melee')
  AND s."total_kills" IS NOT NULL
  AND s."total_kills" > 0
  -- Only for robots that still exist; a rollover may have removed the robot
  -- while leaving an orphaned standing behind.
  AND EXISTS (SELECT 1 FROM "robots" r WHERE r.id = s."entity_id")
ON CONFLICT ("robot_id", "mode")
DO UPDATE SET
  "kills" = "robot_mode_kills"."kills" + EXCLUDED."kills",
  "updated_at" = NOW();

ALTER TABLE "standings" DROP COLUMN "total_kills";
