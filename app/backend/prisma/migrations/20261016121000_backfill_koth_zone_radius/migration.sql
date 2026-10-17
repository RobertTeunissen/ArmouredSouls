-- Season 2 one-off backfill: KotH matches are now scheduled with an explicit
-- zone radius (default 7) and the orchestrator no longer falls back to a
-- default. KotH matches scheduled before this deploy get the new default
-- radius so they run without compatibility code. Data only, no schema change.
--
-- Idempotent: only still-scheduled KotH rows without a radius are touched;
-- a second run matches no rows.
UPDATE "scheduled_matches_v2"
SET "zone_radius" = 7
WHERE "match_type" = 'koth'
  AND "status" = 'scheduled'
  AND "zone_radius" IS NULL;
