-- Retire storage nothing reads or writes any more (Nov 2026 dead-code sweep).

-- The materialized leaderboard cache (Spec #40) was never read: its reader was
-- removed in the Nov 2026 quality review and the `leaderboard_cache_active` flag
-- was never switched on, so the table stayed empty. Leaderboards query live data.
DROP TABLE IF EXISTS "leaderboard_cache";

-- Remove the cache's leftover keys from the shared metadata JSON, if present.
UPDATE "cycle_metadata"
SET "feature_flags" = "feature_flags" - 'leaderboard_active_generation' - 'leaderboard_cache_active'
WHERE "id" = 1 AND jsonb_typeof("feature_flags") = 'object';

-- Superseded by practice_arena_events; no longer written, and the 11 Nov 2026
-- rollover emptied it.
DROP TABLE IF EXISTS "practice_arena_daily_stats";

-- Never written or read: there is no coaching staff facility.
ALTER TABLE "facilities" DROP COLUMN IF EXISTS "active_coach";
