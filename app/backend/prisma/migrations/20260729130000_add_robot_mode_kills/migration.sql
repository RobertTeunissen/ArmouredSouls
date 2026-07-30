-- Per-robot, per-battle-type destruction tally.
--
-- Kept out of `standings` on purpose: standings rows for team modes belong to
-- the team, and matchmaking/rebalancing queries filter by `mode` alone and read
-- every `entity_id` as their own entity type, so robot-scoped rows under
-- league_2v2 / league_3v3 / tag_team would be consumed as team ids.
--
-- No backfill. The table starts empty and fills from the next battle onward,
-- which is accurate because the current season began with every robot at zero
-- kills. Earlier seasons are not reconstructible: `robots.kills` never recorded
-- a mode, and battle history is purged at each Season_Rollover.

CREATE TABLE "robot_mode_kills" (
    "id" SERIAL NOT NULL,
    "robot_id" INTEGER NOT NULL,
    "mode" "StandingsMode" NOT NULL,
    "kills" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "robot_mode_kills_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "robot_mode_kills_robot_id_mode_key" ON "robot_mode_kills"("robot_id", "mode");

-- Supports the per-mode leaderboard ranking.
CREATE INDEX "robot_mode_kills_mode_kills_idx" ON "robot_mode_kills"("mode", "kills" DESC);

ALTER TABLE "robot_mode_kills"
    ADD CONSTRAINT "robot_mode_kills_robot_id_fkey"
    FOREIGN KEY ("robot_id") REFERENCES "robots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
