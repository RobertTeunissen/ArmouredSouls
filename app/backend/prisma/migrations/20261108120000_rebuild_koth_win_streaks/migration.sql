-- Rebuild KotH win streaks from the season's KotH history.
--
-- Until this release `awardKothPoints` never reset `current_win_streak` on a
-- finish other than 1st, so every KotH robot's best streak equalled its total
-- KotH wins and the Hall of Records "KotH win streak" repeated "Most KotH wins".
-- The code now resets the streak (as Grand Melee always did); this rebuilds
-- `best_win_streak` and `current_win_streak` from the battles themselves.
--
-- Rules, matching the fixed `awardKothPoints`:
--   - a win is placement 1 without a forfeit;
--   - every other KotH appearance (lower placement or a forfeit) ends the streak;
--   - rows without a placement (byes) never touched the standing, so they are skipped.
-- Order within a robot is battle time, then battle id.
--
-- Only robots with KotH history are touched; `wins`, LP and every other column
-- are left alone. Battles and standings are both current-season data, so the
-- rebuild never mixes seasons. Running it again produces the same values.

WITH events AS (
  SELECT
    bp."robot_id",
    b."created_at",
    b."id" AS battle_id,
    (bp."placement" = 1 AND NOT bp."forfeited") AS won
  FROM "battle_participants" bp
  JOIN "battles" b ON b."id" = bp."battle_id"
  WHERE b."battle_type" = 'koth'
    AND bp."placement" IS NOT NULL
),
runs AS (
  -- Each non-win opens a new run; the wins after it belong to that run.
  SELECT
    "robot_id",
    won,
    SUM(CASE WHEN won THEN 0 ELSE 1 END) OVER (
      PARTITION BY "robot_id" ORDER BY "created_at", battle_id
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS run_id
  FROM events
),
run_lengths AS (
  SELECT "robot_id", run_id, COUNT(*) FILTER (WHERE won) AS wins_in_run
  FROM runs
  GROUP BY "robot_id", run_id
),
last_run AS (
  SELECT "robot_id", MAX(run_id) AS run_id
  FROM runs
  GROUP BY "robot_id"
),
rebuilt AS (
  SELECT
    rl."robot_id",
    MAX(rl.wins_in_run)::int AS best,
    MAX(CASE WHEN rl.run_id = lr.run_id THEN rl.wins_in_run ELSE 0 END)::int AS current
  FROM run_lengths rl
  JOIN last_run lr ON lr."robot_id" = rl."robot_id"
  GROUP BY rl."robot_id"
)
UPDATE "standings" s
SET "best_win_streak" = r.best,
    "current_win_streak" = r.current
FROM rebuilt r
WHERE s."entity_type" = 'robot'
  AND s."mode" = 'koth'
  AND s."entity_id" = r."robot_id";
